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
  // Terms run to the Sunday that ends their last numbered week: the official
  // calendar counts whole weeks, and exam weeks show as whole weeks too.
  assert.equal(autumn.lastDay, '2027-01-17')
  assert.equal(spring.lastDay, '2027-06-27')
  // The official grid numbers the short summer term 1 to 4; `shortTerm` keeps
  // its quiet band now that it carries week numbers like any other term.
  assert.equal(summer.firstDay, '2027-06-28')
  assert.equal(summer.lastDay, '2027-07-23')
  assert.equal(summer.weekCount, 4)
  assert.equal(summer.shortTerm, true)
  assert.deepEqual(summer.phases[0].weeks, [1, 4])
  assert.deepEqual(dataset.breaks, [
    { id: 'winter-2027', name: '寒假', firstDay: '2027-01-18', lastDay: '2027-02-20' },
    // The official grid paints 暑期 from the Monday after the short term to
    // the calendar's last day; the notes date no end, so the grid is the record.
    { id: 'summer-2027', name: '暑假', firstDay: '2027-07-26', lastDay: '2027-09-05' },
  ])
  assert.deepEqual(dataset.events.map(event => [event.uid, event.date, event.lastDay]), [
    ['autumn-registration-2026', '2026-09-13', undefined],
    ['undergraduate-arrival-2026', '2026-09-04', undefined],
    ['undergraduate-orientation-2026', '2026-09-05', '2026-09-18'],
    ['graduate-arrival-2026', '2026-09-11', undefined],
    ['graduate-orientation-2026', '2026-09-14', '2026-09-18'],
    ['makeup-exams-2026', '2026-09-07', '2026-09-11'],
    ['mid-autumn-2026', '2026-09-25', undefined],
    ['national-day-2026', '2026-10-01', undefined],
    ['sports-meet-2026', '2026-10-27', '2026-10-28'],
    ['campus-activity-day-2026', '2026-10-28', undefined],
    ['new-year-2027', '2027-01-01', undefined],
    ['spring-festival-2027', '2027-02-06', undefined],
    ['spring-registration-2027', '2027-02-21', undefined],
    ['womens-day-2027', '2027-03-08', undefined],
    ['qingming-2027', '2027-04-05', undefined],
    ['campus-activity-day-2027', '2027-04-21', undefined],
    ['labor-day-2027', '2027-05-01', undefined],
    ['dragon-boat-2027', '2027-06-09', undefined],
  ])
  // Festival entries state the named day only — never an inferred holiday span.
  for (const uid of ['mid-autumn-2026', 'national-day-2026', 'new-year-2027', 'spring-festival-2027', 'qingming-2027', 'labor-day-2027', 'dragon-boat-2027']) {
    assert.equal(dataset.events.find(event => event.uid === uid).lastDay, undefined, `${uid} must stay single-day`)
    assert.match(dataset.events.find(event => event.uid === uid).note, /学校通知/)
  }
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
    // Numbered teaching and exam phases are displayed as whole weeks.
    assert.equal(on('2027-01-02').week, 16)
    assert.equal(on('2027-01-02').weekParity, '双周')
    assert.equal(on('2027-01-02').phase.kind, 'teaching')
    // The weekend after the exams still belongs to week 18: terms cover whole
    // weeks, so the days before winter vacation keep their term and week.
    assert.equal(on('2027-01-16').week, 18)
    assert.equal(on('2027-01-16').weekParity, '双周')
    assert.equal(on('2027-01-16').phase.kind, 'examination')
    assert.equal(on('2027-01-17').term.id, '2026-autumn')
    assert.equal(on('2027-06-26').week, 18)
    assert.deepEqual(on('2027-01-20'), { date: '2027-01-20', academicYear: '2026-2027', status: 'break',
      break: { id: 'winter-2027', name: '寒假' } })
    assert.equal(on('2027-02-23').term.id, '2027-spring')
    assert.equal(on('2027-02-23').week, 1)
    assert.equal(on('2027-06-20').week, 17)
    assert.equal(on('2027-06-20').phase.kind, 'examination')
    const summer = on('2027-07-01')
    assert.equal(summer.term.id, '2027-summer-short')
    assert.equal(summer.week, 1)
    assert.equal(summer.weekParity, '单周')
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
  assert.throws(() => broken(data => { data.breaks[1].firstDay = '2027-07-22' }), /重叠/, 'summer break must not reach into the short term')
  assert.throws(() => broken(data => { data.events[2].lastDay = '2026-09-04' }), /lastDay 早于 date/)
  assert.throws(() => broken(data => { data.events[0].note = 7 }), /note 必须是文本/)
  assert.throws(() => broken(data => { data.terms[0].firstDay = '2026-9-14' }), /合法日期/)
  assert.throws(() => broken(data => { data.terms[0].firstDay = '2026-09-15' }), /周一/)
  assert.throws(() => broken(data => { data.terms[2].shortTerm = 'yes' }), /shortTerm 必须是布尔值/)
  assert.throws(() => broken(data => { data.terms[2].weekCount = 3 }), /weekCount 与日期范围不符/)
  assert.ok(validateDataset(structuredClone(dataset)), 'the shipped dataset passes its own validation')
})

