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
import Cloud from '../lib/index.js'

const config = { profileID: 'school', modelBaseURL: 'https://example.org/open/api/v1' }
async function fixture(t, options = {}) {
  const root = options.root ?? await mkdtemp(join(tmpdir(), 'ecnu-cloud-'))
  if (!options.root) t.after(async () => {
    const target = resolve(root)
    if (dirname(target) !== resolve(tmpdir()) || !target.split(/[\\/]/).at(-1).startsWith('ecnu-cloud-')) throw Error('Unsafe test cleanup')
    await rm(target, { recursive: true, force: true })
  })
  const ctx = new Context(), fibers = [], headers = options.headers ?? new Map()
  let account = 'user-a', connected = true, closed = false, cloud
  const stop = async () => { if (closed) return; closed = true; for (const fiber of fibers.toReversed()) await fiber.dispose() }
  t.after(stop)
  fibers.push(await ctx.plugin(Storage))
  fibers.push(await ctx.plugin(Json, { root: join(root, 'store') }))
  fibers.push(await ctx.plugin(Domains, { backend: 'json' }))
  fibers.push(await ctx.plugin(class extends Service {
    constructor(ctx) { super(ctx, 'sessionPersistence') }
    async list() { return [...headers.values()].map(header => ({ header })) }
  }))
  fibers.push(await ctx.plugin(Workspaces))
  fibers.push(await ctx.plugin(class extends Service {
    constructor(ctx) { super(ctx, 'oidcAccounts') }
    async modelAuthorization() { return connected }
    async accountIdentity() { return connected ? { profileID: 'school', accountID: account } : null }
  }))
  const mount = async overrides => {
    cloud = await ctx.plugin(Cloud, { ...config, ...overrides })
    fibers.push(cloud); await ctx.ecnuCloud.ready
  }
  await mount(options.config)
  return { root, ctx, headers, stop,
    async remount(overrides = {}) { await cloud.dispose(); await mount(overrides) },
    switchAccount(id) { account = id; ctx.emit('oidc/accounts-changed', { profileID: 'school', state: 'connected', authorizationChanged: true }) },
    signOut() { connected = false; ctx.emit('oidc/accounts-changed', { profileID: 'school', state: 'signed_out' }) },
    async workspace(name) { const path = join(root, name); await mkdir(path, { recursive: true }); return ctx.workspaceRegistry.create(path) },
    async session(workspace, id) { headers.set(id, { id, cwd: workspace.path }); await workspace.attachSession(id); return id },
  }
}
test('official storage/workspace keep stable mappings across rename and Host restart', async t => {
  const f = await fixture(t), workspace = await f.workspace('space')
  await f.session(workspace, 'session-1')
  await f.ctx.ecnuCloud.bindProject('project-a', workspace.id)
  await f.ctx.ecnuCloud.rememberConversation('chat-a', 'session-1', workspace.id, 'project-a')
  await workspace.setTitle('Renamed')
  const expected = await f.ctx.ecnuCloud.conversation('chat-a')
  await f.stop()
  const restarted = await fixture(t, { root: f.root, headers: f.headers })
  assert.deepEqual(await restarted.ctx.ecnuCloud.conversation('chat-a'), expected)
  assert.equal((await restarted.ctx.ecnuCloud.projectWorkspace('project-a')).workspaceID, workspace.id)
})
test('account and environment isolate identical cloud IDs and signed-out access', async t => {
  const f = await fixture(t), w = await f.workspace('space')
  await f.ctx.ecnuCloud.bindProject('same-project', w.id)
  f.switchAccount('user-b')
  assert.deepEqual(await f.ctx.ecnuCloud.projectWorkspace('same-project'), { state: 'unbound' })
  f.switchAccount('user-a')
  await f.remount({ modelBaseURL: 'https://uat.example.org/open/api/v1' })
  assert.deepEqual(await f.ctx.ecnuCloud.projectWorkspace('same-project'), { state: 'unbound' })
  await f.remount()
  assert.equal((await f.ctx.ecnuCloud.projectWorkspace('same-project')).workspaceID, w.id)
  f.signOut()
  await assert.rejects(f.ctx.ecnuCloud.projectWorkspace('same-project'), { code: 'not_connected' })
})
test('changing a project default never moves imported sessions or widens project sources', async t => {
  const f = await fixture(t), a = await f.workspace('a'), b = await f.workspace('b')
  await f.session(a, 'chat-local-a'); await f.session(a, 'chat-local-b'); await f.session(a, 'ordinary')
  await f.ctx.ecnuCloud.bindProject('project-a', a.id)
  await f.ctx.ecnuCloud.rememberConversation('chat-a', 'chat-local-a', a.id, 'project-a')
  await f.ctx.ecnuCloud.rememberConversation('chat-b', 'chat-local-b', a.id, 'project-b')
  await f.ctx.ecnuCloud.bindProject('project-a', b.id)
  assert.equal((await f.ctx.ecnuCloud.projectWorkspace('project-a')).workspaceID, b.id)
  assert.equal((await f.ctx.ecnuCloud.conversation('chat-a')).workspaceID, a.id)
  assert.deepEqual(await f.ctx.ecnuCloud.projectForSession('chat-local-a'), { state: 'bound', projectID: 'project-a' })
  assert.deepEqual(await f.ctx.ecnuCloud.projectForSession('chat-local-b'), { state: 'bound', projectID: 'project-b' })
  assert.deepEqual(await f.ctx.ecnuCloud.projectForSession('ordinary'), { state: 'unbound' })
  await f.ctx.ecnuCloud.unbindProject('project-a')
  assert.equal((await f.ctx.ecnuCloud.projectForSession('chat-local-a')).projectID, 'project-a')
})

