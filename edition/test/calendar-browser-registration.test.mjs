import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const core = process.env.EDUWORK_CORE_ROOT
assert.ok(core, 'Set EDUWORK_CORE_ROOT to the explicit local core under test')
const require = createRequire(resolve(process.env.EDUWORK_TEST_RUNTIME, 'package.json'))
const { composeEntries } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')))
const { usePinnedBrowser } = await import(pathToFileURL(join(core, 'scripts/pinned-browser.mjs')))
const { mergeDistributionConfigPatches } = await import(pathToFileURL(join(core, 'scripts/distribution-config-patches.mjs')))

test('institution composition activates one browser registry alongside its provider', async () => {
  const base = usePinnedBrowser(JSON.parse(await readFile(join(core, 'config/distributions/generic.json'), 'utf8')))
  const edition = JSON.parse(await readFile(new URL('../distribution.json', import.meta.url), 'utf8'))
  const entry = plugin => ({ id: plugin.id, name: plugin.name, config: plugin.config ?? {} })
  const composition = mergeDistributionConfigPatches([
    { insert: base.plugins.map(entry) }, ...base.patches,
    { insert: edition.plugins.map(entry) },
  ], edition.patches, composeEntries)
  const active = composeEntries([composition], () => {}).filter(entry => entry.disabled !== true)
  assert.deepEqual(active.filter(entry => entry.name === '@deepseek-ai/dsh-browser-use').map(entry => entry.id), ['ecnu-browser-use'])
  assert.equal(active.filter(entry => entry.name === '@eduwork/dsh-browser-upstream').length, 1)
  assert.equal(active.some(entry => entry.id === 'eduwork-browser'), false)
})
