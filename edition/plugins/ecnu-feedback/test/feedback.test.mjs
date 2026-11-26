import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import { Context, Service } from '@deepseek-ai/cordis'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const { default: Oidc } = await import(process.env.DSH_OIDC_PACKAGE_ROOT
  ? pathToFileURL(resolve(process.env.DSH_OIDC_PACKAGE_ROOT, 'lib/index.js')).href
  : '@eduwork/dsh-oidc')
import { fixture as oidcFixture } from '../../ecnu-account-resources/test/helpers/oidc-http-fixture.mjs'
import Feedback from '../lib/index.js'
import { feedbackTarget, readFeedbackTarget } from '../lib/context.js'
import { createFeedbackService, resolveConfig } from '../lib/service.js'
import { descriptors } from '../lib/typert-schemas.js'
const config = { profileID: 'school', providerID: 'school-ai', modelBaseURL: 'https://example.org/open/api/v1', workerBaseURL: 'https://example.org/api/worker/v1', reasons: ['回答不准确'] }
function conversation(provider = 'school-ai', end = 'completed') {
  const session = Session.create('session-1', [], { version: SESSION_FORMAT_VERSION, id: 'session-1', createdAt: Date.now(), isSeeded: false })
  session.append('turn/start', { turn: 1 }); session.append('step/start', { turn: 1, step: 1 })
  session.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'Visible question' }], source: { kind: 'user' } }), { surfaceOp: 'append' })
  session.append('user/message', createUserMessage({ content: [{ type: 'text', text: 'Hidden injected context' }], source: { kind: 'test' } }), { surfaceOp: 'append' })
  const message = createAssistantMessage({ content: [{ type: 'reasoning', text: 'Hidden reasoning' }, { type: 'text', text: 'Visible answer' }], source: { provider, model: 'model-1' } })
  session.append('assistant/message', { turn: 1, step: 1, stream: [], message }, { surfaceOp: 'append' })
  session.append('step/end', { turn: 1, step: 1 })
  if (end) session.append('turn/end', { turn: 1, reason: { kind: end } })
  return { session, messageID: message.id, events: () => session.snapshotEvents() }
}
function fixture(options = {}) {
  const conv = conversation(), requests = [], events = new Map(), effects = []
  const ctx = {
    sessions: { get: () => conv.session }, sessionPersistence: { stat: async () => undefined },
    on: (name, listener) => events.set(name, listener), effect: fn => effects.push(fn()),
    oidcAccounts: { accountIdentity: async () => ({ profileID: 'school', accountID: 'synthetic-account' }), modelAuthorization: async () => true,
      authorizedFetch: async (...args) => { requests.push(args); return Response.json({ message_id: conv.messageID, favorite: args[2].body ? JSON.parse(args[2].body).favorite : 0 }) }, ...options },
  }
  const service = createFeedbackService(ctx, config)
  return { ...conv, ctx, service, requests, events, effects, switchAccount: () => { events.get('oidc/accounts-changed')({ profileID: 'school', state: 'connected', authorizationChanged: true }) },
    async action(favorite = 1) { const preview = await service.preview('session-1', conv.messageID), current = await service.read('session-1', conv.messageID); return { favorite, digest: preview.digest, accountBinding: current.accountBinding, confirmed: true, reason: [], desc: '' } },
  }
}
test('official DSH append-origin transcript supplies only the visible human question and final answer', () => {
  const f = conversation(), value = feedbackTarget(f.events(), 'session-1', f.messageID, 'school-ai')
  assert.equal(value.state, 'available'); assert.equal(value.question, 'Visible question'); assert.equal(value.answer, 'Visible answer')
  assert.match(value.digest, /^[a-f0-9]{64}$/)
  assert.doesNotMatch(JSON.stringify(value), /Hidden/)
})
test('foreign providers, interrupted, unfinished, missing and replacement targets cannot receive feedback', () => {
  for (const [provider, end] of [['personal', 'completed'], ['school-ai', 'interrupted'], ['school-ai', null]]) {
    const f = conversation(provider, end); assert.equal(feedbackTarget(f.events(), 'session-1', f.messageID, 'school-ai').state, 'ineligible')
  }
  const f = conversation()
  assert.equal(feedbackTarget(f.events(), 'session-1', 'missing', 'school-ai').state, 'ineligible')
  const replaced = f.events().map(event => event.type === 'assistant/message' ? { ...event, surfaceOp: { op: 'replace', startSeq: 0, endSeq: 1 } } : event)
  assert.equal(feedbackTarget(replaced, 'session-1', f.messageID, 'school-ai').state, 'ineligible')
})
test('oversized visible context is refused without silent truncation', () => {
  const f = conversation(), events = f.events().map(event => event.type === 'user/message' && event.data.source.kind === 'user' ? { ...event, data: { ...event.data, content: [{ type: 'text', text: 'x'.repeat(50001) }] } } : event)
  assert.deepEqual(feedbackTarget(events, 'session-1', f.messageID, 'school-ai'), { state: 'too_large' })
})
test('cold history opens read-only and closes the handle', async () => {
  const f = conversation(); let access, closed = false
  const ctx = { sessions: { get: () => undefined }, sessionPersistence: { stat: async () => ({}), open: async (_id, mode) => { access = mode; return { read: async () => ({ events: f.events() }), close: async () => { closed = true } } } } }
  assert.equal((await readFeedbackTarget(ctx, 'session-1', f.messageID, 'school-ai')).state, 'available')
  assert.equal(access, 'read'); assert.equal(closed, true)
})
test('preview stays local; read and explicit submit use stable IDs and host-owned text', async () => {
  const f = fixture(), preview = await f.service.preview('session-1', f.messageID)
  assert.equal(f.requests.length, 0)
  const current = await f.service.read('session-1', f.messageID)
  assert.equal(current.favorite, 0); assert.match(current.accountBinding, /^[a-f0-9-]{36}$/)
  const action = { favorite: -1, digest: preview.digest, accountBinding: current.accountBinding, confirmed: true, reason: [], desc: '' }
  assert.equal(new URL(f.requests[0][1]).searchParams.get('conversation_id'), 'session-1')
  assert.equal((await f.service.submit('session-1', f.messageID, { ...action, reason: ['回答不准确'], desc: 'Details' })).favorite, -1)
  const [, endpoint, request, authorization] = f.requests[1]
  assert.equal(request.method, 'POST'); assert.equal(request.redirect, 'error')
  assert.deepEqual(authorization, { issuerServicePath: new URL(endpoint).pathname })
  assert.deepEqual(JSON.parse(request.body), { conversation_id: 'session-1', favorite: -1, reason: ['回答不准确'], desc: 'Details', question_content: 'Visible question', answer_content: 'Visible answer' })
  assert.equal(request.headers.authorization, undefined)
})
test('retraction sends zero and does not reupload question or answer', async () => {
  const f = fixture()
  assert.equal((await f.service.submit('session-1', f.messageID, await f.action(0))).favorite, 0)
  assert.deepEqual(JSON.parse(f.requests.find(request => request[2].method === 'POST')[2].body), { conversation_id: 'session-1', favorite: 0 })
})
test('unconfirmed, changed-account, changed-preview and unconfigured-category writes are rejected', async () => {
  for (const change of [{ confirmed: false }, { digest: '0'.repeat(64) }, { accountBinding: 'other' }, { reason: ['unconfigured'] }]) {
    const f = fixture()
    assert.equal((await f.service.submit('session-1', f.messageID, { ...await f.action(), ...change })).state, 'preview_changed')
    assert.equal(f.requests.filter(request => request[2].method === 'POST').length, 0)
  }
})
test('existing login transport is enough; server denial and failures do not claim success', async () => {
  for (const [response, state] of [[new Response('', { status: 403 }), 'permission_denied'], [new Response('', { status: 500 }), 'unavailable'], [Response.json({ favorite: 2 }), 'unavailable'], [Response.json({ favorite: 1, message_id: 'wrong' }), 'unavailable']]) {
    const f = fixture(), action = await f.action()
    f.ctx.oidcAccounts.authorizedFetch = async () => response
    assert.equal((await f.service.submit('session-1', f.messageID, action)).state, state)
  }
  const f = fixture({ modelAuthorization: async () => false })
  assert.equal((await f.service.read('session-1', f.messageID)).state, 'not_connected')
  assert.equal(f.requests.length, 0)
})
test('account changes discard delayed responses and block queued writes for the old account', async () => {
  let entered, release
  const started = new Promise(resolve => { entered = resolve }), pending = new Promise(resolve => { release = resolve })
  const f = fixture(), action = await f.action()
  f.ctx.oidcAccounts.authorizedFetch = async () => { entered(); await pending; return Response.json({ favorite: 1 }) }
  const first = f.service.submit('session-1', f.messageID, action), second = f.service.submit('session-1', f.messageID, action)
  await started; f.switchAccount(); release()
  assert.equal((await first).state, 'not_connected'); assert.equal((await second).state, 'preview_changed')
})
test('configuration and RPC contract have no tool or arbitrary transport surface', () => {
  assert.throws(() => resolveConfig({ ...config, workerBaseURL: 'https://evil.example/api' }))
  const development = { ...config, modelBaseURL: 'http://192.0.2.10/open/api/v1', workerBaseURL: 'http://192.0.2.10/api/worker/v1' }
  assert.throws(() => resolveConfig(development))
  assert.equal(resolveConfig({ ...development, allowInsecureDevelopment: true }).modelBaseURL, development.modelBaseURL)
  for (const workerBaseURL of ['http://192.0.2.11/api', 'http://192.0.2.10:8080/api', 'https://192.0.2.10/api']) {
    assert.throws(() => resolveConfig({ ...development, workerBaseURL, allowInsecureDevelopment: true }))
  }
  assert.deepEqual(descriptors.map(value => value.method), ['configuration', 'preview', 'read', 'submit'])
  const action = descriptors.find(value => value.method === 'submit').parameters.at(-1).codec.schema
  const valid = { favorite: 1, digest: 'a'.repeat(64), accountBinding: 'b2275353-c236-42cb-babb-3dbe2647b40a', reason: [], desc: '', confirmed: true }
  assert.equal(action.safeParse(valid).success, true)
  assert.equal(action.safeParse({ ...valid, question_content: 'spoofed' }).success, false)
})

