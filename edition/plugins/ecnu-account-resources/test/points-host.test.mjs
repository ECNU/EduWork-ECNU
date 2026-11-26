import test from 'node:test'
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import Resources from '../lib/index.js'

test('real Cordis mount: optional reader enables points/invitation and removal cancels pending reads without removing quota', async t => {
  const ctx = new Context(), fibers = [], reads = [], requests = []
  let pause
  class Accounts extends Service {
    constructor(ctx) { super(ctx, 'oidcAccounts') }
    async configuration() { return { profiles: [{ id: 'school', provider: { id: 'school-ai' } }] } }
    async status() { return { credentialReady: true } }
    async modelAuthorization() { return true }
    async modelResourceFetch() { return Response.json({ provider_id: 'school-ai', unit: 'credits', windows: [], resource_packs: [] }) }
    async authorizedFetch(...args) { requests.push(args); return Response.json({ referralCode: 'SYNTHETIC', invite_url: 'https://example.org/html/#/invite/SYNTHETIC', expiresAt: '2099-01-01T00:00:00Z' }) }
  }
  class Reader extends Service {
    constructor(ctx) { super(ctx, 'ecnuAiconsole'); this.profileID = 'school' }
    async read(...args) { reads.push(args); if (pause) { pause.enter.resolve(); await pause.release.promise }; return { data: { currentPoints: 42 } } }
  }
  t.after(async () => { pause?.release.resolve(); for (const fiber of fibers.reverse()) await fiber.dispose() })
  fibers.push(await ctx.plugin(Accounts))
  fibers.push(await ctx.plugin(Resources, { profileIDs: ['school'], points: { profileID: 'school', modelBaseURL: 'https://example.org/open/api/v1', workerBaseURL: 'https://example.org/api/worker/v1' } }))
  assert.equal((await ctx.ecnuAccountResources.quota('school')).state, 'available')
  assert.equal((await ctx.ecnuAccountResources.points('school')).state, 'not_configured')
  assert.equal((await ctx.ecnuAccountResources.invitation('school')).state, 'not_configured')
  const readerFiber = await ctx.plugin(Reader); fibers.push(readerFiber)
  assert.equal((await ctx.ecnuAccountResources.points('school')).currentPoints, 42)
  assert.equal(reads[0][0], 'account_get_points')
  assert.equal((await ctx.ecnuAccountResources.invitation('school')).state, 'available')
  assert.equal(requests.length, 1)
  pause = { enter: Promise.withResolvers(), release: Promise.withResolvers() }
  const pending = ctx.ecnuAccountResources.points('school'); await pause.enter.promise
  await readerFiber.dispose(); pause.release.resolve()
  assert.equal((await pending).state, 'not_connected')
  assert.equal((await ctx.ecnuAccountResources.points('school')).state, 'not_configured')
  assert.equal((await ctx.ecnuAccountResources.quota('school')).state, 'available')
  pause = undefined
  fibers.push(await ctx.plugin(Reader))
  assert.equal((await ctx.ecnuAccountResources.points('school')).currentPoints, 42)
})
