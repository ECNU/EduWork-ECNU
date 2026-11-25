import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowser, normalizeConversations, normalizeMessages } from '../lib/browser.js'
const row = { id: 'cloud-1', topic: '<script>title</script>', lastUpdate: 1700000000000, workspaceId: '18', userId: 'private' }
const msg = (i, role = i % 2 ? 'assistant' : 'user') => ({ id: `m-${i}`, role, content: `text ${i}`, date: new Date(1700000000000 + i).toISOString(), streaming: false, thinking: 'private reasoning' })
function fixture() {
  const calls = []; let epoch = 0, scope = 'account-a', response
  const service = { config: { profileID: 'school' }, account: async () => ({ epoch, scope }), guard: a => { if (a.epoch !== epoch) throw Object.assign(Error(), { code: 'account_changed' }) },
    ctx: { invocation: undefined, get: () => ({ profileID: 'school', async read(op, args) { calls.push({ op, args }); if (response) return { data: await response(op, args) }; return { data: op === 'account_list_conversations' ? { items: [row], page: args.page, page_size: args.limit, has_more: false } : { conversation_id: args.conversation_id, items: [msg(0), msg(1)], page: args.page, page_size: args.limit, total: 2 } } } }) } }
  const browser = createBrowser(service)
  return { browser, calls, service, setResponse: value => { response = value }, change: () => { epoch++; scope = 'account-b' }, async select() { const state = await browser.state(); await browser.list({ lease: state.lease }); return { lease: state.lease, conversationID: 'cloud-1' } } }
}
test('browser shares fixed read operations and projects only visible text', async () => {
  const f = fixture(), input = await f.select(), result = await f.browser.preview(input)
  assert.equal(result.state, 'available'); assert.equal(result.importable, true)
  assert.equal(result.summary.projectID, '18'); assert.equal(result.messages.length, 2)
  assert.ok(!JSON.stringify(result).includes('private')); assert.deepEqual(f.calls.map(x => x.op), ['account_list_conversations', 'account_get_messages'])
  assert.equal((await f.browser.preview({ ...input, conversationID: 'never-listed' })).state, 'account_changed')
})
test('pagination must be complete and reject changing totals, duplicates and reversed time', async () => {
  for (const kind of ['complete', 'total', 'duplicate', 'order']) {
    const f = fixture(), input = await f.select()
    f.setResponse((_op, args) => ({ conversation_id: 'cloud-1', page: args.page, page_size: 100, total: args.page === 2 && kind === 'total' ? 100 : 101,
      items: args.page === 1 ? Array.from({ length: 100 }, (_, i) => msg(i)) : [kind === 'duplicate' ? msg(1) : kind === 'order' ? { ...msg(100), date: msg(0).date } : msg(100)] }))
    const result = await f.browser.preview(input)
    assert.equal(result.state, kind === 'complete' ? 'available' : 'history_changed')
    if (kind === 'complete') assert.equal(result.messages.length, 101)
  }
})
test('changing account during a request discards the old response and selection lease', async () => {
  const f = fixture(), input = await f.select()
  f.setResponse(() => { f.change(); return {} })
  assert.equal((await f.browser.preview(input)).state, 'account_changed')
  assert.equal((await f.browser.list(input)).state, 'account_changed')
})
test('unsupported content remains visible and cannot be marked importable', async () => {
  const f = fixture(), input = await f.select()
  f.setResponse(() => ({ conversation_id: 'cloud-1', page: 1, page_size: 100, total: 2, items: [{ ...msg(0), attachments: [{ id: 'file' }] }, { ...msg(1), streaming: true }] }))
  const result = await f.browser.preview(input)
  assert.equal(result.state, 'available'); assert.equal(result.importable, false)
  assert.equal(result.messages[0].text, 'text 0')
})
test('malformed pagination and unexpected identities fail closed', () => {
  assert.throws(() => normalizeConversations({ items: [row, row], page: 1, page_size: 20, has_more: false }, 1, 20))
  assert.throws(() => normalizeMessages({ conversation_id: 'other', items: [], page: 1, page_size: 100, total: 0 }, 'cloud-1', 1, 100))
})
