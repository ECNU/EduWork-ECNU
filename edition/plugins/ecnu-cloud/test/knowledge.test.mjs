import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as Json from '@deepseek-ai/dsh-storage-json'
import * as Domains from '@deepseek-ai/dsh-storage-domain'
import Workspaces from '@deepseek-ai/dsh-workspace'
import Tools from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import Cloud from '../lib/index.js'

async function fixture(t, existingRoot) {
  const root = existingRoot ?? await mkdtemp(join(tmpdir(), 'ecnu-knowledge-'))
  if (!existingRoot) t.after(async () => {
    if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.split(/[\\/]/).at(-1).startsWith('ecnu-knowledge-')) throw Error('Unsafe cleanup')
    await rm(root, { recursive: true, force: true })
  })
  const ctx = new Context(), fibers = [], calls = [], handlers = {}
  let account = 'user-a', connected = true, closed = false, fiber
  const stop = async () => { if (closed) return; closed = true; for (const f of fibers.toReversed()) await f.dispose() }; t.after(stop)
  async function mount(plugin, config) { const f = await ctx.plugin(plugin, config); fibers.push(f); return f }
  await mount(Storage); await mount(Json, { root: join(root, 'store') }); await mount(Domains, { backend: 'json' })
  await mount(class extends Service { constructor(ctx) { super(ctx, 'sessionPersistence') } async list() { return [] } })
  await mount(Workspaces); await mount(SystemPrompt, {}); await mount(Tools)
  await mount(class extends Service {
    constructor(ctx) { super(ctx, 'ecnuAiconsole'); this.profileID = 'school' }
    async read(_op, args) { return { data: { page: args.page, page_size: 20, has_more: false, items: [] } } }
  })
  await mount(class extends Service {
    constructor(ctx) { super(ctx, 'oidcAccounts') }
    async modelAuthorization() { return connected }
    async accountIdentity() { return connected ? { profileID: 'school', accountID: account } : null }
    async authorizedFetch(_profile, url, init, auth) {
      assert.ok(url.endsWith('/mcp/notebook')); assert.equal(init.redirect, 'error')
      if (init.method === 'GET') return new Response(null, { status: 405 })
      assert.deepEqual(auth, { issuerServicePath: new URL(url).pathname, retryUnauthorized: true })
      init.signal.throwIfAborted()
      const req = JSON.parse(init.body)
      if (req.method === 'notifications/initialized') return new Response(null, { status: 202 })
      if (req.method === 'initialize') return Response.json({ jsonrpc: '2.0', id: req.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'synthetic', version: '1' } } })
      const { name, arguments: args } = req.params; calls.push({ name, args })
      let data
      if (handlers[name]) data = await handlers[name](args, init.signal)
      else if (name === 'notebook_list') data = { code: 0, result: [30, 31].map(id => ({ id, name: `Project ${id}` })), next: null }
      else if (name === 'notebook_get') data = { code: 0, result: { id: args.notebook_id } }
      else if (name === 'notebook_list_sources') data = { ok: true, notebook_id: args.notebook_id, sources: [{ source_id: 95, file_name: 'Reference.docx', source_type: 'file', status: 'ready', hidden: 'private' }] }
      else if (name === 'notebook_retrieve') data = { ok: true, notebook_id: args.notebook_id, chunks: [{ source_id: 95, chunk_text: 'Source evidence', score: 0.7, location_json: '{"page":1}' }] }
      else if (name === 'notebook_source_content') data = { ok: true, notebook_id: args.notebook_id, source_id: args.source_id, content: 'abcdefghij', hidden: 'private' }
      else throw Error('Unexpected tool: ' + name)
      init.signal.throwIfAborted()
      return Response.json({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: JSON.stringify(data) }] } })
    }
  })
  async function remount(extra = {}) {
    if (fiber) await fiber.dispose()
    fiber = await mount(Cloud, { profileID: 'school', modelBaseURL: 'https://school.example/open/api/v1', ...extra })
    await ctx.ecnuCloud.ready; await ctx.ecnuCloud.knowledge.ready
  }
  await remount()
  return { root, ctx, calls, handlers, stop, remount,
    async input(projectKey = 'notebook-30') { const { lease } = await ctx.ecnuCloud.cloudState(); assert.equal((await ctx.ecnuCloud.cloudProjects({ lease })).state, 'available'); return { lease, projectKey } },
    async workspace(name) { const path = join(root, name); await mkdir(path, { recursive: true }); return ctx.workspaceRegistry.create(path) },
    agent(workspace) { return { session: { id: 'trusted-session', header: { cwd: workspace.path } } } },
    switchAccount(value) { account = value; ctx.emit('oidc/accounts-changed', { profileID: 'school', state: 'connected', authorizationChanged: true }) },
    signOut() { connected = false; ctx.emit('oidc/accounts-changed', { profileID: 'school', state: 'signed_out' }) },
  }
}
const exec = agent => ({ agent, signal: new AbortController().signal })

