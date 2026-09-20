import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { createWebHeartbeatSender } from '../lib/web-backend.js'

const repository = fileURLToPath(new URL('../../../', import.meta.url))
const runtime = resolve(process.env.EDUWORK_TEST_RUNTIME || resolve(repository, 'dist/dsh-cache/runtime-npm-0.1.5-rc.2'))
const requireRuntime = createRequire(pathToFileURL(resolve(runtime, 'package.json')))
const { WebOidcBackend } = await import(pathToFileURL(requireRuntime.resolve('@eduwork/dsh-oidc/oidc')))
const { normalizeEnterpriseProfile } = await import(pathToFileURL(requireRuntime.resolve('@eduwork/dsh-oidc/profile')))
const example = JSON.parse(await readFile(resolve(dirname(requireRuntime.resolve('@eduwork/dsh-oidc/package.json')), 'examples/identity-only.example.json'), 'utf8'))
const { keyBinding, provider, ...identityOnly } = example
const profile = normalizeEnterpriseProfile(identityOnly)

test('published OIDC backend refreshes a heartbeat 401 once with an access token and preserves identity-only login', async () => {
  const credentials = new Map(), calls = []
  const ctx = {
    credentials: {
      async resolve(ref) { return credentials.has(ref) ? { value: credentials.get(ref) } : undefined },
      async set(ref, value) { credentials.set(ref, value) },
      async unset(ref) { credentials.delete(ref) },
    },
    webServer: { host: '127.0.0.1', port: 3080, register() { return () => {} } },
    effect(install) { return install() }, logger: { warn() {}, error() {} },
  }
  let rejectRefreshed = false
  const backend = new WebOidcBackend(ctx, new Map([[profile.id, profile]]), {}, { fetch: async (url, init) => {
    calls.push({ url, init })
    if (url.endsWith('/token')) return Response.json({ access_token: 'synthetic-renewed', token_type: 'Bearer', expires_in: 3600 })
    if (rejectRefreshed || init.headers.authorization !== 'Bearer synthetic-renewed') return new Response('', { status: 401 })
    return Response.json({ status: 'Success', recorded: false, daily_recorded: false, next_heartbeat_in: 600 })
  } })
  backend.discovery.set(profile.id, { tokenEndpoint: `${profile.oidc.issuer}/token` })
  await backend.saveSession(profile, {
    issuer: profile.oidc.issuer, clientId: profile.oidc.clientId,
    accessToken: 'synthetic-initial', refreshToken: 'synthetic-refresh',
    expiresAt: Math.floor(Date.now() / 1000) + 3600, identity: { sub: 'synthetic-user' },
  })
  const send = createWebHeartbeatSender(backend, {
    enabled: true, profileID: profile.id, baseURL: profile.oidc.issuer, endpoint: '/user/active', installationID: 'inst_synthetic',
  }, { environment: {} })
  assert.deepEqual(await send({ state: 'active' }), { state: 'ok', httpStatus: 200, nextHeartbeatIn: 600 })
  assert.equal(calls.length, 3)
  assert.equal(calls[0].init.headers.authorization, 'Bearer synthetic-initial')
  assert.equal(new URLSearchParams(calls[1].init.body).get('grant_type'), 'refresh_token')
  assert.equal(calls[2].init.headers.authorization, 'Bearer synthetic-renewed')
  assert.equal(calls[2].init.redirect, 'error')
  assert.equal(calls[2].init.headers.cookie, undefined)
  assert.equal(calls[0].init.body, calls[2].init.body)
  assert.doesNotMatch(calls[2].init.body, /synthetic-user|synthetic-initial|synthetic-renewed|synthetic-refresh/)
  assert.equal((await backend.status(profile.id)).state, 'connected')
  rejectRefreshed = true
  const before = calls.length
  assert.deepEqual(await send({ state: 'active' }), { state: 'login_required', httpStatus: 401 })
  assert.ok(calls.length - before <= 3, 'at most one OAuth refresh/retry, with no heartbeat retry loop')
})