test('HTTP environment requires explicit testing configuration and remains separately partitioned', async t => {
  const f = await fixture(t), w = await f.workspace('space')
  await f.ctx.ecnuCloud.bindProject('project', w.id)
  await assert.rejects(f.remount({ modelBaseURL: 'http://192.0.2.10/open/api/v1' }), { code: 'invalid_environment' })
  await f.remount({ modelBaseURL: 'http://192.0.2.10/open/api/v1', allowInsecureDevelopment: true })
  assert.deepEqual(await f.ctx.ecnuCloud.projectWorkspace('project'), { state: 'unbound' })
  await f.ctx.ecnuCloud.bindProject('project', w.id)
  await f.remount()
  assert.equal((await f.ctx.ecnuCloud.projectWorkspace('project')).workspaceID, w.id)
})
test('parallel duplicate registrations are idempotent; conflicting sessions and sources are refused', async t => {
  const f = await fixture(t), w = await f.workspace('space')
  await f.session(w, 'one'); await f.session(w, 'two')
  const same = () => f.ctx.ecnuCloud.rememberConversation('cloud', 'one', w.id, 'project')
  const values = await Promise.all([same(), same()])
  assert.deepEqual(values[0], values[1])
  await assert.rejects(f.ctx.ecnuCloud.rememberConversation('cloud', 'two', w.id, 'project'), { code: 'conversation_already_bound' })
  await assert.rejects(f.ctx.ecnuCloud.rememberConversation('other-cloud', 'one', w.id, 'other-project'), { code: 'session_already_bound' })
  await f.ctx.ecnuCloud.forgetConversation('cloud')
  assert.ok(w.sessionIds.includes('one'))
  await f.ctx.ecnuCloud.rememberConversation('cloud', 'two', w.id, 'project')
})
test('missing directories, registrations and moved sessions require explicit repair without deleting data', async t => {
  const f = await fixture(t), w = await f.workspace('space')
  await f.session(w, 'session')
  await f.ctx.ecnuCloud.bindProject('project', w.id)
  await f.ctx.ecnuCloud.rememberConversation('cloud', 'session', w.id, 'project')
  await w.detachSession('session')
  assert.equal((await f.ctx.ecnuCloud.conversation('cloud')).state, 'missing_or_moved_session')
  assert.deepEqual(await f.ctx.ecnuCloud.projectForSession('session'), { state: 'invalid_local_binding' })
  await rename(w.path, join(f.root, 'renamed'))
  assert.equal((await f.ctx.ecnuCloud.projectWorkspace('project')).state, 'missing_directory')
  await assert.rejects(f.ctx.ecnuCloud.bindProject('new', w.id), { code: 'missing_directory' })
  await f.ctx.workspaceRegistry.delete(w.id)
  assert.equal((await f.ctx.ecnuCloud.projectWorkspace('project')).state, 'missing_workspace')
  assert.ok(f.headers.has('session'))
})
test('account changes while resolving a workspace cancel both active and queued writes', async t => {
  const f = await fixture(t), w = await f.workspace('space'), entered = Promise.withResolvers(), release = Promise.withResolvers()
  const original = w.status.bind(w)
  w.status = async () => { entered.resolve(); await release.promise; return original() }
  const first = f.ctx.ecnuCloud.bindProject('first', w.id), second = f.ctx.ecnuCloud.bindProject('second', w.id)
  const assertions = Promise.all([assert.rejects(first, { code: 'account_changed' }), assert.rejects(second, { code: 'account_changed' })])
  await entered.promise; f.switchAccount('user-b'); release.resolve(); await assertions
  f.switchAccount('user-a')
  assert.deepEqual(await f.ctx.ecnuCloud.projectWorkspace('first'), { state: 'unbound' })
  assert.deepEqual(await f.ctx.ecnuCloud.projectWorkspace('second'), { state: 'unbound' })
})
test('missing verified identity fails closed; failed durable writes preserve previous binding', async t => {
  const f = await fixture(t), a = await f.workspace('a'), b = await f.workspace('b')
  await f.ctx.ecnuCloud.bindProject('project', a.id)
  const table = f.ctx.ecnuCloud.domain.table('projects'), put = table.put.bind(table)
  table.put = async () => { throw Error('synthetic storage failure') }
  await assert.rejects(f.ctx.ecnuCloud.bindProject('project', b.id), /storage failure/)
  table.put = put
  assert.equal((await f.ctx.ecnuCloud.projectWorkspace('project')).workspaceID, a.id)
  f.ctx.oidcAccounts.accountIdentity = undefined
  await assert.rejects(f.ctx.ecnuCloud.projectWorkspace('project'), { code: 'identity_unavailable' })
})
