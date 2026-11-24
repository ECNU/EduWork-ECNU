import test from 'node:test'
import assert from 'node:assert/strict'
import { createAccountReader, resolveConfig } from '../lib/reader.js'
import { READ_OPERATIONS, readRequest } from '../lib/operations.js'

const config = { oidcProfileId: 'school', baseURL: 'https://school.example/open/api/v1' }
const success = (operation, data) => Response.json({ object: 'account_result', operation, data })
function fixture(t, response = () => success('account_get_profile', { name: 'Example' }), overrides = {}) {
  const calls = [], events = new Map(), cleanups = []
  const accounts = {
    async modelAuthorization(id, url) { assert.equal(id, 'school'); assert.equal(url, config.baseURL); return true },
    async authorizedFetch(...args) { calls.push(args); return response(...args) },
  }
  const reader = createAccountReader({ oidcAccounts: accounts, on: (name, fn) => events.set(name, fn), effect: fn => cleanups.push(fn()) }, { ...config, ...overrides })
  t.after(() => cleanups.forEach(fn => fn()))
  return { reader, calls, accounts, dispose: () => cleanups.forEach(fn => fn()), change: event => events.get('oidc/accounts-changed')(event) }
}

test('closed operation and argument allowlists reject writes before authentication or HTTP', async t => {
  const f = fixture(t)
  f.accounts.modelAuthorization = () => { throw Error('Must not authenticate') }
  for (const operation of ['account_stop_request', 'account_get_invitation', 'account_create_key', 'toString', '__proto__', '/profile', null]) {
    await assert.rejects(f.reader.read(operation), { code: 'operation_not_allowed' })
  }
  for (const args of [{ method: 'POST' }, { url: 'https://evil.example' }, { confirmed: true }, { headers: {} }, JSON.parse('{"__proto__":{}}')]) {
    await assert.rejects(f.reader.read('account_get_profile', args), { code: 'invalid_arguments' })
  }
  assert.equal(f.calls.length, 0)
})

test('all allowed operations use GET, the bound profile, exact URL capability, and no credential/header arguments', async t => {
  let op
  const f = fixture(t, () => success(op, op === 'account_list_keys' ? { items: [] } : { value: 0 }))
  for (op of Object.keys(READ_OPERATIONS)) {
    const args = op === 'account_get_messages' ? { conversation_id: 'example-123' } : {}
    const result = await f.reader.read(op, args)
    assert.equal(result.operation, op)
    const [id, url, init, authorization] = f.calls.at(-1)
    assert.equal(id, 'school')
    assert.equal(init.method, 'GET')
    assert.equal(init.body, undefined)
    assert.deepEqual(init.headers, { accept: 'application/json' })
    assert.equal(init.redirect, 'error')
    assert.deepEqual(authorization, { serviceURL: url })
    assert.ok(url.startsWith(config.baseURL + '/account/'))
  }
  assert.equal(f.calls.length, 12)
})

test('pagination, Beijing dates and credential IDs are preserved; pages are not reported as complete usage', async t => {
  const f = fixture(t, () => success('account_get_usage', { items: [{ input_tokens: 10 }], total: 2, page: 1, page_size: 1 }))
  const result = await f.reader.read('account_get_usage', { page: 1, page_size: 1, start: '2026-11-01', end: '2026-11-24', credential_id: 'deleted-abc', model: 'model & detail' })
  assert.equal(result.coverage, 'page')
  assert.equal(result.timezone, 'Asia/Shanghai')
  assert.deepEqual(result.data, { items: [{ input_tokens: 10 }], total: 2, page: 1, page_size: 1 })
  const params = new URL(f.calls[0][1]).searchParams
  assert.equal(params.get('model'), 'model & detail')
  assert.equal(params.get('credential_id'), 'deleted-abc')
  assert.equal(result.data.total_tokens, undefined)
  const list = readRequest(config.baseURL, 'account_list_conversations', {})
  assert.match(list.url, /page=1&limit=20$/)
  assert.equal(new URL(list.url).searchParams.has('page_size'), false)
})

