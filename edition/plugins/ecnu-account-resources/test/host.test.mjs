import test from 'node:test'
import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { fixture } from './helpers/oidc-http-fixture.mjs'
import { Context, Service } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
const require = createRequire(import.meta.url)
const publicRoot = resolve(process.env.DSH_OIDC_PACKAGE_ROOT || dirname(require.resolve('@eduwork/dsh-oidc/package.json')))
const extensionRoot = resolve(process.env.ECNU_ACCOUNT_PACKAGE_ROOT || fileURLToPath(new URL('../', import.meta.url)))
const { default: EcnuResources } = await import(pathToFileURL(resolve(extensionRoot, 'lib/index.js')))
const { normalizeQuota, resolveQuotaProviderIDs } = await import(pathToFileURL(resolve(extensionRoot, 'lib/quota.js')))
const { quotaResult } = await import(pathToFileURL(resolve(extensionRoot, 'lib/typert-schemas.js')))
const { default: TYPERT } = await import(pathToFileURL(resolve(extensionRoot, 'lib/typert.host.js')))
const { default: Oidc } = await import(pathToFileURL(resolve(publicRoot, 'lib/index.js')))
const { TYPERT: publicTypes } = await import(pathToFileURL(resolve(publicRoot, 'lib/typert.host.js')))

const raw = { provider_id: 'fixture-ai', unit: 'credits', windows: [
  { type: 'fixed_168h', limit: 100, used: 10, remaining: 90, reset_at: '2026-09-17T00:00:00Z' },
], resource_packs: [
  { id: 1, name: 'Research pack', total_credits: 1000, used_credits: 70, remaining_credits: 930, expires_at: '2027-01-01T00:00:00Z', status: 'active' },
  { id: 2, name: 'Supplement', remaining_credits: 55 },
], ops_console_url: 'https://example.org/allowance' }

async function host(t, options = {}, profileIDs = ['desktop-test'], extensionConfig = {}) {
  const f = await fixture(t, { resources: true, quota: raw, ...options })
  const opened = [], records = new Map([['PERSONAL_API_KEY', 'personal-test-key']])
  class Credentials extends Service {
    constructor(ctx) { super(ctx, 'credentials') }
    resolve(ref) { return Promise.resolve(records.has(ref) ? { value: records.get(ref) } : undefined) }
    set(ref, value) { records.set(ref, value); this.ctx.emit('credentials/reference-updated', { ref }); return Promise.resolve() }
    unset(ref) { records.delete(ref); this.ctx.emit('credentials/reference-updated', { ref }); return Promise.resolve() }
  }
  class DesktopServices extends Service {
    constructor(ctx) { super(ctx, 'desktopServices') }
    openExternal(url) { opened.push(url); return Promise.resolve() }
  }
  const ctx = new Context(), fibers = []
  t.after(async () => { for (const fiber of fibers.reverse()) await fiber.dispose() })
  for (const plugin of [LlmRuntime, Credentials, DesktopServices]) fibers.push(await ctx.plugin(plugin))
  fibers.push(await ctx.plugin(Oidc, { backend: 'desktop', profile: f.rawProfile }))
  fibers.push(await ctx.plugin(EcnuResources, { profileIDs, ...extensionConfig }))
  return { ...f, ctx, records, async login() {
    await ctx.oidcAccounts.begin('desktop-test')
    const callback = await fetch(opened.at(-1))
    assert.equal(callback.status, 200)
    assert.equal((await ctx.oidcAccounts.status('desktop-test')).state, 'connected')
    assert.equal((await ctx.oidcAccounts.status('desktop-test')).credentialReady, true)
  } }
}