test('real RC3 Tools admit only explicitly bound workspaces; execute reads the Host-bound Notebook', async t => {
  const f = await fixture(t), w = await f.workspace('project'), other = await f.workspace('other'), agent = f.agent(w), activation = exec(agent)
  await f.ctx.ecnuCloud.bindProject('30', w.id)
  let admitted = await f.ctx.tools.resolve(activation)
  assert.equal(admitted.view(agent).size, 0, 'old default-workspace preferences confer no knowledge access'); admitted.dispose()
  const input = { ...await f.input(), workspaceID: w.id }
  assert.equal((await f.ctx.ecnuCloud.cloudWorkspaceConnect(input)).state, 'available')
  admitted = await f.ctx.tools.resolve(activation)
  assert.deepEqual([...admitted.view(agent).keys()].sort(), ['ecnu_project_read_source', 'ecnu_project_search', 'ecnu_project_sources'])
  assert.equal(f.ctx.tools.executable('ecnu_project_search', agent), undefined, 'conditional tools cannot execute outside admitted steps')
  const tool = f.ctx.tools.executable('ecnu_project_search', agent, admitted)
  const result = JSON.parse(await tool.execute({ query: 'evidence' }, activation))
  assert.equal(result.chunks[0].title, 'Reference.docx'); assert.equal(result.chunks[0].text, 'Source evidence')
  assert.ok(!JSON.stringify(result).includes('private')); assert.equal(f.calls.at(-1).args.notebook_id, 30)
  const otherAgent = f.agent(other), otherSet = await f.ctx.tools.resolve(exec(otherAgent))
  assert.equal(otherSet.view(otherAgent).size, 0); otherSet.dispose()
  await assert.rejects(tool.execute({ query: 'secret', notebook_id: 31 }, activation))
  await f.ctx.ecnuCloud.cloudWorkspaceDisconnect(input)
  await assert.rejects(tool.execute({ query: 'after unlink' }, activation), /未关联/)
  assert.equal((await f.ctx.tools.resolve(activation)).view(agent).size, 0); admitted.dispose()
})

test('binding is durable, idempotent, account and Notebook endpoint isolated', async t => {
  const f = await fixture(t), w = await f.workspace('project'), input = { ...await f.input(), workspaceID: w.id }
  const first = await f.ctx.ecnuCloud.cloudWorkspaceConnect(input); assert.equal(first.reused, false)
  assert.equal((await f.ctx.ecnuCloud.cloudWorkspaceConnect(input)).reused, true)
  assert.equal((await f.ctx.ecnuCloud.cloudWorkspaceConnect({ ...input, projectKey: 'notebook-31' })).state, 'workspace_already_linked')
  const other = await f.workspace('other')
  assert.equal((await f.ctx.ecnuCloud.cloudWorkspaceConnect({ ...input, workspaceID: other.id })).state, 'project_already_linked')
  await f.ctx.ecnuCloud.knowledge.execute('sources', {}, exec(f.agent(w)))
  await f.remount({ workerBaseURL: '/other-worker/v1' })
  assert.equal(await f.ctx.ecnuCloud.knowledge.available(f.agent(w)), false)
  await f.remount(); assert.equal(await f.ctx.ecnuCloud.knowledge.available(f.agent(w)), true)
  f.switchAccount('user-b'); assert.equal(await f.ctx.ecnuCloud.knowledge.available(f.agent(w)), false)
  f.switchAccount('user-a'); assert.equal(await f.ctx.ecnuCloud.knowledge.available(f.agent(w)), true)
  await f.stop()
  const restarted = await fixture(t, f.root), restored = restarted.ctx.workspaceRegistry.get(w.id)
  assert.equal(await restarted.ctx.ecnuCloud.knowledge.available(restarted.agent(restored)), true)
})

