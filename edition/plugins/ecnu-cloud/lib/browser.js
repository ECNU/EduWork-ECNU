import { randomUUID } from 'node:crypto'
import { principalOf } from '@deepseek-ai/dsh-typert-protocol'
import { z } from 'zod'
import { historyDigest } from './importer.js'

const id = z.string().min(1).max(256).regex(/^[\p{L}\p{N}_-]+$/u)
const page = z.number().int().min(1).max(10000)
const inputSchema = z.object({ lease: z.string().uuid(), page: page.optional(), conversationID: id.optional() }).strict()
const fail = code => { throw Object.assign(new Error(code), { code }) }
const safeCodes = new Set(['not_connected', 'identity_unavailable', 'account_changed', 'not_configured', 'permission_denied', 'sign_in_required', 'rate_limited', 'unsupported_history', 'history_changed', 'too_large', 'invalid_response', 'missing_workspace', 'missing_directory', 'missing_or_moved_session', 'binding_needs_repair', 'workspace_changed', 'binding_changed', 'workspace_not_linked', 'project_already_linked', 'workspace_already_linked', 'timeout', 'cancelled'])
for (const code of ['project_mapping_unavailable', 'project_unbound', 'project_workspace_mismatch', 'project_missing_workspace', 'project_missing_directory']) safeCodes.add(code)
export function normalizeConversations(data, requestedPage, limit) {
  if (!data || !Array.isArray(data.items) || data.items.length > limit || data.page !== requestedPage || data.page_size !== limit || typeof data.has_more !== 'boolean') fail('invalid_response')
  const seen = new Set()
  const items = data.items.map(row => {
    const conversationID = id.parse(row.id)
    if (seen.has(conversationID) || typeof row.topic !== 'string' || row.topic.length > 20000 || !Number.isFinite(row.lastUpdate)) fail('invalid_response')
    seen.add(conversationID)
    return { conversationID, title: row.topic.slice(0, 300) || '未命名会话', updatedAt: row.lastUpdate,
      projectID: row.workspaceId == null ? null : id.parse(String(row.workspaceId)) }
  })
  return { items, page: requestedPage, hasMore: data.has_more }
}
/** Whitelist visible text; never import thinking, tools, system prompts or arbitrary source fields. */
export function normalizeMessages(data, conversationID, requestedPage, limit) {
  if (!data || data.conversation_id !== conversationID || data.page !== requestedPage || data.page_size !== limit || !Number.isSafeInteger(data.total) || data.total < 0 || !Array.isArray(data.items) || data.items.length > limit) fail('invalid_response')
  return { total: data.total, items: data.items.map(row => {
    const messageID = id.parse(row.id), at = Date.parse(row.date)
    if (!Number.isFinite(at)) fail('invalid_response')
    const supported = ['user', 'assistant'].includes(row.role) && typeof row.content === 'string' && row.streaming === false
      && !['attachments', 'files', 'images', 'tool_calls', 'function_call'].some(key => row[key] != null && (!Array.isArray(row[key]) || row[key].length > 0))
    return { messageID, role: row.role === 'user' ? 'user' : row.role === 'assistant' ? 'assistant' : 'unsupported',
      text: ['user', 'assistant'].includes(row.role) && typeof row.content === 'string' ? row.content : '[此消息包含尚不支持的内容]', at, supported }
  }) }
}
export function createBrowser(service) {
  let active
  function owner() { if (principalOf(service.ctx.invocation) !== undefined) fail('permission_denied') }
  async function context(lease) {
    owner()
    const account = await service.account()
    if (!active || active.scope !== account.scope || active.epoch !== account.epoch) active = { ...account, lease: randomUUID(), summaries: new Map(), pages: new Map() }
    if (lease && lease !== active.lease) fail('account_changed')
    return { ...account, lease: active.lease, summaries: active.summaries, pages: active.pages }
  }
  async function current(c) {
    c.signal?.throwIfAborted()
    service.guard(c)
    const now = await service.account()
    if (now.scope !== c.scope || now.epoch !== c.epoch) fail('account_changed')
    c.signal?.throwIfAborted()
  }
  async function read(c, operation, args) {
    await current(c)
    const reader = service.ctx.get('ecnuAiconsole')
    if (!reader || reader.profileID !== service.config.profileID) fail('not_configured')
    const result = await reader.read(operation, args, { signal: AbortSignal.any([AbortSignal.timeout(25000), ...(c.signal ? [c.signal] : [])]) })
    await current(c)
    return result.data
  }
  async function run(work) {
    try { return { state: 'available', ...await work() } }
    catch (error) { return { state: error.name === 'TimeoutError' ? 'timeout' : error.name === 'AbortError' ? 'cancelled' : safeCodes.has(error.code) ? error.code : 'unavailable' } }
  }
  async function history(c, conversationID) {
    if (!c.summaries.has(conversationID)) fail('account_changed')
    const messages = [], seen = new Set(); let total, bytes = 0, previous = -Infinity
    for (let number = 1; number <= 10; number++) {
      const result = normalizeMessages(await read(c, 'account_get_messages', { conversation_id: conversationID, page: number, limit: 100 }), conversationID, number, 100)
      if (total !== undefined && total !== result.total) fail('history_changed')
      total = result.total
      if (total > 1000) fail('too_large')
      for (const message of result.items) {
        if (seen.has(message.messageID) || message.at < previous) fail('history_changed')
        seen.add(message.messageID); previous = message.at
        bytes += Buffer.byteLength(message.text, 'utf8')
        if (bytes > 1024 * 1024) fail('too_large')
        messages.push(message)
      }
      if (messages.length === total) return { summary: c.summaries.get(conversationID), messages, importable: messages.every(m => m.supported), total }
      if (!result.items.length || messages.length > total) fail('history_changed')
    }
    fail('too_large')
  }
  return { context, current, history, run,
    async verifySummary(c, conversationID) {
      const number = c.pages.get(conversationID)
      if (!number) fail('history_changed')
      const result = normalizeConversations(await read(c, 'account_list_conversations', { page: number, limit: 20 }), number, 20)
      const latest = result.items.find(row => row.conversationID === conversationID)
      if (!latest || JSON.stringify(latest) !== JSON.stringify(c.summaries.get(conversationID))) fail('history_changed')
    },
    state: () => run(async () => ({ lease: (await context()).lease })),
    list: (input, signal) => run(async () => {
      const parsed = inputSchema.parse(input), c = await context(parsed.lease), number = parsed.page ?? 1
      c.signal = signal
      const result = normalizeConversations(await read(c, 'account_list_conversations', { page: number, limit: 20 }), number, 20)
      for (const row of result.items) { c.summaries.set(row.conversationID, row); c.pages.set(row.conversationID, number) }
      // Bounded owner-only selection cache, never persist cloud content during browsing.
      while (c.summaries.size > 2000) { const oldest = c.summaries.keys().next().value; c.summaries.delete(oldest); c.pages.delete(oldest) }
      return { lease: c.lease, ...result }
    }),
    preview: input => run(async () => {
      const parsed = inputSchema.parse(input), c = await context(parsed.lease)
      const value = await history(c, id.parse(parsed.conversationID))
      return { lease: c.lease, ...value, snapshot: historyDigest(value) }
    }),
  }
}