test('normalization preserves windows, dates and pack details; missing totals stay unknown', () => {
  const value = quotaResult.schema.parse(normalizeQuota(raw, 'fixture-ai'))
  assert.equal(value.windows[0].resetAt, raw.windows[0].reset_at)
  assert.deepEqual(value.resourcePacks[0], { id: '1', name: 'Research pack', total: 1000, used: 70, remaining: 930, expiresAt: raw.resource_packs[0].expires_at, status: 'active' })
  assert.equal(value.resourcePacks[1].remaining, 55)
  assert.equal(value.resourcePacks[1].total, null)
  assert.equal(value.resourcePacks[1].used, null)
  assert.equal(normalizeQuota({ ...raw, ops_console_url: 'javascript:alert(1)' }, 'fixture-ai').consoleURL, undefined)
  assert.throws(() => normalizeQuota(raw, 'other-provider'), /mismatch/)
  assert.throws(() => normalizeQuota({ ...raw, windows: [{ remaining: -1 }] }, 'fixture-ai'))
})

test('server quota IDs can only be explicitly mapped to configured profiles', () => {
  const mapping = resolveQuotaProviderIDs(['desktop-test'], { 'desktop-test': 'quota-service' })
  assert.equal(mapping.get('desktop-test'), 'quota-service')
  const quota = normalizeQuota({ ...raw, provider_id: 'quota-service' }, 'local-model-route', mapping.get('desktop-test'))
  assert.equal(quota.providerID, 'local-model-route')
  assert.equal(quota.windows[0].remaining, 90)
  assert.throws(() => normalizeQuota(raw, 'local-model-route', 'quota-service'), /mismatch/)
  for (const invalid of [null, [], 'service', 42, { 'unknown-profile': 'service' }, { 'desktop-test': '' }, { 'desktop-test': 1 }, { 'desktop-test': ' spaced ' }, { 'desktop-test': 'a'.repeat(65) }, Object.create({ 'desktop-test': 'service' }), { [Symbol('profile')]: 'service' }]) {
    assert.throws(() => resolveQuotaProviderIDs(['desktop-test'], invalid), /quotaProviderIDs/)
  }
  for (const key of ['__proto__', 'prototype', 'constructor']) {
    assert.throws(() => resolveQuotaProviderIDs([key], JSON.parse(`{"${key}":"service"}`)), /quotaProviderIDs/)
  }
})

for (const serverID of ['quota-service', 'unexpected-service']) test(`real Host ${serverID === 'quota-service' ? 'accepts the explicitly mapped quota namespace' : 'rejects a different quota namespace'}`, async t => {
  const f = await host(t, { quota: { ...raw, provider_id: serverID } }, ['desktop-test'], { quotaProviderIDs: { 'desktop-test': 'quota-service' } })
  await f.login()
  const quota = await f.ctx.ecnuAccountResources.quota('desktop-test')
  assert.equal(quota.state, serverID === 'quota-service' ? 'available' : 'unavailable')
  if (quota.state === 'available') {
    assert.equal(quota.providerID, 'fixture-ai')
    assert.equal(quota.windows[0].remaining, 90)
    assert.throws(() => normalizeQuota({ ...raw, provider_id: serverID }, 'fixture-ai'), /mismatch/)
  }
  assert.equal((await f.ctx.oidcAccounts.status('desktop-test')).credentialReady, true)
  assert.equal(f.requests.filter(r => r.path.endsWith('/quota')).length, 1)
})

test('real RC Host: no implicit public quota; explicit ECNU request uses the authorized access token', async t => {
  const f = await host(t)
  assert.deepEqual(await f.ctx.ecnuAccountResources.quota('third-party'), { state: 'not_configured' })
  assert.deepEqual(await f.ctx.ecnuAccountResources.quota('desktop-test'), { state: 'not_connected' })
  assert.equal(f.requests.length, 0)
  await f.login()
  assert.deepEqual(Object.keys(await f.ctx.oidcAccounts.resources('desktop-test')).sort(), ['issues', 'modelSource', 'models', 'profileID'])
  assert.equal(f.requests.some(r => r.path.endsWith('/quota')), false)
  const quota = await f.ctx.ecnuAccountResources.quota('desktop-test')
  assert.equal(quota.state, 'available'); assert.equal(quota.windows[0].remaining, 90)
  assert.equal(quota.resourcePacks.length, 2)
  assert.equal(f.requests.filter(r => r.path.endsWith('/quota')).length, 1)
  await f.ctx.oidcAccounts.logout('desktop-test')
  assert.deepEqual(await f.ctx.ecnuAccountResources.quota('desktop-test'), { state: 'not_connected' })
  assert.deepEqual([...f.records], [['PERSONAL_API_KEY', 'personal-test-key']])
})

