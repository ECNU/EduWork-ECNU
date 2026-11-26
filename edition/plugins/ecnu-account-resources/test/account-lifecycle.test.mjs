import test from 'node:test'
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import Resources from '../lib/index.js'
import { pointsResult, invitationResult, accountStateResult } from '../lib/typert-schemas.js'

async function fixture(t) {
  const ctx = new Context(), fibers = [], hooks = new Map(), calls = []
  let accountID = 'synthetic-account-a'
  const stage = async name => { calls.push(name); await hooks.get(name)?.() }
  class Accounts extends Service {
    constructor(ctx) { super(ctx, 'oidcAccounts') }
    async accountIdentity(profileID) { await stage('identity'); return accountID ? { profileID, accountID } : null }
    async configuration() { await stage('configuration'); return { profiles: [{ id: 'school', provider: { id: 'local-route' } }] } }
    async status() { await stage('status'); return { credentialReady: true } }
    async modelResourceFetch() { await stage('quota'); return Response.json({ provider_id: 'server-service', unit: 'credits', windows: [], resource_packs: [] }) }
    async modelAuthorization() { await stage('authorization'); return true }
    async authorizedFetch() { await stage('invitation'); return Response.json({ referralCode: 'SYNTHETIC', invite_url: 'https://example.org/invite/SYNTHETIC', expiresAt: '2099-01-01T00:00:00Z' }) }
  }
  class Reader extends Service {
    constructor(ctx) { super(ctx, 'ecnuAiconsole'); this.profileID = 'school' }
    async read() { await stage('points'); return { data: { currentPoints: 42 } } }
  }
  t.after(async () => { for (const fiber of fibers.reverse()) await fiber.dispose() })
  for (const plugin of [Accounts, Reader]) fibers.push(await ctx.plugin(plugin))
  fibers.push(await ctx.plugin(Resources, { profileIDs: ['school'], quotaProviderIDs: { school: 'server-service' }, points: { profileID: 'school', modelBaseURL: 'https://example.org/open/api/v1', workerBaseURL: 'https://example.org/api/worker/v1' } }))
  return { ctx, hooks, calls, service: ctx.ecnuAccountResources, change: value => { accountID = value },
    renew() { ctx.emit('credentials/reference-updated', { ref: 'SYNTHETIC_SESSION' }) },
    once(name, fn) { hooks.set(name, async () => { hooks.delete(name); await fn() }) },
  }
}

for (const [method, stages] of [['points', ['identity', 'status', 'points']], ['invitation', ['identity', 'status', 'authorization', 'invitation']], ['quota', ['identity', 'status', 'quota']]]) {
  for (const stage of stages) test(`${method} survives same-account token renewal during ${stage}`, async t => {
    const f = await fixture(t), before = await f.service.accountState('school')
    f.once(stage, () => f.renew())
    const result = await f.service[method]('school')
    assert.equal(result.state, 'available')
    assert.equal((await f.service.accountState('school')).accountRevision, before.accountRevision)
    if (method !== 'quota') {
      assert.equal(result.accountRevision, before.accountRevision)
      assert.equal((method === 'points' ? pointsResult : invitationResult).schema.safeParse(result).success, true)
    }
    assert.equal(JSON.stringify(result).includes('synthetic-account'), false)
  })
  for (const change of ['identity', 'logout', 'same-account-sign-in']) test(`${method} discards a late response after ${change} and can recover`, async t => {
    const f = await fixture(t), before = await f.service.accountState('school')
    f.once(method, () => {
      if (change === 'identity') { f.change('synthetic-account-b'); f.renew() }
      else f.ctx.emit('oidc/accounts-changed', { profileID: 'school', state: change === 'logout' ? 'signed_out' : 'connected', ...(change === 'same-account-sign-in' ? { authorizationChanged: true } : {}) })
    })
    assert.equal((await f.service[method]('school')).state, 'not_connected')
    assert.equal((await f.service[method]('school')).state, 'available')
    const after = await f.service.accountState('school')
    assert.notEqual(after.accountRevision, before.accountRevision)
    assert.equal(accountStateResult.schema.safeParse(after).success, true)
  })
  for (const timeoutStage of ['status', method]) test(`${method} timeout during ${timeoutStage} remains retryable without asking for login`, async t => {
    const f = await fixture(t), timeout = new AbortController()
    t.mock.method(AbortSignal, 'timeout', () => timeout.signal)
    f.once(timeoutStage, () => timeout.abort(new DOMException('Synthetic timeout', 'TimeoutError')))
    assert.equal((await f.service[method]('school')).state, 'unavailable')
  })
}

test('initial connected announcement and unrelated account event preserve current requests', async t => {
  const f = await fixture(t)
  f.once('status', () => {
    f.ctx.emit('oidc/accounts-changed', { profileID: 'school', state: 'connected' })
    f.ctx.emit('oidc/accounts-changed', { profileID: 'other', state: 'signed_out' })
  })
  assert.equal((await f.service.points('school')).state, 'available')
})

test('credential-triggered identity reconciliation cannot invalidate a newer account scope', async t => {
  const f = await fixture(t), entered = Promise.withResolvers(), release = Promise.withResolvers()
  t.after(() => release.resolve())
  await f.service.points('school')
  f.once('identity', async () => { entered.resolve(); await release.promise })
  f.renew(); await entered.promise
  f.ctx.emit('oidc/accounts-changed', { profileID: 'school', state: 'connected', authorizationChanged: true })
  f.change('synthetic-account-b')
  const next = await f.service.points('school')
  release.resolve()
  assert.equal(next.state, 'available')
  assert.equal((await f.service.points('school')).accountRevision, next.accountRevision)
})
