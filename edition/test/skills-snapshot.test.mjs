import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

for (const mac of [false, true]) test('stage all publisher Skills from a verified ' + (mac ? 'Mac' : 'Windows') + ' product', async t => {
  const tmp = await mkdtemp(join(tmpdir(), 'school-snapshot-'))
  t.after(() => rm(tmp, { recursive: true, force: true }))
  const app = join(tmp, mac ? 'School.app' : 'School')
  const resources = mac ? 'Contents/Resources' : 'resources'
  const product = resources + '/product', prefix = product + '/skills/'
  const put = async (path, data) => {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, data)
  }
  const files = []
  for (const [name, text] of [
    ['calendar-management/SKILL.md', '[校历](<../../resources/calendar/guide.md>)'],
    ['other/SKILL.md', 'kept'], ['shared/references/data.md', 'reference'],
  ]) {
    await put(join(app, prefix, name), text)
    files.push({ path: prefix + name, sha256: createHash('sha256').update(text).digest('hex') })
  }
  await put(join(app, product, 'resources/calendar/guide.md'), 'school guide')
  await put(join(app, mac ? resources + '/bundled-skills.json' : 'RELEASE-MANIFEST.json'), JSON.stringify({ files }))
  const requires = join(tmp, 'requires.json'), out = join(tmp, 'staged')
  await put(requires, JSON.stringify({ minClient: '0.4.14', capabilities: [] }))
  const run = target => execFileSync(process.execPath, [fileURLToPath(new URL('../release/prepare-skills-snapshot.mjs', import.meta.url)),
    '--app', app, '--core', process.env.EDUWORK_CORE_ROOT, '--output', target, '--revision', '1', '--requires', requires], { stdio: 'pipe' })
  run(out)
  const read = path => readFile(join(out, path), 'utf8')
  const component = JSON.parse(await read('skills.json'))
  assert.deepEqual(component.entries.map(x => x.name).sort(), ['calendar-management', 'ecnu-music', 'other'])
  assert.equal(await read('skills/shared/references/data.md'), 'reference')
  assert.match(await read('skills/calendar-management/SKILL.md'), /<references\/ecnu-guide\.md>/)
  assert.equal(await read('skills/calendar-management/references/ecnu-guide.md'), 'school guide')
  assert.match(await read('skills/ecnu-music/references/workflows.md'), /"n": 1/)
  await put(join(app, prefix, 'other/SKILL.md'), 'modified')
  assert.throws(() => run(join(tmp, 'new')), /内置 Skills 存在本地修改/)
})
