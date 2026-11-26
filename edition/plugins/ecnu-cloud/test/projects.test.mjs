import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowser } from '../lib/browser.js'
import { createProjects, createProjectReader } from '../lib/projects.js'
function fixture() {
  let epoch = 0, summaries = [{ conversationID: 'chat-1', title: 'Project conversation', updatedAt: 1, projectID: '18' }]
  const calls = [], service = { config: { profileID: 'school', workerBaseURL: 'https://school.example/api/worker/v1' },
    account: async () => ({ epoch, scope: 'account' }), guard: c => { if (c.epoch !== epoch) throw Object.assign(Error(), { code: 'account_changed' }) },
    projectWorkspace: async () => ({ state: 'available', workspaceID: 'local' }), ctx: { invocation: undefined, get: () => ({ profileID: 'school', read: async (_op, args) => ({ data: { page: args.page, page_size: 20, has_more: args.page * 20 < summaries.length, items: summaries.slice((args.page - 1) * 20, args.page * 20).map(r => ({ id: r.conversationID, topic: r.title, lastUpdate: r.updatedAt, workspaceId: r.projectID })) } }) }) } }
  service.browser = createBrowser(service)
  const reader = { mapping: async (c, row) => { calls.push(['mapping', row.projectID]); return 30 }, notebook: async (c, name, args) => {
    await service.browser.current(c); calls.push([name, args])
    if (name === 'notebook_list') return { code: 0, result: [{ id: 30, name: 'Project', description: '', ownerUserId: 'private' }, { id: 31, name: 'Legacy' }], next: null }
    if (name === 'notebook_list_sources') return { ok: true, notebook_id: args.notebook_id, sources: [{ source_id: 95, file_name: 'Reference.docx', source_type: 'file', status: 'ready', contentRef: 'private' }] }
    return { ok: true, source_id: args.source_id, content: '', content_empty: true }
  } }
  return { service, reader, calls, change: () => epoch++, setSummaries: value => { summaries = value }, projects: createProjects(service, reader), async input() { return { lease: (await service.browser.state()).lease } } }
}
test('projects require explicit mappings and expose only known source IDs', async () => {
  const f = fixture(), input = await f.input(), list = await f.projects.list(input)
  assert.equal(list.state, 'available'); assert.equal(list.projects[0].projectID, '18'); assert.equal(list.projects[1].projectID, null)
  assert.ok(!JSON.stringify(list).includes('private'))
  const selected = { ...input, projectKey: 'notebook-30' }, detail = await f.projects.detail(selected)
  assert.equal(detail.state, 'available'); assert.equal(detail.conversations.length, 1); assert.equal(detail.workspaceID, undefined, 'old continuation defaults do not grant workspace knowledge'); assert.ok(!JSON.stringify(detail).includes('private'))
  const count = f.calls.length
  assert.equal((await f.projects.source({ ...selected, sourceID: 96 })).state, 'permission_denied'); assert.equal(f.calls.length, count)
  assert.equal((await f.projects.source({ ...selected, sourceID: 95 })).empty, true)
  f.reader.notebook = async () => { throw Object.assign(Error(), { code: 'permission_denied' }) }
  assert.equal((await f.projects.source({ ...selected, sourceID: 95 })).state, 'permission_denied')
  f.change(); assert.equal((await f.projects.detail(selected)).state, 'account_changed')
})
test('failed mappings are deduplicated, capped and never guess notebook IDs', async () => {
  for (const unique of [false, true]) {
    const f = fixture(); f.setSummaries(Array.from({ length: 100 }, (_, i) => ({ conversationID: `chat-${i}`, title: 'Chat', updatedAt: 1, projectID: unique ? String(i + 1) : '18' })))
    let attempts = 0; f.reader.mapping = async () => { attempts++; throw Error('offline') }
    const result = await f.projects.list(await f.input())
    assert.equal(attempts, unique ? 50 : 1); assert.equal(result.incomplete, true); assert.ok(result.projects.every(p => p.projectID === null))
  }
})
test('mapping rate limits stop discovery rather than silently returning a partial success', async () => {
  const f = fixture(); f.reader.mapping = async () => { throw Object.assign(Error(), { code: 'rate_limited' }) }
  assert.equal((await f.projects.list(await f.input())).state, 'rate_limited')
})

test('knowledge libraries remain discoverable when conversation reads are not configured', async () => {
  const f = fixture(); f.service.ctx.get = () => undefined
  const result = await f.projects.list(await f.input())
  assert.equal(result.state, 'available'); assert.equal(result.projects.length, 2)
  assert.equal(result.incomplete, true); assert.ok(result.projects.every(p => p.projectID === null))
})
test('explicit cancellation and an overall deadline reach project reads', async () => {
  const f = fixture(), input = await f.input(), controller = new AbortController()
  f.reader.notebook = async c => new Promise((resolve, reject) => { c.signal.throwIfAborted(); c.signal.addEventListener('abort', () => reject(c.signal.reason), { once: true }) })
  const pending = f.projects.list(input, controller.signal); setTimeout(() => controller.abort(), 10)
  assert.equal((await pending).state, 'cancelled')
  const timeout = AbortSignal.timeout
  AbortSignal.timeout = ms => timeout(ms === 60000 ? 25 : ms)
  const keepAlive = setInterval(() => {}, 100)
  try { assert.equal((await f.projects.list(input)).state, 'timeout') } finally { AbortSignal.timeout = timeout; clearInterval(keepAlive) }
})
test('real MCP transport grants only the exact issuer POST path, with GET kept read-only', async () => {
  const f = fixture(), calls = []
  f.service.ctx.oidcAccounts = { authorizedFetch: async (_id, url, init, auth) => {
    assert.equal(url, 'https://school.example/api/worker/v1/mcp/notebook'); calls.push({ method: init.method, auth })
    if (init.method === 'GET') { assert.deepEqual(auth, { serviceURL: url }); return new Response(null, { status: 405 }) }
    assert.deepEqual(auth, { issuerServicePath: '/api/worker/v1/mcp/notebook', retryUnauthorized: true }); assert.equal(typeof init.body, 'string')
    const request = JSON.parse(init.body)
    if (request.method === 'notifications/initialized') return new Response(null, { status: 202 })
    const data = request.params?.name === 'notebook_list_sources'
      ? [{ type: 'text', text: JSON.stringify({ ok: true, notebook_id: 30, sources: [] }), id: 'legacy' }]
      : { code: 0, result: [], next: null }
    const result = request.method === 'initialize' ? { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'synthetic', version: '1' } }
      : { content: [{ type: 'text', text: JSON.stringify(data) }] }
    return Response.json({ jsonrpc: '2.0', id: request.id, result })
  } }
  const reader = createProjectReader(f.service), c = await f.service.browser.context()
  const result = await reader.notebook(c, 'notebook_list', { page: 0, page_size: 20 }); assert.deepEqual(result.result, [])
  assert.deepEqual(await reader.notebook(c, 'notebook_list_sources', { notebook_id: 30 }), { ok: true, notebook_id: 30, sources: [] })
  assert.ok(calls.some(c => c.method === 'POST')); const count = calls.length
  await assert.rejects(reader.notebook(c, 'notebook_delete', { notebook_id: 30 }), { code: 'permission_denied' }); assert.equal(calls.length, count)
  f.service.ctx.oidcAccounts.authorizedFetch = async () => new Response(null, { status: 429 })
  await assert.rejects(reader.notebook(c, 'notebook_list', {}), error => error.code === 'rate_limited' || error.cause?.code === 'rate_limited')
})