test('an ECNU edition does not query quota for a connected non-allowlisted enterprise', async t => {
  const f = await host(t, {}, ['ecnu'])
  await f.login()
  assert.deepEqual(await f.ctx.ecnuAccountResources.quota('desktop-test'), { state: 'not_configured' })
  assert.deepEqual(await f.ctx.ecnuAccountResources.quota('ecnu'), { state: 'not_configured' })
  assert.equal(f.requests.some(r => r.path.endsWith('/quota')), false)
})

for (const change of ['logout', 'credential-change', 'account-event']) test(`late quota after ${change} follows the verified account identity`, async t => {
  let release, entered
  const blocked = new Promise(resolve => { release = resolve }), started = new Promise(resolve => { entered = resolve })
  t.after(() => release())
  const f = await host(t, { beforeQuota: async () => { entered(); await blocked } })
  await f.login()
  const pending = f.ctx.ecnuAccountResources.quota('desktop-test')
  await started
  if (change === 'logout') await f.ctx.oidcAccounts.logout('desktop-test')
  else if (change === 'credential-change') await f.ctx.credentials.set('FIXTURE_AI_API_KEY', 'new-account-key')
  else f.ctx.emit('oidc/accounts-changed', { profileID: 'desktop-test', state: 'signed_out' })
  release()
  const result = await pending
  // Replacing a credential under the same verified OIDC identity is a renewal,
  // while logout or an explicit account event invalidates the pending result.
  if (change === 'credential-change') {
    assert.equal(result.state, 'available')
    assert.equal(result.windows[0].remaining, 90)
  } else assert.deepEqual(result, { state: 'not_connected' })
})

test('quota wire validation failure does not break identity or managed models', async t => {
  const f = await host(t, { quota: { ...raw, provider_id: 'another-organization' } })
  await f.login()
  assert.deepEqual(await f.ctx.ecnuAccountResources.quota('desktop-test'), { state: 'unavailable' })
  assert.equal((await f.ctx.oidcAccounts.status('desktop-test')).credentialReady, true)
  const call = await f.ctx.llm.resolveCallConfig({ provider: 'fixture-ai', model: 'fixture-model' })
  assert.equal(call.provider, 'fixture-ai')
  const chunks = []
  for await (const chunk of f.ctx.llm.stream({ ...call, messages: [] })) chunks.push(chunk)
  assert.ok(chunks.some(chunk => chunk.type === 'text-delta'))
  assert.ok(!chunks.some(chunk => chunk.type === 'finish' && chunk.reason?.kind === 'error'))
})

test('wire descriptors are isolated: public has no quota field or Host credential transport invocation', () => {
  assert.deepEqual(TYPERT.invocations.map(v => v.method), ['configuration', 'quota', 'points', 'invitation', 'accountState'])
  assert.equal(publicTypes.invocations.some(v => ['quota', 'modelResourceFetch', 'authorizedFetch'].includes(v.method)), false)
  const resources = publicTypes.invocations.find(v => v.method === 'resources')
  assert.equal(resources.result.schema.safeParse({ profileID: 'ecnu', modelSource: 'profile', models: [], issues: [], quota: {} }).success, false)
})