test('credential replacement and Host restart invalidate an existing feedback draft', async () => {
  const f = fixture(), action = await f.action()
  f.ctx.oidcAccounts.accountIdentity = async () => ({ profileID: 'school', accountID: 'replacement-account' })
  assert.equal((await f.service.submit('session-1', f.messageID, action)).state, 'preview_changed')
  const restarted = createFeedbackService(f.ctx, config)
  assert.equal((await restarted.submit('session-1', f.messageID, action)).state, 'preview_changed')
  assert.equal(f.requests.filter(request => request[2].method === 'POST').length, 0)
})

test('same-account credential renewal preserves reads and existing drafts', async () => {
  const f = fixture(), action = await f.action()
  const refreshed = () => f.events.get('credentials/reference-updated')?.({ ref: 'synthetic' })
  f.ctx.oidcAccounts.modelAuthorization = async () => { refreshed(); f.events.get('oidc/accounts-changed')({profileID:'school',state:'connected'}); return true }
  const fetch = f.ctx.oidcAccounts.authorizedFetch
  f.ctx.oidcAccounts.authorizedFetch = async (...args) => { refreshed(); return fetch(...args) }
  const current = await f.service.read('session-1', f.messageID)
  assert.equal(current.state, 'available'); assert.equal(current.accountBinding, action.accountBinding)
  assert.equal((await f.service.submit('session-1', f.messageID, action)).favorite, 1)
})