test('rejects invalid dates, unsafe path IDs, unknown fields and out-of-range pagination', () => {
  for (const args of [{ page: 0 }, { page: '1' }, { page_size: null }, { page_size: 101 }, { page: 2.5 }, { start: '2026-02-29' }, { start: '2026-11-25', end: '2026-11-24' }, { start: 'today' }, { model: '\nsecret' }]) {
    assert.throws(() => readRequest(config.baseURL, 'account_get_usage', args), { code: 'invalid_arguments' })
  }
  for (const id of ['..', '../stop', '%2fstop', 'a/b', 'a?confirmed=true', 'a#b', '']) {
    assert.throws(() => readRequest(config.baseURL, 'account_get_messages', { conversation_id: id }), { code: 'invalid_arguments' })
  }
  assert.throws(() => readRequest(config.baseURL, 'account_get_messages'), { code: 'invalid_arguments' })
})

test('message pages remain selectable and never claim to contain the entire conversation', async t => {
  const f = fixture(t, (_id, url) => {
    const page = Number(new URL(url).searchParams.get('page'))
    return success('account_get_messages', { conversation_id: 'example-123', items: [{ id: 'message-' + page, role: 'user', content: 'Example' }], page, page_size: 1, total: 2 })
  })
  const first = await f.reader.read('account_get_messages', { conversation_id: 'example-123', page: 1, limit: 1 })
  const second = await f.reader.read('account_get_messages', { conversation_id: 'example-123', page: 2, limit: 1 })
  assert.equal(first.coverage, 'page'); assert.equal(second.coverage, 'page')
  assert.equal(second.data.page, 2); assert.equal(second.data.total, 2)
  assert.notEqual(first.data.items[0].id, second.data.items[0].id)
  assert.deepEqual(second.parameters, { page: 2, limit: 1, conversation_id: 'example-123' })
  for (const args of [{ page: 0 }, { limit: 101 }, { page_size: 1 }]) {
    await assert.rejects(f.reader.read('account_get_messages', { conversation_id: 'example-123', ...args }), { code: 'invalid_arguments' })
  }
  assert.equal(f.calls.length, 2)
})

test('keys project only safe metadata and unknown nested credential fields never reach the caller', async t => {
  const f = fixture(t, () => success('account_list_keys', { page: 1, total: 1, api_key: 'top-secret', unknown: { token: 'nested-secret' }, items: [{ id: 4, credential_id: 'key-4', name: 'Research', masked_key: 'sk-***', is_primary: false, quota_subject: 'account', api_key: 'key-secret', token: 'token-secret', future: { secret: 'future-secret' } }] }))
  const result = await f.reader.read('account_list_keys')
  assert.deepEqual(result.data, { page: 1, total: 1, items: [{ id: 4, credential_id: 'key-4', name: 'Research', masked_key: 'sk-***', is_primary: false, quota_subject: 'account' }] })
  f.accounts.authorizedFetch = async () => success('account_get_profile', { name: 'Example', auth: { access_token: 'secret', refreshToken: 'secret', id_token: 'secret', client_secret: 'secret', status: 'active' } })
  assert.deepEqual((await f.reader.read('account_get_profile')).data, { name: 'Example', auth: { status: 'active' } })
})

test('HTTP failures are actionable and never reflect server secrets or silently fall back', async t => {
  const f = fixture(t)
  for (const [status, code] of [[401, 'sign_in_required'], [403, 'permission_denied'], [404, 'unavailable'], [429, 'rate_limited'], [500, 'service_error']]) {
    f.accounts.authorizedFetch = async () => Response.json({ error: { message: 'token=private' } }, { status })
    await assert.rejects(f.reader.read('account_get_usage'), error => error.code === code && !error.message.includes('private'))
  }
  f.accounts.modelAuthorization = async () => false
  await assert.rejects(f.reader.read('account_get_profile'), { code: 'sign_in_required' })
})

