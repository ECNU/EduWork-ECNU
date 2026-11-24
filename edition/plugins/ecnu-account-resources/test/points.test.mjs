import test from 'node:test'
import assert from 'node:assert/strict'
import { createPointsService, normalizePoints, normalizeInvitation, businessTime } from '../lib/points.js'
const config = { profileID: 'school', modelBaseURL: 'https://example.org/open/api/v1', workerBaseURL: 'https://example.org/api/worker/v1' }
const invitation = { referralCode: 'SYNTHETIC', invite_url: 'https://example.org/html/#/invite/SYNTHETIC', expiresAt: '2099-11-24T20:00:00' }
function fixture(overrides = {}) {
  const events = new Map(), effects = [], requests = [], reads = []
  const ctx = {
    on: (name, listener) => events.set(name, listener), effect: effect => effects.push(effect()),
    oidcAccounts: { status: async () => ({ credentialReady: true }), modelAuthorization: async () => true,
      authorizedFetch: async (...args) => { requests.push(args); return Response.json(invitation) } },
    ecnuAiconsole: { profileID: 'school', read: async (...args) => { reads.push(args); return { data: { currentPoints: 156 } } } },
  }
  Object.assign(ctx.oidcAccounts, overrides)
  return { ctx, events, effects, requests, reads, service: createPointsService(ctx, config) }
}
test('points stay unknown on missing or invalid amounts; business timestamps use Beijing time', () => {
  assert.deepEqual(normalizePoints({}), { state: 'unavailable' })
  assert.deepEqual(normalizePoints({ currentPoints: -1 }), { state: 'unavailable' })
  assert.equal(normalizePoints({ currentPoints: 0 }).currentPoints, 0)
  assert.equal(businessTime('2027-05-01T00:00:00'), '2027-04-30T16:00:00.000Z')
  assert.equal(businessTime('2027-05-01T00:00:00Z'), '2027-05-01T00:00:00.000Z')
  assert.equal(businessTime('tomorrow'), null)
})
test('points share the read-only account implementation; invitation is never fetched by a balance read', async () => {
  const f = fixture()
  assert.equal((await f.service.points('school')).currentPoints, 156)
  assert.equal(f.reads[0][0], 'account_get_points')
  assert.equal(f.requests.length, 0)
  assert.deepEqual(await f.service.points('other'), { state: 'not_configured' })
  f.ctx.ecnuAiconsole.profileID = 'other'
  assert.deepEqual(await f.service.points('school'), { state: 'not_configured' })
})
test('signed-out users cannot request invitations; existing account transport is sufficient', async () => {
  for (const overrides of [{ status: async () => ({ credentialReady: false }) }, { modelAuthorization: async () => false }]) {
    const f = fixture(overrides)
    assert.deepEqual(await f.service.invitation('school'), { state: 'not_connected' })
    assert.equal(f.requests.length, 0)
  }
  assert.equal((await fixture().service.invitation('school')).state, 'available')
})
test('invitation uses one fixed authorized GET; no credentials enter the response', async () => {
  const f = fixture()
  const value = await f.service.invitation('school')
  assert.equal(value.state, 'available'); assert.equal(value.inviteURL, invitation.invite_url)
  assert.equal(f.requests.length, 1)
  const [profile, url, options, authorization] = f.requests[0]
  assert.equal(profile, 'school'); assert.equal(url, `${config.workerBaseURL}/points/invitation`)
  assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.equal(options.body, undefined)
  assert.deepEqual(authorization, { serviceURL: url })
})
test('invitation links preserve the platform route but reject external, credential-bearing and expired links', () => {
  for (const invite_url of ['https://evil.example/x', 'https://secret@example.org/x', 'javascript:alert(1)']) assert.equal(normalizeInvitation({ ...invitation, invite_url }, 'https://example.org').state, 'unavailable')
  assert.equal(normalizeInvitation({ ...invitation, expiresAt: '2020-01-01T00:00:00' }, 'https://example.org').state, 'expired')
})
test('service configuration rejects cross-origin and insecure destinations', () => {
  const f = fixture()
  for (const workerBaseURL of ['https://evil.example/api', 'https://secret@example.org/api', 'http://example.org/api']) assert.throws(() => createPointsService(f.ctx, { ...config, workerBaseURL }))
  assert.equal(createPointsService(f.ctx).profileID, null)
})
test('permission failures and malformed or oversized responses do not become success', async () => {
  for (const [response, state] of [[new Response('', { status: 403 }), 'permission_denied'], [new Response('', { status: 404 }), 'unavailable'], [Response.json({}), 'unavailable'], [Response.json({ padding: 'x'.repeat(20000) }), 'unavailable']]) {
    const f = fixture({ authorizedFetch: async () => response })
    assert.deepEqual(await f.service.invitation('school'), { state })
  }
})
test('account changes and plugin disposal discard delayed points and invitation responses', async () => {
  for (const method of ['points', 'invitation']) for (const change of ['account', 'dispose']) {
    const f = fixture(); let release, entered
    const pending = new Promise(resolve => { release = resolve }), started = new Promise(resolve => { entered = resolve })
    if (method === 'points') f.ctx.ecnuAiconsole.read = async () => { entered(); await pending; return { data: { currentPoints: 99 } } }
    else f.ctx.oidcAccounts.authorizedFetch = async () => { entered(); await pending; return Response.json(invitation) }
    const request = f.service[method]('school'); await started
    if (change === 'account') f.events.get('oidc/accounts-changed')({ profileID: 'school', state: 'signed_out' })
    else f.effects.forEach(dispose => dispose())
    release(); assert.deepEqual(await request, { state: 'not_connected' })
  }
})
