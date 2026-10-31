import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { apply, musicAuthorization } from '../lib/index.js'
import { resolveMusicConfig } from '../lib/core.js'

const config = { baseURL: 'https://school.example.org/open/api/v1', oidcProfileId: 'school', credentialRef: 'TEST_MUSIC_KEY' }
function mount(account, credentials = { resolve() { throw Error('must not read personal key in school mode') } }, overrides = {}, rawConfig = config) {
  const tools = new Map(), handlers = new Map(), disposers = []
  const ctx = {
    tools: { register(tool) { tools.set(tool.name, tool) } }, credentials,
    fs: { resolve: async (path, options) => resolve(options.cwd, path), processPath: path => path,
      contains(root, path) { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..\\') && !rel.startsWith('../') } },
    get(name) { return name === 'oidcAccounts' ? account : undefined },
    permissionPresets: { current: () => 'workspace-write' },
    on(name, handler) { handlers.set(name, handler) },
    effect(callback) { disposers.push(callback()) }, ...overrides,
  }
  apply(ctx, rawConfig)
  return { ctx, tools, handlers, disposers }
}
const result = value => JSON.parse(value.reportJSON)
async function workspace(t) {
  const cwd = await mkdtemp(join(tmpdir(), 'eduwork-music-host-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  return { agent: { session: { id: 'synthetic-session', header: { cwd } } }, signal: new AbortController().signal }
}

test('real DSH defineTool registers all six tools and uses only Host authorization', async t => {
  const calls = [], exec = await workspace(t)
  let loggedIn = true
  const mounted = mount({
    async modelAuthorization(id, baseURL) { assert.equal(id, 'school'); assert.equal(baseURL, config.baseURL); return loggedIn },
    async authorizedFetch(id, url, init, authorization) {
      assert.equal(id, 'school')
      assert.equal(authorization, undefined, 'generation does not opt into 401 replay')
      assert.equal(new Headers(init.headers).has('authorization'), false)
      calls.push({ url, method: init.method })
      if (url.endsWith('/capabilities')) return Response.json({ operations: ['generate', 'cover', 'transcribe', 'plan'] })
      if (url.endsWith('/artifacts')) return Response.json({ artifacts: [{ name: 'audio.flac' }] })
      if (url.endsWith('/audio.flac')) return new Response('fLaC-synthetic', { headers: { 'Content-Type': 'audio/flac' } })
      return Response.json({ id: 'host-job', status: init.method === 'POST' ? 'queued' : 'succeeded' }, { status: url.endsWith('/generations') ? 202 : 200 })
    },
  })
  assert.equal(mounted.tools.size, 6)
  const call = async (name, args = {}) => result(await mounted.tools.get(name).execute(args, exec))
  assert.deepEqual((await call('ecnu_music_capabilities')).operations, ['generate', 'cover', 'transcribe', 'plan'])
  const submitted = await call('ecnu_music_submit', { operation: 'generate', style: 'orchestra', lyrics: '希望', n: 2 })
  assert.equal(submitted.submission, 'accepted')
  assert.equal((await call('ecnu_music_job', { job_id: 'host-job' })).status, 'succeeded')
  await call('ecnu_music_artifacts', { job_id: 'host-job' })
  const download = await mounted.tools.get('ecnu_music_download').execute({ job_id: 'host-job', artifact: 'audio.flac' }, exec)
  assert.equal(download.mime, 'audio/flac')
  assert.equal(await readFile(result(download).path, 'utf8'), 'fLaC-synthetic')
  await call('ecnu_music_cancel', { job_id: 'host-job' })
  loggedIn = false
  const count = calls.length
  await assert.rejects(call('ecnu_music_capabilities'), /登录/)
  assert.equal(calls.length, count)
})

test('logout or authorization replacement prevents stale result delivery', async () => {
  let finish
  const mounted = mount({ modelAuthorization: async () => true, authorizedFetch: () => new Promise(resolve => { finish = resolve }) })
  const pending = mounted.tools.get('ecnu_music_capabilities').execute({}, { signal: new AbortController().signal })
  await new Promise(resolve => setImmediate(resolve))
  mounted.handlers.get('oidc/accounts-changed')({ profileID: 'school', authorizationChanged: true })
  finish(Response.json({ secretUserResult: 'must not reach the model' }))
  await assert.rejects(pending, /account changed/)
})

test('endpoint authorization fails closed without attempting network or personal key', async () => {
  const mounted = mount({ modelAuthorization: async () => false, authorizedFetch() { throw Error('must not call') } })
  await assert.rejects(mounted.tools.get('ecnu_music_capabilities').execute({}, {}), /登录/)
})

test('explicit personal-key mode uses credential manager and never OAuth', async t => {
  let seen
  const server = createServer((req, res) => { seen = req.headers.authorization; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}') })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)) })
  const personal = resolveMusicConfig({ baseURL: `http://127.0.0.1:${server.address().port}/v1`, oidcProfileId: '', credentialRef: 'TEST_KEY' })
  const authorization = await musicAuthorization({ get() { throw Error('must not read OIDC') }, credentials: { resolve: async ref => { assert.equal(ref, 'TEST_KEY'); return { value: 'synthetic-key' } } } }, personal)
  const response = await authorization.fetch(personal.baseURL + '/music/capabilities', {})
  await response.text()
  assert.equal(seen, 'Bearer synthetic-key')
})

test('mutations follow workspace policy, read-only approval and narrowed write roots', async t => {
  const exec = await workspace(t), { ctx, handlers } = mount()
  const check = handlers.get('tools/pre-execute'), next = () => ({ kind: 'continue' })
  assert.deepEqual(await check({ ...exec, name: 'ecnu_music_submit' }, next), { kind: 'continue' })
  ctx.permissionPresets.current = () => 'read-only'
  assert.equal((await check({ ...exec, name: 'ecnu_music_submit' }, next)).kind, 'ask')
  assert.equal((await check({ ...exec, name: 'ecnu_music_cancel' }, next)).displayReason.zh.includes('音乐'), true)
  assert.deepEqual(await check({ name: 'ecnu_music_job' }, next), { kind: 'continue' })
  assert.equal((await check({ name: 'ecnu_music_download' }, next)).kind, 'deny')
  ctx.get = name => name === 'sandboxPolicy' ? { resolve: () => ({ mode: 'workspace-write', workspaceRoot: join(exec.agent.session.header.cwd, 'narrow') }) } : undefined
  assert.equal((await check({ ...exec, name: 'ecnu_music_download' }, next)).kind, 'deny')
})

test('school skill is assembled once with matching account binding and native plugin', async () => {
  const distribution = JSON.parse(await readFile(new URL('../../../distribution.json', import.meta.url)))
  const plugin = distribution.plugins.find(row => row.id === 'chatecnu-music')
  assert.equal(plugin.name, '@chatecnu-work/dsh-tool-ecnu-music')
  const skills = distribution.skills.filter(row => row.name === 'ecnu-music')
  assert.equal(skills.length, 1)
  assert.equal(skills[0].metadata, undefined, 'preserve full display metadata during assembly')
  const skill = await readFile(new URL('../../../skills/ecnu-music/SKILL.md', import.meta.url), 'utf8')
  assert.ok(skill.includes(`oidcProfileId: ${plugin.config.oidcProfileId}`))
  assert.ok(skill.includes(`credentialRef: ${plugin.config.credentialRef}`))
  const metadata = JSON.parse(await readFile(new URL('../../../desktop/configuration-options.json', import.meta.url)))
  for (const key of Object.keys(plugin.config)) assert.ok(metadata[`plugins.chatecnu-music.${key}`])
})

test('actual OIDC Host login authorizes music HTTP; logout blocks it without key fallback', async t => {
  const { Context, Service } = await import('@deepseek-ai/cordis')
  const { default: LlmRuntime } = await import('@deepseek-ai/dsh-llm')
  const { default: Oidc } = await import('@eduwork/dsh-oidc')
  const { fixture } = await import('../../ecnu-account-resources/test/helpers/oidc-http-fixture.mjs')
  const f = await fixture(t, { resources: true, async resourceHandler(req, res, url) {
    if (!url.pathname.startsWith('/v1/music/')) return false
    assert.equal(req.headers.authorization, 'Bearer <ACCESS_TOKEN>')
    if (url.pathname.endsWith('/generations')) {
      const chunks = []; for await (const part of req) chunks.push(part)
      assert.equal(JSON.parse(Buffer.concat(chunks)).seed, undefined)
      assert.ok(req.headers['idempotency-key'])
      res.writeHead(202, { 'Content-Type': 'application/json' }); res.end('{"id":"oidc-job","status":"queued"}')
    } else if (url.pathname.endsWith('/artifacts')) {
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"artifacts":[{"name":"audio.flac"}]}')
    } else if (url.pathname.endsWith('/audio.flac')) {
      res.writeHead(200, { 'Content-Type': 'audio/flac' }); res.end('fLaC-synthetic')
    } else { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"id":"oidc-job","status":"succeeded"}') }
    return true
  } })
  const records = new Map(), opened = [], root = new Context(), fibers = []
  class Credentials extends Service {
    constructor(ctx) { super(ctx, 'credentials') }
    async resolve(ref) { assert.notEqual(ref, 'TEST_MUSIC_KEY'); return records.has(ref) ? { value: records.get(ref) } : undefined }
    async set(ref, value) { records.set(ref, value); this.ctx.emit('credentials/reference-updated', { ref }) }
    async unset(ref) { records.delete(ref); this.ctx.emit('credentials/reference-updated', { ref }) }
  }
  class DesktopServices extends Service {
    constructor(ctx) { super(ctx, 'desktopServices') }
    async openExternal(url) { opened.push(url) }
  }
  t.after(async () => { for (const fiber of fibers.reverse()) await fiber.dispose() })
  for (const plugin of [LlmRuntime, Credentials, DesktopServices]) fibers.push(await root.plugin(plugin))
  fibers.push(await root.plugin(Oidc, { backend: 'desktop', profile: f.rawProfile }))
  await root.oidcAccounts.begin('desktop-test')
  assert.equal((await fetch(opened.at(-1))).status, 200)
  assert.equal((await root.oidcAccounts.status('desktop-test')).state, 'connected')
  const { tools } = mount(root.oidcAccounts, root.credentials, { on: (name, callback) => root.on(name, callback) }, {
    ...config, baseURL: f.origin + '/v1', oidcProfileId: 'desktop-test',
  })
  const exec = await workspace(t)
  const call = async (name, args = {}) => result(await tools.get(name).execute(args, exec))
  const submitted = await call('ecnu_music_submit', { operation: 'generate', style: 'choral anthem', lyrics: '春风与希望' })
  assert.equal(submitted.submission, 'accepted')
  assert.equal((await call('ecnu_music_job', { job_id: submitted.job.id })).status, 'succeeded')
  const downloaded = await call('ecnu_music_download', { job_id: submitted.job.id, artifact: 'audio.flac' })
  assert.equal(await readFile(downloaded.path, 'utf8'), 'fLaC-synthetic')
  assert.doesNotMatch(JSON.stringify([submitted, downloaded]), /ACCESS_TOKEN|synthetic-refresh/)
  await root.oidcAccounts.logout('desktop-test')
  const before = f.requests.filter(row => row.path.startsWith('/v1/music')).length
  await assert.rejects(call('ecnu_music_job', { job_id: 'oidc-job' }), /登录/)
  assert.equal(f.requests.filter(row => row.path.startsWith('/v1/music')).length, before)
  assert.equal(records.size, 0)
})
