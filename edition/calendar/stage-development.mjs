// Called on a disposable edition worktree for development candidates.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [coreArg, editionArg] = process.argv.slice(2)
if (!coreArg || !editionArg) throw Error('Expected the pinned core and a disposable edition worktree')
const core = resolve(coreArg), edition = resolve(editionArg)
const read = async path => JSON.parse(await readFile(path, 'utf8'))
const head = directory => execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const lock = await read(join(edition, 'core.lock.json'))
assert.equal(head(core), lock.commit)
assert.equal((await read(join(core, 'source-receipt.json'))).fileSetSHA256, lock.sourceFileSetSHA256)
const distributionPath = join(edition, 'edition/distribution.json')
const distribution = await read(distributionPath)
const overlay = await read(join(edition, 'edition/calendar/development.json'))
const { copyDshPackagePayload } = await import(pathToFileURL(join(core, 'scripts/lib/dsh-packages.mjs')))
const tools = []
for (const [id, folder] of [
  ['calendar', 'dsh-plugins/calendar'],
  ['calendar-subscriptions', 'dsh-plugins/calendar-subscriptions'],
  ['academic-calendar', 'packages/dsh-academic-calendar'],
]) {
  const name = '@eduwork/dsh-' + id
  const source = 'dist/calendar-dev/' + id
  assert.equal((await read(join(core, folder, 'package.json'))).name, name)
  await copyDshPackagePayload(join(core, folder), join(edition, source))
  distribution.plugins.push({ id, root: 'edition', source, name })
  tools.push({ id: id + '-tools', name: name + '/tools' })
}
distribution.plugins.push(...overlay.plugins)
distribution.patches.push({ insert: tools })
distribution.skills.push(...overlay.skills)
await writeFile(distributionPath, JSON.stringify(distribution, null, 2) + '\n')
console.log('Calendar development inputs staged from public core', lock.commit)