test('the dataset becomes calendar annotations: week labels and phase bands', async () => {
  const { annotationsForDataset } = await import('../plugins/ecnu-calendar/lib/index.js')
  const answer = annotationsForDataset(dataset, { from: '2027-01-04', to: '2027-01-31' })
  // The January window opens on examination week 17, numbers both examination
  // weeks, and ends inside winter vacation; teaching week 16 ended on 01-03
  // and is not part of this range.
  assert.deepEqual(answer.weeks, [
    { firstDay: '2027-01-04', text: '第 17 周 · 考试周', tone: 'highlight' },
    { firstDay: '2027-01-11', text: '第 18 周 · 考试周', tone: 'highlight' },
  ])
  assert.deepEqual(answer.spans, [
    // The examination band carries its term: its weeks label themselves 考试周,
    // so the band is where an exam week keeps its semester context.
    { firstDay: '2027-01-04', lastDay: '2027-01-17', text: '2026-2027 秋季学期 · 期末考试', tone: 'highlight' },
    { firstDay: '2027-01-18', lastDay: '2027-01-31', text: '寒假', tone: 'quiet' },
  ])
  const summer = annotationsForDataset(dataset, { from: '2027-07-01', to: '2027-07-10' })
  assert.deepEqual(summer.weeks, [
    { firstDay: '2027-06-28', text: '第 1 周 · 单周' },
    { firstDay: '2027-07-05', text: '第 2 周 · 双周' },
  ], 'the short summer term carries the weeks the official grid numbers')
  assert.deepEqual(summer.spans, [{ firstDay: '2027-07-01', lastDay: '2027-07-10', text: '2026-2027 暑期短学期', tone: 'quiet' }])
})

test('whole-school matters become all-day events; festivals stay single-day', async () => {
  const { eventsForDataset } = await import('../plugins/ecnu-calendar/lib/index.js')
  const events = eventsForDataset(dataset)
  assert.equal(events.length, dataset.events.length)
  const sports = events.find(event => event.uid === 'sports-meet-2026')
  assert.equal(sports.title, '校运动会')
  assert.deepEqual([sports.start, sports.end], ['2026-10-27', '2026-10-28'])
  assert.match(sports.description, /停课/)
  const orientation = events.find(event => event.uid === 'undergraduate-orientation-2026')
  assert.deepEqual([orientation.start, orientation.end], ['2026-09-05', '2026-09-18'])
  const national = events.find(event => event.uid === 'national-day-2026')
  assert.equal(national.end, undefined, 'a festival marks the named day, not an inferred span')
  assert.equal(national.description, '放假安排以学校通知为准')
})

test('with the public calendar present, the plugin registers annotations and pushes its matters as events', async () => {
  const [cordis, hub, json, domain, calendar] = await Promise.all([
    load('@deepseek-ai/cordis'), load('@deepseek-ai/dsh-storage'), load('@deepseek-ai/dsh-storage-json'),
    load('@deepseek-ai/dsh-storage-domain'), import(pathToFileURL(resolve(core, 'dsh-plugins/calendar/lib/index.js'))),
  ])
  const plugin = await import('../plugins/ecnu-calendar/lib/index.js')
  const root = await mkdtemp(join(tmpdir(), 'ecnu-calendar-annotations-'))
  const ctx = new cordis.Context()
  try {
    await ctx.plugin(hub.default ?? hub)
    await ctx.plugin(json, { root: join(root, 'storages') })
    await ctx.plugin(domain, { backend: 'json' })
    await ctx.plugin(calendar.CalendarService)
    const { default: AcademicCalendar } = await import('@eduwork/dsh-academic-calendar')
    await ctx.plugin(AcademicCalendar)
    await ctx.academicCalendar.ready
    await ctx.plugin(plugin.default)
    await ctx.ecnuCalendar.ready
    await ctx.ecnuCalendar.integration
    const answer = await ctx.calendar.annotationsFor({ from: '2026-10-26', to: '2026-11-01' })
    assert.deepEqual(answer.weeks, [{ firstDay: '2026-10-26', text: '第 7 周 · 单周' }])
    assert.equal(answer.spans.length, 1)
    assert.equal(answer.spans[0].text, '2026-2027 秋季学期')
    // The pushed snapshot writes through the store asynchronously; the source
    // flips to ready only when the whole batch has landed.
    const started = Date.now()
    let own
    while (!(own = ctx.calendar.sourceStatuses().find(status => status.label === 'ECNU 2026-2027 本科校历')) || own.state !== 'ready') {
      if (Date.now() - started > 3000) throw new Error('the academic calendar source never became ready')
      await new Promise(resolve => setTimeout(resolve, 25))
    }
    const events = ctx.calendar.snapshot().events
    assert.equal(events.length, dataset.events.length)
    const sources = new Set(events.map(event => event.source))
    assert.equal(sources.size, 1, 'every matter comes from one academic-calendar source')
    assert.equal([...sources][0], own.source)
    const sports = events.find(event => event.uid === 'sports-meet-2026')
    assert.deepEqual([sports.start, sports.end], ['2026-10-27', '2026-10-28'])
  } finally {
    await ctx.fiber.dispose()
    const target = resolve(root)
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('ecnu-calendar-annotations-'))
    await rm(target, { recursive: true, force: true })
  }
})