test('missing or changed identity fails closed before sending an old-account write', async () => {
  for (const accountIdentity of [async () => null, async () => ({ profileID: 'other', accountID: 'synthetic-account' })]) {
    const f = fixture(), action = await f.action(); f.ctx.oidcAccounts.accountIdentity = accountIdentity
    assert.equal((await f.service.submit('session-1', f.messageID, action)).state, 'not_connected')
    assert.equal(f.requests.filter(request => request[2].method === 'POST').length, 0)
  }
})

test('temporary identity failure blocks writes but preserves the draft for recovery', async () => {
  const f = fixture(), action = await f.action(), identity = f.ctx.oidcAccounts.accountIdentity
  f.ctx.oidcAccounts.accountIdentity = async () => { throw Error('temporary refresh outage') }
  f.events.get('credentials/reference-updated')({ref:'synthetic'})
  assert.equal((await f.service.read('session-1', f.messageID)).state, 'unavailable')
  assert.equal((await f.service.submit('session-1', f.messageID, action)).state, 'unavailable')
  assert.equal(f.requests.filter(request => request[2].method === 'POST').length, 0)
  f.ctx.oidcAccounts.accountIdentity = identity
  const recovered = await f.service.read('session-1', f.messageID)
  assert.equal(recovered.state, 'available'); assert.equal(recovered.accountBinding, action.accountBinding)
  assert.equal((await f.service.submit('session-1', f.messageID, action)).favorite, 1)
})

