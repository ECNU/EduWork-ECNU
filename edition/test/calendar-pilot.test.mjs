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
const load = name => import(pathToFileURL(require.resolve(name)))

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

async function withCalendar(root, run) {
  const [{ Context }, hub, json, domain, calendar] = await Promise.all([
    load('@deepseek-ai/cordis'), load('@deepseek-ai/dsh-storage'), load('@deepseek-ai/dsh-storage-json'),
    load('@deepseek-ai/dsh-storage-domain'), import(pathToFileURL(resolve(core, 'dsh-plugins/calendar/lib/index.js'))),
  ])
  const ctx = new Context()
  try {
    await ctx.plugin(hub.default ?? hub)
    await ctx.plugin(json, { root: join(root, 'storages') })
    await ctx.plugin(domain, { backend: 'json' })
    await ctx.plugin(calendar.CalendarService)
    return await run(ctx)
  } finally { await ctx.fiber.dispose() }
}

test('an older bundled edition keeps a newer calendar cache visible without downgrading it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ecnu-calendar-pilot-'))
  try {
    const plugin = await import('../plugins/ecnu-calendar/lib/index.js')
    const data = JSON.parse(await readFile(new URL('../plugins/ecnu-calendar/data/2026-2027.json', import.meta.url), 'utf8'))
    await withCalendar(root, async ctx => {
      const source = ctx.calendar.registerSource({ provider: 'ecnu.edu.cn', account: 'public', feed: 'academic-calendar:2026-2027' })
      await source.apply({ complete: true, revision: data.revision + 1, events: [{ uid: 'exam', title: 'Newer school notice', start: '2027-01-05' }] })
      source.dispose()
      await ctx.plugin(plugin)
      assert.equal(ctx.calendar.snapshot().events[0]?.title, 'Newer school notice')
    })
  } finally {
    assert.ok(resolve(root).startsWith(resolve(tmpdir()) + sep) && basename(root).startsWith('ecnu-calendar-pilot-'))
    await rm(root, { recursive: true, force: true })
  }
})

test('ECNU initialization shows its bundled calendar before any conversation and survives restart without duplicates', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ecnu-calendar-pilot-'))
  try {
    const plugin = await import('../plugins/ecnu-calendar/lib/index.js')
    let source, count
    await withCalendar(root, async ctx => {
      await ctx.calendar.putEvent({ uid: 'autumn-week-01', title: 'My plan', start: '2026-09-14' })
      await ctx.plugin(plugin)
      const school = ctx.calendar.snapshot().events.filter(event => event.source !== 'manual')
      count = school.length
      assert.ok(count >= 36)
      source = school[0].source
      assert.equal(school.find(event => event.uid === 'autumn-week-01').start, '2026-09-14')
      assert.equal(school.find(event => event.uid === 'spring-week-01').start, '2027-02-22')
      await ctx.calendar.putNote({ source, uid: 'autumn-week-01', text: 'My private note' })
    })
    await withCalendar(root, async ctx => {
      assert.equal(ctx.calendar.snapshot().events.length, 1, 'managed cache is hidden until the edition registers it')
      await ctx.plugin(plugin)
      assert.equal(ctx.calendar.snapshot().events.length, count + 1)
      assert.equal(ctx.calendar.notes({ source, uid: 'autumn-week-01' })[0].note.text, 'My private note')
    })
  } finally {
    const target = resolve(root)
    assert.ok(target.startsWith(resolve(tmpdir()) + sep) && basename(target).startsWith('ecnu-calendar-pilot-'))
    await rm(target, { recursive: true, force: true })
  }
})
