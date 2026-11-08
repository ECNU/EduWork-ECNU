import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const runtime = process.env.EDUWORK_TEST_RUNTIME
assert.ok(runtime, 'Set EDUWORK_TEST_RUNTIME to the assembled school product d directory')
const product = dirname(resolve(runtime)), require = createRequire(join(runtime, 'package.json'))
const json = async path => JSON.parse(await readFile(path, 'utf8'))
const boot = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-app-boot')))
const { loadDistributionBundleLayers } = await import(pathToFileURL(resolve(process.env.EDUWORK_CORE_ROOT, 'scripts/distribution-config-patches.mjs')))
const identity = await json(join(product, 'assembly.json'))
const bundles = await loadDistributionBundleLayers(runtime, identity.bundles, boot)
const composition = await json(join(product, 'composition.json'))
const policy = await json(join(runtime, 'node_modules/@deepseek-ai/dsh-desktop-host/lib/distribution-policy.patch.json'))
function active(entries, enabled = true) {
  return entries.flatMap(entry => {
    const on = enabled && !entry.disabled
    return entry.group ? active(entry.config, on) : on ? [entry] : []
  })
}
const rows = preferences => active(boot.composeEntries([...bundles, composition, preferences, policy]))

test('school product has one official browser provider and browser-use service, with school search', () => {
  const entries = rows([])
  assert.deepEqual(entries.filter(row => row.name === '@eduwork/dsh-browser-upstream').map(row => row.id), ['ecnu-browser'])
  assert.deepEqual(entries.filter(row => row.name === '@deepseek-ai/dsh-browser-use').map(row => row.id), ['ecnu-browser-use'])
  assert.equal(entries.find(row => row.id === 'web').config.searchProvider, 'ecnu-worker')
  assert.ok(entries.some(row => row.id === 'chatecnu-campus-search'))
  assert.equal(entries.some(row => row.id === 'eduwork-search'), false)
  assert.equal(entries.some(row => row.name === '@eduwork/ecnu-browser-upstream'), false)
  assert.ok(require.resolve('@eduwork/dsh-browser-upstream'))
})

test('old school browser activation choices survive while retired public entries cannot duplicate services', () => {
  for (const id of ['ecnu-browser', 'ecnu-browser-use']) {
    const entries = rows([{ id, disabled: true }, ...['eduwork-browser', 'eduwork-search', 'eduwork-browser-use'].map(id => ({ id, disabled: false }))])
    assert.equal(entries.some(row => row.id === id), false)
    assert.equal(entries.some(row => ['eduwork-browser', 'eduwork-search', 'eduwork-browser-use'].includes(row.id)), false)
  }
  assert.equal(rows([{ id: 'ecnu-browser', disabled: false }]).filter(row => row.id === 'ecnu-browser').length, 1)
})

test('school browser follows public ordinary-action and explicit-risk permissions', async () => {
  // Inspect the policy actually installed in the school product. Mounting the
  // real browser also requires workingDirectory and per-Agent resources; do
  // not emulate that lifecycle with an obsolete single-hook fake Context.
  const entry = require.resolve('@eduwork/dsh-browser-upstream')
  const { browserGuard, browserPermission } = await import(pathToFileURL(join(dirname(entry), 'permission.js')))
  let mode = 'workspace-write'
  const ctx = { sandboxPolicy: { resolve: () => ({ mode }) } }
  const exec = (name, args = {}) => ({ name: 'mcp__playwright-mcp__' + name, agent: { session: {} }, arguments: args })
  assert.match(browserGuard(ctx, exec('browser_run_code_unsafe')), /full access/)
  assert.equal(browserPermission(ctx, exec('browser_click'), () => 'continue'), 'continue')
  assert.equal(browserPermission(ctx, exec('browser_snapshot'), () => 'continue'), 'continue')
  assert.equal(browserPermission(ctx, exec('browser_evaluate'), () => 'continue').kind, 'ask')
  assert.equal(browserPermission(ctx, exec('browser_navigate', { url: 'http://127.0.0.1/admin' }), () => 'continue').kind, 'ask')
  mode = 'danger-full-access'
  assert.equal(browserGuard(ctx, exec('browser_run_code_unsafe')), undefined)
  assert.equal(browserPermission(ctx, exec('browser_click'), () => 'continue'), 'continue')
})
