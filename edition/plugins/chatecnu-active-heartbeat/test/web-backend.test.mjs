import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createWebHeartbeatSender, heartbeatPayload, installationID, normalizeWebConfig } from '../lib/web-backend.js'

const active = { state: 'active', locale: 'zh-CN', timezone: 'Asia/Shanghai' }
const success = JSON.stringify({ status: 'Success', session: { id: 'private-session-value' }, next_heartbeat_in: 600 })

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'eduwork-heartbeat-'))
  const requests = []
  let responseStatus = 200, responseBody = success
  const server = createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    requests.push({ path: request.url, method: request.method, headers: request.headers, body: JSON.parse(body) })
    response.writeHead(responseStatus, { 'content-type': 'application/json' })
    response.end(responseBody)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true }) })
  const calls = []
  let state = 'authenticated'
  const accounts = {
    status: async profileID => ({ profileID, state, credentialReady: false, credentialRef: '' }),
    authorizedFetch: async (profileID, endpoint, init) => {
      calls.push({ profileID, endpoint, init })
      // Stand in for the public OIDC boundary. The heartbeat code must neither
      // receive this value nor implement its refresh/retry behavior.
      return fetch(endpoint, { ...init, headers: { ...init.headers, authorization: 'Bearer synthetic-oidc-access' }, redirect: 'error' })
    },
  }
  const config = { backend: 'web', enabled: true, profileID: 'example', baseURL: `http://127.0.0.1:${server.address().port}`,
    stateDirectory: join(root, 'original'), productName: 'EduWork@Example', version: '0.3.0-dev.1' }
  return { root, config, accounts, calls, requests,
    respond: (status, body) => { responseStatus = status; responseBody = body },
    account: value => { state = value } }
}

test('real HTTP keeps the existing wire payload and delegates credentials to public OIDC', async t => {
  const f = await fixture(t)
  const send = createWebHeartbeatSender(f.accounts, f.config, { system: { platform: 'win32', arch: 'x64' } })
  const result = await send(active)
  assert.deepEqual(result, { state: 'ok', httpStatus: 200, nextHeartbeatIn: 600 })
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].profileID, 'example')
  assert.equal(new Headers(f.calls[0].init.headers).has('authorization'), false)
  assert.ok(f.calls[0].init.signal instanceof AbortSignal)
  const request = f.requests[0]
  assert.equal(request.path, '/user/active')
  assert.equal(request.method, 'POST')
  assert.equal(request.headers.authorization, 'Bearer synthetic-oidc-access')
  assert.equal(request.headers.cookie, undefined)
  assert.equal(request.headers['x-csrftoken'], undefined)
  assert.deepEqual(request.body.activity, { state: 'active' })
  assert.deepEqual(request.body.client, {
    installation_id: request.body.client.installation_id, name: 'EduWork@Example', version: '0.3.0-dev.1', platform: 'web',
    channel: 'dev', device: 'Computer', os: 'Windows', arch: 'x64', locale: 'zh-CN', timezone: 'Asia/Shanghai',
  })
  assert.match(request.body.client.installation_id, /^inst_[0-9a-f-]{36}$/)
  assert.doesNotMatch(JSON.stringify(result) + JSON.stringify(request.body), /synthetic-oidc-access|private-session-value|api_key|client_id|device_id|hostname|workspace/)
  assert.equal((await readFile(join(f.config.stateDirectory, 'installation-id'), 'utf8')).trim(), request.body.client.installation_id)
})

test('installation identifier survives host restarts and moving the data directory', async t => {
  const f = await fixture(t)
  await createWebHeartbeatSender(f.accounts, f.config)(active)
  await createWebHeartbeatSender(f.accounts, f.config)(active)
  const moved = join(f.root, 'moved')
  await rename(f.config.stateDirectory, moved)
  await createWebHeartbeatSender(f.accounts, { ...f.config, stateDirectory: moved })(active)
  assert.equal(new Set(f.requests.map(request => request.body.client.installation_id)).size, 1)
})

