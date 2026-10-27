import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, mkdir, cp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join, basename, sep, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import './runtime-resolver.mjs'

const core = process.env.EDUWORK_CORE_ROOT
if (!core) throw new Error('Set EDUWORK_CORE_ROOT to the explicit local core under test')
const require = createRequire(resolve(process.env.EDUWORK_TEST_RUNTIME, 'package.json'))
const load = name => import(pathToFileURL(require.resolve(name)).href)

test('edition packaging reuses the public Skill and binds only local calendar references', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ecnu-calendar-pilot-'))
  try {
    const { copyDshPackagePayload } = await import(pathToFileURL(resolve(core, 'scripts/lib/dsh-packages.mjs')))
    const { copyDshBundledSkills } = await import(pathToFileURL(resolve(core, 'scripts/lib/dsh-skills.mjs')))
    const modules = join(root, 'node_modules')
    const product = join(root, 'product')
    await mkdir(modules, { recursive: true })
    await copyDshPackagePayload(resolve(core, 'dsh-plugins/calendar'), join(modules, '@eduwork/dsh-calendar'))
    const edition = JSON.parse(await readFile(new URL('../distribution.json', import.meta.url), 'utf8'))
    const skill = edition.skills.find(row => row.name === 'calendar-management')
    const result = await copyDshBundledSkills({ repository: resolve(core), packageRoot: modules, skillRoot: join(product, 'skills'), skills: [skill] })
    assert.deepEqual(result, ['calendar-management'])
    for (const resource of edition.resources.filter(row => row.target.startsWith('calendar/'))) {
      const destination = join(product, 'resources', resource.target)
      await mkdir(dirname(destination), { recursive: true })
      await cp(resolve(fileURLToPath(new URL('../../', import.meta.url)), resource.source), destination)
    }
    const content = await readFile(join(product, 'skills/calendar-management/SKILL.md'), 'utf8')
    const original = await readFile(resolve(core, 'dsh-plugins/calendar/skills/calendar-management/SKILL.md'), 'utf8')
    assert.ok(content.startsWith(original.trimEnd()))
    assert.ok(content.includes('## 发行版参考资料'))
    for (const ref of skill.references) {
      assert.ok(content.includes(ref.path), 'Agent-readable body must carry the actual reference link')
      assert.ok((await readFile(resolve(product, 'skills/calendar-management', ref.path))).length)
    }
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep) && basename(root).startsWith('ecnu-calendar-pilot-'))
    await rm(root, { recursive: true, force: true })
  }
})

const dataset = JSON.parse(await readFile(new URL('../plugins/ecnu-calendar/data/2026-2027.json', import.meta.url), 'utf8'))

test('the bundled dataset transcribes the official calendar', () => {
  const byId = new Map(dataset.terms.map(term => [term.id, term]))
  const autumn = byId.get('2026-autumn')
  const spring = byId.get('2027-spring')
  const summer = byId.get('2027-summer-short')
  assert.equal(autumn.firstDay, '2026-09-14')
  assert.equal(autumn.weekCount, 18)
  assert.deepEqual(autumn.phases.map(phase => [phase.kind, phase.firstDay, phase.lastDay]), [
    ['teaching', '2026-09-14', '2027-01-01'],
    ['examination', '2027-01-04', '2027-01-15'],
  ])
  assert.equal(spring.firstDay, '2027-02-22')
  assert.equal(spring.weekCount, 18)
  // The short summer term carries the range the official calendar states and no invented weeks.
  assert.equal(summer.firstDay, '2027-06-28')
  assert.equal(summer.lastDay, '2027-07-23')
  assert.equal(summer.weekCount, undefined)
  assert.deepEqual(dataset.breaks, [{ id: 'winter-2027', name: '寒假', firstDay: '2027-01-18', lastDay: '2027-02-20' }])
  assert.deepEqual(dataset.events.map(event => [event.uid, event.date]), [
    ['autumn-registration-2026', '2026-09-13'],
    ['spring-registration-2027', '2027-02-21'],
  ])
})