test('source parameters, retrieval results and source identity cannot escape the binding', async t => {
  const f = await fixture(t), w = await f.workspace('project'), input = { ...await f.input(), workspaceID: w.id }
  await f.ctx.ecnuCloud.cloudWorkspaceConnect(input); const execution = exec(f.agent(w)), knowledge = f.ctx.ecnuCloud.knowledge
  await assert.rejects(knowledge.execute('read', { source_id: 96 }, execution), { code: 'permission_denied' })
  await assert.rejects(knowledge.execute('search', { query: 'x', source_ids: [96] }, execution), { code: 'permission_denied' })
  f.handlers.notebook_retrieve = () => ({ ok: true, notebook_id: 30, chunks: [{ source_id: 96, chunk_text: 'foreign' }] })
  await assert.rejects(knowledge.execute('search', { query: 'x' }, execution), { code: 'permission_denied' })
  f.handlers.notebook_source_content = () => ({ ok: true, notebook_id: 31, source_id: 95, content: 'foreign' })
  await assert.rejects(knowledge.execute('read', { source_id: 95 }, execution), { code: 'invalid_response' })
  delete f.handlers.notebook_source_content
  const part = await knowledge.execute('read', { source_id: 95, offset: 2, limit: 3 }, execution)
  assert.equal(part.text, 'cde'); assert.equal(part.next_offset, 5)
  f.handlers.notebook_list_sources = () => ({ ok: false, error: 'revoked' })
  await assert.rejects(knowledge.execute('sources', {}, execution))
})

test('local unlink works after cloud deletion; cancelled and stale results never escape', async t => {
  const f = await fixture(t), w = await f.workspace('project'), input = { ...await f.input(), workspaceID: w.id }
  await f.ctx.ecnuCloud.cloudWorkspaceConnect(input)
  const entered = Promise.withResolvers(), release = Promise.withResolvers()
  f.handlers.notebook_retrieve = async () => { entered.resolve(); await release.promise; return { ok: true, notebook_id: 30, chunks: [] } }
  const pending = f.ctx.ecnuCloud.knowledge.execute('search', { query: 'x' }, exec(f.agent(w)))
  const rejected = assert.rejects(pending, { code: 'binding_changed' }); await entered.promise
  f.handlers.notebook_list = () => ({ code: 0, result: [], next: null })
  await f.ctx.ecnuCloud.cloudProjects({ lease: input.lease })
  assert.equal((await f.ctx.ecnuCloud.cloudWorkspaceBindings({ lease: input.lease })).bindings[0].workspaceID, w.id)
  assert.equal((await f.ctx.ecnuCloud.cloudWorkspaceDisconnect(input)).state, 'available')
  release.resolve(); await rejected
  assert.equal((await f.ctx.ecnuCloud.cloudWorkspaceBindings({ lease: input.lease })).bindings.length, 0)
  delete f.handlers.notebook_list; await f.input(); await f.ctx.ecnuCloud.cloudWorkspaceConnect(input)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(f.ctx.ecnuCloud.knowledge.execute('sources', {}, { agent: f.agent(w), signal: controller.signal }), { name: 'AbortError' })
  await rename(w.path, join(f.root, 'moved'))
  assert.equal(await f.ctx.ecnuCloud.knowledge.available(f.agent(w)), false)
  assert.equal((await f.ctx.ecnuCloud.cloudWorkspaceState(input)).bindingState, 'missing_directory')
})
