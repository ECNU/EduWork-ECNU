import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { apply } from '../lib/index.js'

const args = { state: '校园卡丢失', questions: { route: { type: 'choice', instructions: 'Route?', criteria: { card: '校园卡', other: '其他' } } } }
const response = { answers: { route: { type: 'choice', choice: 'card', confidence: 0.9 } }, gateway: { requested_model: 'ecnu-decision' } }
const config = { baseURL: 'https://school.example.org/v1', oidcProfileId: 'school' }
function mount(account, overrides = {}, rawConfig = config) {
  const tools = new Map(), events = new Map(), dispose = []
  const ctx = { tools: { register(tool) { tools.set(tool.name, tool) } },
    credentials: { resolve() { assert.fail('no fallback key in school mode') } },
    get: name => name === 'oidcAccounts' ? account : undefined,
    on(name, callback) { events.set(name, callback) }, effect(callback) { dispose.push(callback()) }, ...overrides }
  apply(ctx, rawConfig)
  return { tools, events, dispose, call: (args, exec) => tools.get('ecnu_decision').execute(args, exec) }
}

test('actual DSH schema supports JSON state and question maps; native registration uses Host auth', async () => {
  let calls = 0
  const mounted = mount({
    async modelAuthorization(id, url) { assert.equal(id, 'school'); assert.equal(url, config.baseURL); return true },
    async authorizedFetch(id, url, init, options) {
      calls++; assert.equal(id, 'school'); assert.equal(url, config.baseURL + '/systemone'); assert.equal(options, undefined)
      assert.equal(new Headers(init.headers).has('authorization'), false)
      assert.equal(JSON.parse(init.body).model, 'ecnu-decision'); return Response.json(response)
    },
  })
  assert.equal(mounted.tools.size, 1)
  const tool = mounted.tools.get('ecnu_decision')
  assert.equal(tool.parameters.properties.questions.additionalProperties, true)
  await assert.rejects(mounted.call({ ...args, questions: [] }), /questions/)
  assert.deepEqual(JSON.parse((await mounted.call(args)).reportJSON), response)
  assert.equal(calls, 1)
})

test('missing login and disabled plugin never send network requests', async () => {
  await assert.rejects(mount({ modelAuthorization: async () => false }).call(args), /登录/)
  assert.equal(mount(undefined, {}, { ...config, enabled: false }).tools.size, 0)
})

test('logout, account changes and disposal suppress pending results', async () => {
  for (const trigger of [m => m.events.get('oidc/accounts-changed')({ profileID: 'school', authorizationChanged: true }), m => m.dispose[0]()]) {
    let finish
    const mounted = mount({ modelAuthorization: async () => true, authorizedFetch: () => new Promise(resolve => { finish = resolve }) })
    const pending = mounted.call(args)
    await new Promise(resolve => setImmediate(resolve))
    trigger(mounted); finish(Response.json(response))
    await assert.rejects(pending, /account changed/)
  }
})

test('unrelated account events leave a pending request intact; cancellation reaches fetch', async () => {
  const mounted = mount({ modelAuthorization: async () => true, async authorizedFetch(_id, _url, init) {
    mounted.events.get('oidc/accounts-changed')({ profileID: 'someone-else', authorizationChanged: true })
    assert.equal(init.signal.aborted, false); return Response.json(response)
  } })
  await mounted.call(args)
  let called = false
  await assert.rejects(mount({ modelAuthorization: async () => { called = true; return true } }).call(args, { signal: AbortSignal.abort() }))
  assert.equal(called, false)
})

test('personal API key mode authenticates only the configured endpoint and rejects redirects', async t => {
  let count = 0
  const server = createServer((req, res) => {
    count++; assert.equal(req.headers.authorization, 'Bearer SYNTHETIC_KEY')
    res.writeHead(307, { location: '/unexpected' }); res.end()
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)) })
  const mounted = mount(undefined, { credentials: { resolve: async () => ({ value: 'SYNTHETIC_KEY' }) } }, { baseURL: `http://127.0.0.1:${server.address().port}/v1`, oidcProfileId: '' })
  await assert.rejects(mounted.call(args))
  assert.equal(count, 1)
})

test('distribution, configuration help and skill have one consistent account binding', async () => {
  const distribution = JSON.parse(await readFile(new URL('../../../distribution.json', import.meta.url)))
  const plugins = distribution.plugins.filter(row => row.id === 'chatecnu-decision')
  assert.equal(plugins.length, 1); assert.equal(plugins[0].name, '@chatecnu-work/dsh-tool-ecnu-decision')
  const skills = distribution.skills.filter(row => row.name === 'ecnu-decision')
  assert.equal(skills.length, 1); assert.equal(skills[0].defaultEnabled, true); assert.equal(skills[0].metadata, undefined)
  const skill = await readFile(new URL('../../../skills/ecnu-decision/SKILL.md', import.meta.url), 'utf8')
  for (const field of ['oidcProfileId', 'credentialRef']) assert.ok(skill.includes(`${field}: ${plugins[0].config[field]}`))
  const options = JSON.parse(await readFile(new URL('../../../desktop/configuration-options.json', import.meta.url)))
  for (const key of Object.keys(plugins[0].config)) assert.ok(options[`plugins.chatecnu-decision.${key}`])
})

test('real OIDC Host authorizes SystemOne after login; logout blocks access without fallback', async t => {
  const { Context, Service } = await import('@deepseek-ai/cordis')
  const { default: LlmRuntime } = await import('@deepseek-ai/dsh-llm')
  const { default: Oidc } = await import('@eduwork/dsh-oidc')
  const { fixture } = await import('../../ecnu-account-resources/test/helpers/oidc-http-fixture.mjs')
  const f = await fixture(t, { resources: true, async resourceHandler(req, res, url) {
    if (url.pathname !== '/v1/systemone') return false
    assert.equal(req.headers.authorization, 'Bearer <ACCESS_TOKEN>')
    const chunks = []; for await (const part of req) chunks.push(part)
    assert.equal(JSON.parse(Buffer.concat(chunks)).model, 'ecnu-decision')
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(response)); return true
  } })
  const records = new Map(), opened = [], root = new Context(), fibers = []
  class Credentials extends Service {
    constructor(ctx) { super(ctx, 'credentials') }
    async resolve(ref) { return records.has(ref) ? { value: records.get(ref) } : undefined }
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
  await root.oidcAccounts.begin('desktop-test'); assert.equal((await fetch(opened.at(-1))).status, 200)
  const mounted = mount(root.oidcAccounts, { credentials: root.credentials, on: (name, callback) => root.on(name, callback) }, { baseURL: f.origin + '/v1', oidcProfileId: 'desktop-test' })
  const result = await mounted.call(args)
  assert.deepEqual(JSON.parse(result.reportJSON), response); assert.doesNotMatch(result.reportJSON, /ACCESS_TOKEN|synthetic-refresh/)
  await root.oidcAccounts.logout('desktop-test')
  await assert.rejects(mounted.call(args), /登录/)
  assert.equal(f.requests.filter(row => row.path === '/v1/systemone').length, 1)
})