test('disabled and signed-out states do not send or require model credentials', async t => {
  const f = await fixture(t)
  assert.deepEqual(await createWebHeartbeatSender(undefined, { backend: 'web' })(active), { state: 'disabled' })
  assert.deepEqual(await createWebHeartbeatSender(undefined, { enabled: false })(active), { state: 'disabled' })
  f.account('signed_out')
  const send = createWebHeartbeatSender(f.accounts, f.config)
  assert.deepEqual(await send(active), { state: 'signed_out' })
  assert.equal(f.calls.length, 0)
  f.account('connected')
  assert.equal((await send(active)).state, 'ok')
  assert.equal(f.calls.length, 1)
})

test('HTTP outcomes remain bounded and final 401 is not retried by the heartbeat backend', async t => {
  const f = await fixture(t)
  const send = createWebHeartbeatSender(f.accounts, f.config)
  for (const [status, body, state, next] of [
    [200, '{"status":"Success","next_heartbeat_in":1}', 'ok', 60],
    [200, '{"status":"Success","next_heartbeat_in":999999}', 'ok', 3600],
    [200, '{"status":"Success"}', 'ok', 600],
    [200, 'not-json', 'retry'], [200, 'x'.repeat(65536), 'retry'],
    [400, 'private-response', 'rejected'], [403, 'private-response', 'rejected'], [404, '', 'rejected'],
    [401, 'private-response', 'login_required'], [429, '', 'retry'], [500, 'private-response', 'retry'],
  ]) {
    f.respond(status, body)
    const before = f.calls.length
    const result = await send(active)
    assert.equal(f.calls.length, before + 1)
    assert.deepEqual(result, { state, httpStatus: status, ...(next ? { nextHeartbeatIn: next } : {}) })
    assert.doesNotMatch(JSON.stringify(result), /private-response/)
  }
})

test('OIDC owns refresh, expiry and origin policy; heartbeat returns only normalized states', async t => {
  const f = await fixture(t)
  for (const [code, state, httpStatus] of [['oidc_login_required', 'login_required', 401], ['oidc_profile_unknown', 'rejected'], ['oidc_authorized_origin_denied', 'rejected'], ['ECONNRESET', 'retry']]) {
    const send = createWebHeartbeatSender({ ...f.accounts, authorizedFetch: async () => { throw Object.assign(new Error('private-token-value'), { code }) } }, f.config)
    assert.deepEqual(await send(active), { state, ...(httpStatus ? { httpStatus } : {}) })
  }
  assert.equal(f.requests.length, 0)
})

test('explicit configuration and client metadata do not broaden the target or invent device details', async t => {
  const f = await fixture(t)
  assert.throws(() => normalizeWebConfig({ enabled: true, profileID: 'example' }), /baseURL/)
  assert.throws(() => normalizeWebConfig({ ...f.config, endpoint: 'https://elsewhere.example/collect' }), /configured HTTP/)
  assert.throws(() => normalizeWebConfig({ ...f.config, installationID: '../private' }), /installationID/)
  const config = normalizeWebConfig({ ...f.config, version: 'long-dev-version-'.repeat(4), installationID: 'inst_fixed' })
  const payload = heartbeatPayload(config, 'inst_fixed', active, { platform: 'linux', arch: 'arm64' })
  assert.equal(payload.client.version, undefined)
  assert.equal(payload.client.channel, 'dev')
  assert.equal(payload.client.os_version, undefined)
  assert.throws(() => heartbeatPayload(config, 'inst_fixed', { ...active, timezone: 'not/a/timezone' }), /timezone/)
  await mkdir(f.config.stateDirectory)
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(f.config.stateDirectory, 'installation-id'), 'corrupt-id\n')
  await assert.rejects(installationID(f.config.stateDirectory), /invalid stored/)
})
