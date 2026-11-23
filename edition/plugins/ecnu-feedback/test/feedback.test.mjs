import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssistantMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import { Context, Service } from '@deepseek-ai/cordis'
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
  let accountID = 'account-1'
  const ctx = {
    sessions: { get: () => conv.session }, sessionPersistence: { stat: async () => undefined },
    on: (name, listener) => events.set(name, listener), effect: fn => effects.push(fn()),
    oidcAccounts: { authorization: async () => ({ granted: ['feedback.read', 'feedback.write'] }), modelAuthorization: async () => true,
      identityScope: async () => ({ profileID: 'school', accountID }),
      authorizedFetch: async (...args) => { requests.push(args); return Response.json({ message_id: conv.messageID, favorite: args[2].body ? JSON.parse(args[2].body).favorite : 0 }) }, ...options },
  }
  const service = createFeedbackService(ctx, config)
  return { ...conv, ctx, service, requests, events, effects, switchAccount: () => { accountID = 'account-2'; events.get('oidc/accounts-changed')({ profileID: 'school', state: 'connected' }) },
    async action(favorite = 1) { const preview = await service.preview('session-1', conv.messageID); return { favorite, digest: preview.digest, accountID, confirmed: true, reason: [], desc: '' } },
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
  const f = fixture(), action = await f.action(-1)
  assert.equal(f.requests.length, 0)
  const current = await f.service.read('session-1', f.messageID)
  assert.equal(current.favorite, 0); assert.equal(current.accountID, 'account-1')
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
  assert.deepEqual(JSON.parse(f.requests[0][2].body), { conversation_id: 'session-1', favorite: 0 })
})
test('unconfirmed, changed-account, changed-preview and unconfigured-category writes are rejected', async () => {
  for (const change of [{ confirmed: false }, { digest: '0'.repeat(64) }, { accountID: 'other' }, { reason: ['unconfigured'] }]) {
    const f = fixture()
    assert.equal((await f.service.submit('session-1', f.messageID, { ...await f.action(), ...change })).state, 'preview_changed')
    assert.equal(f.requests.length, 0)
  }
})
test('missing write consent never sends a mutation; server failures do not claim success', async () => {
  const f = fixture({ authorization: async () => ({ granted: ['feedback.read'] }) })
  assert.equal((await f.service.submit('session-1', f.messageID, await f.action())).state, 'authorization_required'); assert.equal(f.requests.length, 0)
  for (const response of [new Response('', { status: 500 }), Response.json({ favorite: 2 }), Response.json({ favorite: 1, message_id: 'wrong' })]) {
    const f = fixture({ authorizedFetch: async () => response })
    assert.equal((await f.service.submit('session-1', f.messageID, await f.action())).state, 'unavailable')
  }
})
test('account changes discard delayed responses and block queued writes for the old account', async () => {
  let entered, release
  const started = new Promise(resolve => { entered = resolve }), pending = new Promise(resolve => { release = resolve })
  const f = fixture({ authorizedFetch: async () => { entered(); await pending; return Response.json({ favorite: 1 }) } })
  const action = await f.action(), first = f.service.submit('session-1', f.messageID, action), second = f.service.submit('session-1', f.messageID, action)
  await started; f.switchAccount(); release()
  assert.equal((await first).state, 'not_connected'); assert.equal((await second).state, 'preview_changed')
})
test('configuration and RPC contract have no tool or arbitrary transport surface', () => {
  assert.throws(() => resolveConfig({ ...config, workerBaseURL: 'https://evil.example/api' }))
  assert.deepEqual(descriptors.map(value => value.method), ['configuration', 'preview', 'read', 'submit'])
  const action = descriptors.find(value => value.method === 'submit').parameters.at(-1).codec.schema
  assert.equal(action.safeParse({ favorite: 1, digest: 'a'.repeat(64), accountID: 'a', reason: [], desc: '', confirmed: true, question_content: 'spoofed' }).success, false)
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
