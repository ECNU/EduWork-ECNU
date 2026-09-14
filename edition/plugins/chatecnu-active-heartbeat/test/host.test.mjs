import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createRequire, registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const repository = fileURLToPath(new URL('../../../', import.meta.url))
const runtime = resolve(process.env.EDUWORK_TEST_RUNTIME || resolve(repository, 'dist/dsh-cache/runtime-npm-0.1.5-rc.2'))
const runtimeEntry = pathToFileURL(resolve(runtime, 'package.json')).href
const requireRuntime = createRequire(runtimeEntry)
assert.equal(JSON.parse(await readFile(requireRuntime.resolve('@deepseek-ai/dsh-typert-protocol/package.json'), 'utf8')).version, '0.1.5-rc.2')
const resolver = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@deepseek-ai/') && (context.parentURL === import.meta.url || context.parentURL?.includes('/chatecnu-active-heartbeat/lib/'))) {
    return next(specifier, { ...context, parentURL: runtimeEntry })
  }
  return next(specifier, context)
} })
const [{ Context, Service }, heartbeat] = await Promise.all([import('@deepseek-ai/cordis'), import('../lib/index.js')])
test.after(() => resolver.deregister())

const presence = (id, active) => JSON.stringify({ id, active, locale: 'zh-CN', timezone: 'Asia/Shanghai' })
const settle = async service => { await service.scheduler.running; await new Promise(resolve => setImmediate(resolve)) }

test('real 0.1.5 Host composes web heartbeat without desktop services and reacts only to its OIDC account', async () => {
  const ctx = new Context()
  const calls = []
  let accountState = 'signed_out', previousState
  class Accounts extends Service {
    constructor(ctx) { super(ctx, 'oidcAccounts') }
    async status(profileID) {
      const value = { profileID, state: accountState }
      if (previousState !== accountState) { previousState = accountState; this.ctx.emit('oidc/accounts-changed', value) }
      return value
    }
    async authorizedFetch(profileID, endpoint, init) {
      calls.push({ profileID, endpoint, body: JSON.parse(init.body) })
      return new Response('{"status":"Success","next_heartbeat_in":600,"session":{"id":"private-session"}}')
    }
  }
  try {
    await ctx.plugin(Accounts)
    await ctx.plugin(heartbeat.default, { backend: 'web', enabled: true, profileID: 'example', baseURL: 'https://example.test', installationID: 'inst_test' })
    const service = ctx.chatecnuActiveHeartbeat
    assert.ok(service)
    assert.equal(ctx.get('desktopBoundary'), undefined)
    assert.equal(ctx.get('enterpriseAccounts'), undefined)
    assert.deepEqual(JSON.parse(service.presence(presence('one', true))), { state: 'waiting' })
    await settle(service)
    assert.equal(service.scheduler.outcome, 'signed_out')
    assert.equal(calls.length, 0)
    accountState = 'authenticated'
    await ctx.oidcAccounts.status('example')
    await settle(service)
    assert.equal(calls.length, 1)
    assert.equal(service.scheduler.outcome, 'ok')
    assert.equal(calls[0].body.activity.state, 'active')
    service.presence(presence('two', true)); await settle(service)
    service.presence(presence('one', false)); await settle(service)
    assert.equal(calls.length, 1)
    service.presence(presence('two', false)); await settle(service)
    assert.deepEqual(calls.map(call => call.body.activity.state), ['active', 'background'])
    ctx.emit('oidc/accounts-changed', { profileID: 'another-org', state: 'connected' })
    await settle(service)
    accountState = 'signed_out'
    await ctx.oidcAccounts.status('example'); await settle(service)
    assert.equal(calls.length, 2, 'background host and account changes do not count as activity')
    service.presence(presence('one', true)); await settle(service)
    assert.deepEqual(JSON.parse(service.presence(presence('one', true))), { state: 'signed_out' })
    assert.equal(calls.length, 2)
    await ctx.fiber.dispose()
    assert.equal(service.scheduler.disposed, true)
    assert.equal(service.abort.signal.aborted, true)
  } finally { await ctx.fiber.dispose() }
})

test('disabled Web configuration exposes harmless presence without requiring OIDC or a target', async () => {
  for (const config of [{ backend: 'web', enabled: false }, { backend: 'web' }]) {
  const ctx = new Context()
  try {
    await ctx.plugin(heartbeat.default, config)
    const service = ctx.chatecnuActiveHeartbeat
    service.presence(presence('one', true)); await settle(service)
    assert.deepEqual(JSON.parse(service.presence(presence('one', true))), { state: 'disabled' })
    assert.equal(ctx.get('oidcAccounts'), undefined)
    assert.equal(ctx.get('desktopBoundary'), undefined)
  } finally { await ctx.fiber.dispose() }
  }
})

test('legacy native configuration still uses the native extension bridge wire', async t => {
  const requests = []
  const server = createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    requests.push({ path: request.url, authorization: request.headers.authorization, body: JSON.parse(body) })
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{"state":"ok","httpStatus":200,"nextHeartbeatIn":600}')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const ctx = new Context()
  try {
    ctx.provide('desktopBoundary', { ready: Promise.resolve({ nativeBridge: { baseURL: `http://127.0.0.1:${server.address().port}`, token: 'synthetic-native-token' } }) })
    ctx.provide('enterpriseAccounts', {})
    await ctx.plugin(heartbeat.default)
    const service = ctx.chatecnuActiveHeartbeat
    service.presence(presence('one', true)); await settle(service)
    assert.deepEqual(requests, [{ path: '/v1/extensions/chatecnu-active-heartbeat', authorization: 'Bearer synthetic-native-token', body: { state: 'active', locale: 'zh-CN', timezone: 'Asia/Shanghai' } }])
    assert.equal(service.scheduler.outcome, 'ok')
  } finally { await ctx.fiber.dispose() }
})

