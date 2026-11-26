import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, rename } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { Context, Service } from '@deepseek-ai/cordis'
import Storage from '@deepseek-ai/dsh-storage'
import * as Json from '@deepseek-ai/dsh-storage-json'
import * as Domains from '@deepseek-ai/dsh-storage-domain'
import * as Persistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import Workspaces from '@deepseek-ai/dsh-workspace'
import { Session } from '@deepseek-ai/dsh-session'
import Cloud from '../lib/index.js'
import { convertHistory } from '../lib/importer.js'

async function fixture(t, reuse) {
  const root = reuse ?? await mkdtemp(join(tmpdir(), 'ecnu-import-'))
  if (!reuse) t.after(async () => { if (dirname(resolve(root)) !== resolve(tmpdir()) || !root.split(/[\\/]/).at(-1).startsWith('ecnu-import-')) throw Error('Unsafe cleanup'); await rm(root, { recursive: true, force: true }) })
  const ctx = new Context(), fibers = []; let identity = 'a', closed = false, text = 'VISIBLE ANSWER', project = 'project-one'
  const stop = async () => { if (closed) return; closed = true; for (const fiber of fibers.toReversed()) await fiber.dispose() }
  t.after(stop)
  for (const [plugin, config] of [[Storage], [Json, { root: join(root, 'store') }], [Domains, { backend: 'json' }], [Persistence, { root: join(root, 'sessions') }], [Workspaces]]) fibers.push(await ctx.plugin(plugin, config))
  fibers.push(await ctx.plugin(class extends Service {
    constructor(ctx) { super(ctx, 'oidcAccounts') }
    async modelAuthorization() { return true }
    async accountIdentity() { return { profileID: 'school', accountID: identity } }
    async authorizedFetch(_profile, url, init) {
      if (url.endsWith('/conversations/cloud-one')) return Response.json({ workspaceId: project, workspaceContext: { workspace_id: project, legacy_notebook_id: 30 } })
      assert.ok(url.endsWith('/mcp/notebook'))
      if (init.method === 'GET') return new Response(null, { status: 405 })
      const req = JSON.parse(init.body)
      if (req.method === 'notifications/initialized') return new Response(null, { status: 202 })
      if (req.method === 'initialize') return Response.json({ jsonrpc: '2.0', id: req.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'synthetic', version: '1' } } })
      const { name } = req.params
      const data = name === 'notebook_list' ? { code: 0, result: [{ id: 30, name: 'Project' }], next: null } : { code: 0, result: { id: 30 } }
      return Response.json({ jsonrpc: '2.0', id: req.id, result: { content: [{ type: 'text', text: JSON.stringify(data) }] } })
    }
  }))
  fibers.push(await ctx.plugin(class extends Service {
    constructor(ctx) { super(ctx, 'ecnuAiconsole'); this.profileID = 'school' }
    async read(operation, args) { return { data: operation === 'account_list_conversations'
      ? { items: [{ id: 'cloud-one', topic: 'Cloud example', workspaceId: project, lastUpdate: 1700000000000 }], page: args.page, page_size: args.limit, has_more: false }
      : { conversation_id: 'cloud-one', page: args.page, page_size: args.limit, total: 2, items: [
        { id: 'user-one', role: 'user', date: '2026-01-01T00:00:00Z', content: 'VISIBLE QUESTION', streaming: false },
        { id: 'assistant-one', role: 'assistant', date: '2026-01-01T00:00:01Z', content: text, thinking: 'PRIVATE THINKING', streaming: false },
      ] } } }
  }))
  fibers.push(await ctx.plugin(Cloud, { profileID: 'school', modelBaseURL: 'https://example.org/open/api/v1' })); await ctx.ecnuCloud.ready; await ctx.ecnuCloud.importer.ready
  return { ctx, root, stop, move() { project = 'project-two' }, edit() { text = 'CHANGED' }, change() { identity = 'b'; ctx.emit('oidc/accounts-changed', { profileID: 'school', state: 'connected', authorizationChanged: true }) },
    async workspace(name = 'work') { const path = join(root, name); await mkdir(path, { recursive: true }); return ctx.workspaceRegistry.create(path) },
    async input(workspaceID, connect = true) { const state = await ctx.ecnuCloud.cloudState(); await ctx.ecnuCloud.cloudList({ lease: state.lease }); assert.equal((await ctx.ecnuCloud.cloudProjects({ lease: state.lease })).state, 'available'); if (connect) assert.equal((await ctx.ecnuCloud.cloudWorkspaceConnect({ lease: state.lease, projectKey: 'notebook-30', workspaceID })).state, 'available'); const p = await ctx.ecnuCloud.cloudPreview({ lease: state.lease, conversationID: 'cloud-one' }); assert.equal(p.state, 'available'); return { lease: state.lease, conversationID: 'cloud-one', workspaceID, snapshot: p.snapshot, rememberProject: true } },
  }
}
test('official Session validates imported visible history without model execution; concurrent imports deduplicate and survive restart', async t => {
  const f = await fixture(t), workspace = await f.workspace(), input = await f.input(workspace.id)
  const [a, b] = await Promise.all([f.ctx.ecnuCloud.cloudImport(input), f.ctx.ecnuCloud.cloudImport(input)])
  assert.equal(a.state, 'available'); assert.equal(b.state, 'available'); assert.equal(a.sessionID, b.sessionID)
  const records = await f.ctx.sessionPersistence.list(); assert.equal(records.length, 1)
  const handle = await f.ctx.sessionPersistence.open(a.sessionID, 'read'), { events } = await handle.read()
  Session.create(a.sessionID, events, handle.header); await handle.close()
  assert.match(JSON.stringify(events), /VISIBLE QUESTION/); assert.match(JSON.stringify(events), /VISIBLE ANSWER/)
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE THINKING/)
  assert.equal(events.find(e => e.type === 'system/message').data.message.content.length, 0)
  assert.equal(events.find(e => e.type === 'assistant/message').data.message.source.provider, 'chatecnu-cloud-import')
  assert.equal((await f.ctx.ecnuCloud.projectForSession(a.sessionID)).projectID, 'project-one')
  await f.stop(); const next = await fixture(t, f.root), again = await next.ctx.ecnuCloud.cloudImport(await next.input(workspace.id))
  assert.equal(again.sessionID, a.sessionID); assert.equal(again.reused, true); assert.equal((await next.ctx.sessionPersistence.list()).length, 1)
})
test('changed source snapshot and invalid workspace are rejected before any session is created', async t => {
  const f = await fixture(t), w = await f.workspace(), input = await f.input(w.id)
  f.edit(); assert.equal((await f.ctx.ecnuCloud.cloudImport(input)).state, 'history_changed')
  assert.equal((await f.ctx.sessionPersistence.list()).length, 0)
  const fresh = await f.input(w.id); await rename(w.path, join(f.root, 'moved'))
  assert.equal((await f.ctx.ecnuCloud.cloudImport(fresh)).state, 'project_missing_directory')
  assert.equal((await f.ctx.sessionPersistence.list()).length, 0)
})
test('append, flush, attach and mapping failures resume the same durable job across restart', async t => {
  for (const failure of ['append', 'partial', 'flush', 'attach', 'binding']) await t.test(failure, async t => {
    const f = await fixture(t), w = await f.workspace(), input = await f.input(w.id)
    if (['append', 'partial', 'flush'].includes(failure)) {
      const persistence = f.ctx.sessionPersistence, original = persistence.create.bind(persistence)
      persistence.create = async (...args) => {
        const handle = await original(...args)
        return new Proxy(handle, { get(target, key) { if (key === failure || failure === 'partial' && key === 'append') return async (events) => { if (failure === 'partial') await target.append(events.slice(0, 4)); throw Error('Injected failure') }; const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value } })
      }
    } else if (failure === 'attach') w.attachSession = async () => { throw Error('Injected attach failure') }
    else f.ctx.ecnuCloud.rememberConversation = async () => { throw Error('Injected binding failure') }
    assert.notEqual((await f.ctx.ecnuCloud.cloudImport(input)).state, 'available')
    const destination = await f.ctx.ecnuCloud.cloudDestination({ lease: input.lease, conversationID: input.conversationID })
    assert.equal(destination.pending, true); assert.equal(destination.rememberProject, true)
    const before = await f.ctx.sessionPersistence.list(); assert.ok(before.length <= 1)
    await f.stop()
    const next = await fixture(t, f.root)
    const result = await next.ctx.ecnuCloud.cloudImport(await next.input(w.id))
    assert.equal(result.state, 'available'); assert.equal((await next.ctx.sessionPersistence.list()).length, 1)
    if (before.length) assert.equal(result.sessionID, before[0].header.id)
  })
})
test('account change before an import rejects its previous selection lease', async t => {
  const f = await fixture(t), w = await f.workspace(), input = await f.input(w.id)
  f.change(); assert.equal((await f.ctx.ecnuCloud.cloudImport(input)).state, 'account_changed')
  assert.equal((await f.ctx.sessionPersistence.list()).length, 0)
})
test('project moves with identical messages require a fresh preview before import', async t => {
  const f = await fixture(t), w = await f.workspace(), input = await f.input(w.id)
  f.move(); assert.equal((await f.ctx.ecnuCloud.cloudImport(input)).state, 'history_changed')
  assert.equal((await f.ctx.sessionPersistence.list()).length, 0)
})
test('cancellation after a durable prefix stops attachment and resumes the reserved session', async t => {
  const f = await fixture(t), w = await f.workspace(), input = await f.input(w.id), controller = new AbortController()
  const persistence = f.ctx.sessionPersistence, create = persistence.create.bind(persistence)
  persistence.create = async (...args) => {
    const handle = await create(...args)
    return new Proxy(handle, { get(target, key) {
      if (key === 'append') return async events => { await target.append(events.slice(0, 4)); controller.abort() }
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value
    } })
  }
  assert.notEqual((await f.ctx.ecnuCloud.cloudImport(input, controller.signal)).state, 'available')
  assert.equal((await f.ctx.ecnuCloud.conversation('cloud-one')).state, 'unbound')
  const before = await persistence.list(); assert.equal(before.length, 1)
  const restored = await f.ctx.ecnuCloud.cloudImport(input)
  assert.equal(restored.state, 'available'); assert.equal(restored.sessionID, before[0].header.id)
  assert.equal((await persistence.list()).length, 1)
})
test('converter rejects non-user opening and never imports tool or system history', () => {
  assert.throws(() => convertHistory({ importable: false, messages: [{ role: 'system' }] }, 'session-one', 'x'), { code: 'unsupported_history' })
})