test('rejects malformed, mismatched and oversized responses rather than inventing empty data', async t => {
  const f = fixture(t)
  for (const response of [new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } }), Response.json({}), success('account_get_quota', {}), new Response('{', { headers: { 'content-type': 'application/json' } })]) {
    f.accounts.authorizedFetch = async () => response
    await assert.rejects(f.reader.read('account_get_profile'), { code: 'invalid_response' })
  }
  for (const headers of [{}, { 'content-length': String(2_000_000) }]) {
    f.accounts.authorizedFetch = async () => new Response('x'.repeat(1_048_577), { headers: { ...headers, 'content-type': 'application/json' } })
    await assert.rejects(f.reader.read('account_get_profile'), { code: 'response_too_large' })
  }
})

test('account replacement during response-body reading cancels old data; new reads recover', async t => {
  let release
  const f = fixture(t, () => new Response(new ReadableStream({ start(controller) { release = () => { controller.enqueue(new TextEncoder().encode(JSON.stringify({ object: 'account_result', operation: 'account_get_profile', data: { name: 'Old user' } }))); controller.close() } } }), { headers: { 'content-type': 'application/json' } }))
  const pending = f.reader.read('account_get_profile')
  const rejected = assert.rejects(pending, { code: 'cancelled' })
  await new Promise(resolve => setImmediate(resolve))
  f.change({ profileID: 'school', state: 'connected', authorizationChanged: true })
  await rejected
  assert.throws(release, /closed/)
  f.accounts.authorizedFetch = async () => success('account_get_profile', { name: 'New user' })
  assert.equal((await f.reader.read('account_get_profile')).data.name, 'New user')
})

test('sign-out while authentication is pending prevents any API request; disposal stays closed', async t => {
  const f = fixture(t)
  let release
  f.accounts.modelAuthorization = () => new Promise(resolve => { release = resolve })
  const pending = f.reader.read('account_get_profile')
  f.change({ profileID: 'school', state: 'not_connected' })
  release(true)
  await assert.rejects(pending, { code: 'cancelled' })
  assert.equal(f.calls.length, 0)
  f.dispose()
  await assert.rejects(f.reader.read('account_get_profile'), { code: 'cancelled' })
})

test('unrelated account events do not cancel and a caller cancellation is propagated', async t => {
  const f = fixture(t)
  f.change({ profileID: 'other', state: 'not_connected' })
  assert.equal((await f.reader.read('account_get_profile')).data.name, 'Example')
  const abort = new AbortController(); abort.abort()
  await assert.rejects(f.reader.read('account_get_profile', {}, { signal: abort.signal }), { code: 'cancelled' })
  assert.equal(f.calls.length, 1)
})

test('HTTP requires explicit development configuration and retains the existing profile binding', () => {
  for (const baseURL of ['http://internal.example/v1', 'https://user:password@example.org/v1', 'https://example.org/v1?token=x', 'https://example.org/v1#x']) assert.throws(() => resolveConfig({ ...config, baseURL }))
  assert.throws(() => resolveConfig({ ...config, oidcProfileId: '' }))
  assert.throws(() => resolveConfig({ ...config, requestTimeoutMs: 0 }))
  assert.equal(resolveConfig({ ...config, baseURL: 'http://127.0.0.1:3000/v1', allowInsecureDevelopment: true }).baseURL, 'http://127.0.0.1:3000/v1')
  assert.equal(resolveConfig({ ...config, baseURL: 'http://192.0.2.10/open/api/v1', allowInsecureDevelopment: true }).baseURL, 'http://192.0.2.10/open/api/v1')
  for (const baseURL of ['ftp://192.0.2.10/v1', 'http://user:password@192.0.2.10/v1', 'http://192.0.2.10/v1?token=x']) assert.throws(() => resolveConfig({ ...config, baseURL, allowInsecureDevelopment: true }))
})

test('a response that stalls after headers times out and releases its stream', async t => {
  let cancelled = false
  const f = fixture(t, () => new Response(new ReadableStream({ cancel() { cancelled = true } }), { headers: { 'content-type': 'application/json' } }), { requestTimeoutMs: 100 })
  // AbortSignal.timeout is unref'd; emulate a live request socket for this synthetic stream.
  const timer = setTimeout(() => {}, 2000); t.after(() => clearTimeout(timer))
  await assert.rejects(f.reader.read('account_get_profile'), { code: 'timeout' })
  assert.equal(cancelled, true)
})
