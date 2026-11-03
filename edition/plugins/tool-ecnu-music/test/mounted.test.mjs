import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { apply, musicAuthorization } from '../lib/index.js'
import { resolveMusicConfig } from '../lib/core.js'
import { wave } from './audio-fixture.mjs'

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

test('real DSH defineTool registers music tools and uses only Host authorization', async t => {
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
  assert.equal(mounted.tools.size, 9)
  assert.equal(mounted.tools.get('ecnu_music_download').timeoutMs, undefined, 'active downloads have no tool-wide deadline')
  assert.equal(mounted.tools.get('ecnu_music_job').timeoutMs, 125000, 'ordinary requests remain bounded')
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

test('mounted download keeps receiving beyond requestTimeoutMs and preserves caller signal', async t => {
  const exec = await workspace(t)
  const mounted = mount({
    modelAuthorization: async () => true,
    authorizedFetch: async (_id, url) => {
      if (url.endsWith('/artifacts')) return Response.json({ artifacts: [{ name: 'audio.flac' }] })
      let timer
      return new Response(new ReadableStream({
        start(controller) {
          let n = 0
          timer = setInterval(() => { controller.enqueue(new Uint8Array([++n])); if (n === 6) { clearInterval(timer); controller.close() } }, 250)
        }, cancel() { clearInterval(timer) },
      }))
    },
  }, undefined, {}, { ...config, requestTimeoutMs: 1000, downloadIdleTimeoutMs: 1000 })
  const started = Date.now()
  const value = result(await mounted.tools.get('ecnu_music_download').execute({ job_id: 'slow', artifact: 'audio.flac' }, exec))
  assert.ok(Date.now() - started > 1000)
  assert.deepEqual(await readFile(value.path), Buffer.from([1, 2, 3, 4, 5, 6]))
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
  assert.equal((await check({ ...exec, name: 'ecnu_music_render_score' }, next)).kind, 'ask')
  assert.equal((await check({ ...exec, name: 'ecnu_music_export_song' }, next)).kind, 'ask')
  assert.equal((await check({ ...exec, name: 'ecnu_music_cancel' }, next)).displayReason.zh.includes('音乐'), true)
  assert.deepEqual(await check({ name: 'ecnu_music_job' }, next), { kind: 'continue' })
  assert.equal((await check({ name: 'ecnu_music_download' }, next)).kind, 'deny')
  ctx.get = name => name === 'sandboxPolicy' ? { resolve: () => ({ mode: 'workspace-write', workspaceRoot: join(exec.agent.session.header.cwd, 'narrow') }) } : undefined
  assert.equal((await check({ ...exec, name: 'ecnu_music_download' }, next)).kind, 'deny')
  assert.equal((await check({ ...exec, name: 'ecnu_music_render_score' }, next)).kind, 'deny')
  assert.equal((await check({ ...exec, name: 'ecnu_music_export_song' }, next)).kind, 'deny')
})

test('native HTML score tool works without login or credentials and returns a workspace preview', async t => {
  const exec = await workspace(t)
  const mounted = mount({ modelAuthorization() { throw Error('Local score must not request school authorization') }, authorizedFetch() { throw Error('Local score must not call network') } })
  const output = await mounted.tools.get('ecnu_music_render_score').execute({ abc: 'X:1\nK:C\nCDEF|' }, exec)
  assert.equal(output.mime, 'text/html')
  assert.match(output.relativePath, /^\.eduwork\/generated\/music\/score-.*\.html$/)
  assert.match(await readFile(result(output).path, 'utf8'), /abcjs_basic v6\.7\.2/)
})

test('native song export resolves workspace paths and does not request credentials or school login', async t => {
  const exec = await workspace(t)
  await writeFile(join(exec.agent.session.header.cwd, 'audio.wav'), wave())
  const mounted = mount({ modelAuthorization() { throw Error('Local export must not request authorization') } })
  const output = await mounted.tools.get('ecnu_music_export_song').execute({abc:'X:1\nK:C\nCDEF|',lyrics:'希望',audio_path:'audio.wav'},exec)
  assert.equal(output.mime,'text/html')
  assert.match(output.relativePath,/song-[^/]+\/index.html$/)
  assert.deepEqual(await readFile(join(result(output).directory,'audio.wav')),wave())
  const timeline=JSON.parse(await readFile(join(result(output).directory,'timeline.json'),'utf8'))
  timeline.durationMs=2000;timeline.lyrics.cues=[{text:'希望',startMs:500,endMs:1500}]
  await writeFile(join(exec.agent.session.header.cwd,'timeline.json'),JSON.stringify(timeline))
  const timed=await mounted.tools.get('ecnu_music_export_song').execute({abc:'X:1\nK:C\nCDEF|',lyrics:'希望',audio_path:'audio.wav',timeline_path:'timeline.json'},exec)
  assert.equal(result(timed).timelineStatus,'draft')
})

test('deferred school skill source keeps matching account binding with the assembled native plugin', async () => {
  const distribution = JSON.parse(await readFile(new URL('../../../distribution.json', import.meta.url)))
  const plugin = distribution.plugins.find(row => row.id === 'chatecnu-music')
  assert.equal(plugin.name, '@chatecnu-work/dsh-tool-ecnu-music')
  const skills = distribution.skills.filter(row => row.name === 'ecnu-music')
  assert.equal(skills.length, 0, 'music skill is distributed after the model service launches')
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