test('project import requires the explicit unique knowledge binding and rejects another destination even on reuse', async t => {
  const f = await fixture(t), w = await f.workspace(), other = await f.workspace('other'), input = await f.input(w.id, false)
  assert.equal((await f.ctx.ecnuCloud.cloudDestination(input)).bindingState, 'project_unbound')
  assert.equal((await f.ctx.ecnuCloud.cloudImport(input)).state, 'project_unbound')
  assert.equal((await f.ctx.sessionPersistence.list()).length, 0)
  await f.ctx.ecnuCloud.cloudWorkspaceConnect({ lease: input.lease, projectKey: 'notebook-30', workspaceID: w.id })
  assert.equal((await f.ctx.ecnuCloud.cloudImport({ ...input, workspaceID: other.id })).state, 'project_workspace_mismatch')
  const accepted = await f.ctx.ecnuCloud.cloudImport(input); assert.equal(accepted.state, 'available')
  assert.equal((await f.ctx.ecnuCloud.cloudImport({ ...input, workspaceID: other.id })).state, 'project_workspace_mismatch')
  await f.ctx.ecnuCloud.cloudWorkspaceDisconnect({ lease: input.lease, projectKey: 'notebook-30', workspaceID: w.id })
  assert.equal((await f.ctx.ecnuCloud.cloudImport(input)).state, 'project_unbound')
  assert.equal((await f.ctx.sessionPersistence.list()).length, 1)
})