test('network timeout is retryable and does not report an account change', async t => {
  const f = fixture()
  t.mock.method(AbortSignal, 'timeout', () => AbortSignal.abort(new DOMException('Timed out', 'TimeoutError')))
  assert.equal((await f.service.read('session-1', f.messageID)).state, 'unavailable')
})

test('older OIDC without account identity keeps conservative credential invalidation', async () => {
  const f = fixture({ accountIdentity: undefined }), action = await f.action()
  f.events.get('credentials/reference-updated')({ ref: 'synthetic' })
  assert.equal((await f.service.submit('session-1', f.messageID, action)).state, 'preview_changed')
})

test('installed OIDC sign-in and renewal enforce its identity-capability boundary', async t => {
  const conv = conversation('fixture-ai'), writes = []
  const f = await oidcFixture(t, { resources: true, scopes: ['feedback.read', 'feedback.write'], resourceHandler: async (req, res, url) => {
    if (!url.pathname.startsWith('/v1/feedback/')) return false
    let favorite = 0
    if (req.method === 'POST') { const chunks = []; for await (const chunk of req) chunks.push(chunk); const body = JSON.parse(Buffer.concat(chunks).toString()); writes.push(body); favorite = body.favorite }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ message_id: conv.messageID, favorite })); return true
  } })
  f.rawProfile.auth.additionalScopes = ['feedback.read', 'feedback.write']
  const ctx = new Context(), fibers = [], records = new Map(), opened = []
  t.after(async () => { for (const fiber of fibers.reverse()) await fiber.dispose() })
  class Credentials extends Service {
    constructor(ctx) { super(ctx, 'credentials') }
    resolve(ref) { return Promise.resolve(records.has(ref) ? { value: records.get(ref) } : undefined) }
    set(ref, value) { records.set(ref, value); this.ctx.emit('credentials/reference-updated', { ref }); return Promise.resolve() }
    unset(ref) { records.delete(ref); this.ctx.emit('credentials/reference-updated', { ref }); return Promise.resolve() }
  }
  for (const plugin of [LlmRuntime, Credentials]) fibers.push(await ctx.plugin(plugin))
  for (const [name, methods] of [['desktopServices', { openExternal: async url => { opened.push(url) } }], ['sessions', { get: () => conv.session }], ['sessionPersistence', { stat: async () => undefined }]]) {
    fibers.push(await ctx.plugin(class extends Service { constructor(ctx) { super(ctx, name); Object.assign(this, methods) } }))
  }
  fibers.push(await ctx.plugin(Oidc, { backend: 'desktop', profile: f.rawProfile }))
  fibers.push(await ctx.plugin(Feedback, { ...config, profileID: 'desktop-test', providerID: 'fixture-ai', modelBaseURL: `${f.origin}/v1`, workerBaseURL: `${f.origin}/v1`, allowInsecureDevelopment: true }))
  await ctx.oidcAccounts.begin('desktop-test')
  assert.equal((await fetch(opened.at(-1))).status, 200)
  assert.equal((await ctx.oidcAccounts.status('desktop-test')).credentialReady, true)
  const preview = await ctx.ecnuFeedback.preview('session-1', conv.messageID), current = await ctx.ecnuFeedback.read('session-1', conv.messageID)
  assert.equal(current.state, 'available')
  // Run the real public OIDC refresh/persistence path inside modelAuthorization.
  // Only the synthetic token endpoint response is substituted; no live credentials.
  const fetchOriginal = ctx.oidcAccounts.backend.fetch, authorizationOriginal = ctx.oidcAccounts.modelAuthorization.bind(ctx.oidcAccounts)
  let refreshes = 0, expireOnce = true
  t.mock.method(ctx.oidcAccounts.backend, 'fetch', async (input, init) => {
    if (String(input) === `${f.origin}/token` && String(init?.body).includes('grant_type=refresh_token')) {
      refreshes++
      const saved = [...records.values()].map(value => JSON.parse(value)).find(value => value.refreshToken)
      return Response.json({ access_token: '<ACCESS_TOKEN>', refresh_token: 'synthetic-refreshed', token_type: 'Bearer', expires_in: 3600, scope: saved.scopes.join(' '), id_token: saved.idToken })
    }
    return fetchOriginal(input, init)
  })
  t.mock.method(ctx.oidcAccounts, 'modelAuthorization', async (...args) => {
    if (expireOnce) { expireOnce = false; for (const [ref, raw] of records) { const value = JSON.parse(raw); if (value.refreshToken) records.set(ref, JSON.stringify({ ...value, expiresAt: 1, refreshAt: 1 })) } }
    return authorizationOriginal(...args)
  })
  const renewed = await ctx.ecnuFeedback.read('session-1', conv.messageID)
  assert.equal(refreshes, 1)
  const previousAction = { favorite: 1, digest: preview.digest, accountBinding: current.accountBinding, confirmed: true, reason: [], desc: '' }
  let action = previousAction
  if (typeof ctx.oidcAccounts.accountIdentity === 'function') {
    t.diagnostic('Installed OIDC exposes accountIdentity: same-account renewal preserves the existing draft')
    assert.equal(renewed.state, 'available'); assert.equal(renewed.accountBinding, current.accountBinding)
  } else {
    t.diagnostic('Installed OIDC has no accountIdentity: renewal invalidates the old draft, and a fresh read recovers')
    assert.equal(renewed.state, 'not_connected')
    const recovered = await ctx.ecnuFeedback.read('session-1', conv.messageID)
    assert.equal(recovered.state, 'available'); assert.notEqual(recovered.accountBinding, current.accountBinding)
    assert.equal((await ctx.ecnuFeedback.submit('session-1', conv.messageID, previousAction)).state, 'preview_changed')
    assert.equal(writes.length, 0, 'The old draft must not write after a conservative credential invalidation')
    action = { ...previousAction, accountBinding: recovered.accountBinding }
  }
  assert.equal((await ctx.ecnuFeedback.submit('session-1', conv.messageID, action)).favorite, 1)
  assert.equal(writes.length, 1); assert.equal(writes[0].answer_content, 'Visible answer')
  await ctx.oidcAccounts.logout('desktop-test')
  assert.equal((await ctx.ecnuFeedback.submit('session-1', conv.messageID, action)).state, 'not_connected')
  assert.equal(writes.length, 1)
})
test('actual Cordis host mounts the separate feedback service against the pinned DSH runtime', async t => {
  const f = fixture(), ctx = new Context(), fibers = []
  t.after(async () => { for (const fiber of fibers.reverse()) await fiber.dispose() })
  for (const [name, methods] of [['sessions', f.ctx.sessions], ['sessionPersistence', f.ctx.sessionPersistence], ['oidcAccounts', f.ctx.oidcAccounts]]) {
    fibers.push(await ctx.plugin(class extends Service { constructor(ctx) { super(ctx, name); Object.assign(this, methods) } }))
  }
  fibers.push(await ctx.plugin(Feedback, config))
  assert.equal((await ctx.ecnuFeedback.preview('session-1', f.messageID)).state, 'available')
  assert.equal((await ctx.ecnuFeedback.read('session-1', f.messageID)).favorite, 0)
})