test('explicit empty allowlist disables all extension requests', async t => {
  const f = await host(t, {}, [])
  await f.login()
  assert.deepEqual(await f.ctx.ecnuAccountResources.configuration(), { profileIDs: [] })
  assert.deepEqual(await f.ctx.ecnuAccountResources.quota('desktop-test'), { state: 'not_configured' })
  assert.equal(f.requests.some(r => r.path.endsWith('/quota')), false)
})

test('an account event during the final status read invalidates the normalized quota', async t => {
  const ctx = new Context(), reached = Promise.withResolvers(), release = Promise.withResolvers()
  let reads = 0
  class Accounts extends Service {
    constructor(ctx) { super(ctx, 'oidcAccounts') }
    configuration() { return Promise.resolve({ profiles: [{ id: 'ecnu', provider: { id: 'fixture-ai' } }] }) }
    async status() { if (++reads === 2) { reached.resolve(); await release.promise }; return { credentialReady: true } }
    modelResourceFetch() { return Promise.resolve(Response.json(raw)) }
  }
  const accountFiber = await ctx.plugin(Accounts), quotaFiber = await ctx.plugin(EcnuResources)
  t.after(async () => { release.resolve(); await quotaFiber.dispose(); await accountFiber.dispose() })
  const pending = ctx.ecnuAccountResources.quota('ecnu')
  await reached.promise
  ctx.emit('oidc/accounts-changed', { profileID: 'ecnu', state: 'signed_out' })
  release.resolve()
  assert.deepEqual(await pending, { state: 'not_connected' })
})

for (const failingMethod of ['configuration', 'status', 'modelResourceFetch']) test(`quota recovers after a transient ${failingMethod} failure`, async t => {
  const ctx = new Context(); let fail = true
  const check = method => { if (fail && method === failingMethod) throw new Error('synthetic temporary failure') }
  class Accounts extends Service {
    constructor(ctx) { super(ctx, 'oidcAccounts') }
    async configuration() { check('configuration'); return { profiles: [{ id: 'ecnu', provider: { id: 'fixture-ai' } }] } }
    async status() { check('status'); return { credentialReady: true } }
    async modelResourceFetch() { check('modelResourceFetch'); return Response.json(raw) }
  }
  const accountFiber = await ctx.plugin(Accounts), quotaFiber = await ctx.plugin(EcnuResources)
  t.after(async () => { await quotaFiber.dispose(); await accountFiber.dispose() })
  assert.deepEqual(await ctx.ecnuAccountResources.quota('ecnu'), { state: 'unavailable' })
  fail = false
  const recovered = await ctx.ecnuAccountResources.quota('ecnu')
  assert.equal(recovered.state, 'available'); assert.equal(recovered.windows[0].remaining, 90)
})

for (const pendingMethod of ['configuration', 'status']) test(`an account event during initial ${pendingMethod} prevents a stale quota request`, async t => {
  const ctx = new Context(), reached = Promise.withResolvers(), release = Promise.withResolvers(); let requests = 0
  const wait = async method => { if (method === pendingMethod) { reached.resolve(); await release.promise } }
  class Accounts extends Service {
    constructor(ctx) { super(ctx, 'oidcAccounts') }
    async configuration() { await wait('configuration'); return { profiles: [{ id: 'ecnu', provider: { id: 'fixture-ai' } }] } }
    async status() { await wait('status'); return { credentialReady: true } }
    async modelResourceFetch() { requests++; return Response.json(raw) }
  }
  const accountFiber = await ctx.plugin(Accounts), quotaFiber = await ctx.plugin(EcnuResources)
  t.after(async () => { release.resolve(); await quotaFiber.dispose(); await accountFiber.dispose() })
  const pending = ctx.ecnuAccountResources.quota('ecnu')
  await reached.promise
  ctx.emit('oidc/accounts-changed', { profileID: 'ecnu', state: 'signed_out' })
  release.resolve()
  assert.deepEqual(await pending, { state: 'not_connected' })
  assert.equal(requests, 0)
})