async function withCalendarService(run) {
  const [{ Context }] = await Promise.all([load('@deepseek-ai/cordis')])
  const plugin = await import('../plugins/ecnu-calendar/lib/index.js')
  const ctx = new Context()
  try {
    await ctx.plugin(plugin.default)
    assert.ok(ctx.ecnuCalendar, 'the service is reachable as ctx.ecnuCalendar')
    await ctx.ecnuCalendar.ready
    return await run(ctx.ecnuCalendar)
  } finally {
    await ctx.fiber.dispose()
  }
}

test('date queries answer term, teaching week, parity, phase and break', async () => {
  await withCalendarService(service => {
    const on = date => service.describeDate(date)
    assert.deepEqual(on('2026-09-14'), { date: '2026-09-14', academicYear: '2026-2027', status: 'term',
      term: { id: '2026-autumn', name: '秋季学期' }, week: 1, weekParity: '单周', phase: { kind: 'teaching', name: '教学' } })
    // The National Day holiday sits inside week 3; the official numbering does not shift.
    assert.equal(on('2026-10-01').week, 3)
    assert.equal(on('2026-10-01').phase.kind, 'teaching')
    assert.equal(on('2026-10-26').week, 7)
    assert.equal(on('2026-10-26').weekParity, '单周')
    assert.equal(on('2027-01-06').week, 17)
    assert.deepEqual(on('2027-01-06').phase, { kind: 'examination', name: '期末考试' })
    // 01-02 is the weekend inside teaching week 16, after teaching ends on 01-01: the week is stated, the phase is not.
    assert.equal(on('2027-01-02').week, 16)
    assert.equal(on('2027-01-02').weekParity, '双周')
    assert.equal(on('2027-01-02').phase, undefined)
    // Between the end of exams and the start of winter vacation the official calendar states nothing.
    assert.deepEqual(on('2027-01-16'), { date: '2027-01-16', academicYear: '2026-2027', status: 'unspecified' })
    assert.deepEqual(on('2027-01-20'), { date: '2027-01-20', academicYear: '2026-2027', status: 'break',
      break: { id: 'winter-2027', name: '寒假' } })
    assert.equal(on('2027-02-23').term.id, '2027-spring')
    assert.equal(on('2027-02-23').week, 1)
    assert.equal(on('2027-06-20').week, 17)
    assert.equal(on('2027-06-20').phase.kind, 'examination')
    const summer = on('2027-07-01')
    assert.equal(summer.term.id, '2027-summer-short')
    assert.equal(summer.week, undefined)
    assert.deepEqual(summer.phase, { kind: 'teaching', name: '短学期教学' })
    assert.equal(on('2027-07-24').status, 'unspecified')
  })
})

test('dataset validation rejects inconsistent transcriptions', async () => {
  const { validateDataset } = await import('../plugins/ecnu-calendar/lib/index.js')
  const broken = mutate => {
    const copy = structuredClone(dataset)
    mutate(copy)
    return validateDataset(copy)
  }
  assert.throws(() => broken(data => { data.terms.push({ ...data.terms[0], id: 'overlap' }) }), /重叠/)
  assert.throws(() => broken(data => { data.terms[0].phases[1].lastDay = '2027-01-20' }), /超出学期范围|重叠/)
  assert.throws(() => broken(data => { data.terms[0].weekCount = 17 }), /weekCount 与日期范围不符/)
  assert.throws(() => broken(data => { data.terms[0].phases[0].weeks = [2, 16] }), /起始日期与周号不符/)
  assert.throws(() => broken(data => { data.breaks[0].firstDay = '2027-01-10' }), /重叠/)
  assert.throws(() => broken(data => { data.terms[0].firstDay = '2026-9-14' }), /合法日期/)
  assert.ok(validateDataset(structuredClone(dataset)), 'the shipped dataset passes its own validation')
})
