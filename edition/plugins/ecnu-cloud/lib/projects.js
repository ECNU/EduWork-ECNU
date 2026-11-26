import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { z } from 'zod'

const fail = code => { throw Object.assign(new Error(code), { code }) }
const input = z.object({ lease: z.string().uuid(), projectKey: z.string().max(256).optional(), sourceID: z.number().int().positive().optional() }).strict()
const numericID = value => { if (!Number.isSafeInteger(value) || value <= 0) fail('invalid_response'); return value }
const text = (value, limit = 300) => typeof value === 'string' ? value.slice(0, limit) : ''
function unwrap(value) {
  if (!value || value.isError || value.ok === false || value.code != null && ![0, 200].includes(value.code)) fail('unavailable')
  return value.result ?? value
}
function mcpData(value) {
  if (value.isError) fail('unavailable')
  let data = value.structuredContent
  if (!data) {
    const item = value.content?.find(block => block.type === 'text')
    if (!item) fail('invalid_response')
    try { data = JSON.parse(item.text) } catch { fail('invalid_response') }
  }
  // The legacy Notebook service wraps some tools in one serialized text block.
  // Decode that observed envelope once; do not accept arbitrary nested payloads.
  if (Array.isArray(data)) {
    if (data.length !== 1 || data[0]?.type !== 'text' || typeof data[0].text !== 'string') fail('invalid_response')
    try { data = JSON.parse(data[0].text) } catch { fail('invalid_response') }
  }
  return data
}
async function bounded(response, signal) {
  if (response.status === 429) { await response.body?.cancel(); fail('rate_limited') }
  if (response.status === 401 || response.status === 403) { await response.body?.cancel(); fail(response.status === 401 ? 'sign_in_required' : 'permission_denied') }
  if (!response.body) return response
  const reader = response.body.getReader(); let bytes = 0
  const body = new ReadableStream({
    async pull(controller) {
      try {
        signal.throwIfAborted(); const next = await reader.read()
        if (next.done) { controller.close(); return }
        bytes += next.value.byteLength
        if (bytes > 4 * 1024 * 1024) { await reader.cancel(); fail('too_large') }
        controller.enqueue(next.value)
      } catch (error) { await reader.cancel().catch(() => {}); controller.error(error) }
    }, cancel: () => reader.cancel(),
  })
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
}
/** A fixed read-only school adapter. Credentials stay inside the existing OIDC service. */
export function createProjectReader(service) {
  const worker = service.config.workerBaseURL
  async function request(c, url, init = {}) {
    await service.browser.current(c)
    const signal = AbortSignal.any([AbortSignal.timeout(25000), ...(c.signal ? [c.signal] : []), ...(init.signal ? [init.signal] : [])])
    // MCP uses POST even for reads. Grant only this fixed Host-owned endpoint;
    // the tool allowlist below remains read-only and renderer input never sets URLs.
    const authorization = init.method === 'POST' && url === `${worker}/mcp/notebook`
      ? { issuerServicePath: new URL(url).pathname, retryUnauthorized: true }
      : { serviceURL: url }
    const response = await service.ctx.oidcAccounts.authorizedFetch(service.config.profileID, url, { ...init, signal, redirect: 'error' }, authorization)
    await service.browser.current(c)
    return bounded(response, signal)
  }
  return {
    async mapping(c, summary) {
      const response = await request(c, `${worker}/conversations/${encodeURIComponent(summary.conversationID)}`, { headers: { accept: 'application/json' } })
      if (!response.ok) { await response.body?.cancel(); fail('unavailable') }
      const detail = unwrap(await response.json()), context = detail.workspaceContext
      if (String(detail.workspaceId) !== summary.projectID || String(context?.workspace_id) !== summary.projectID) fail('history_changed')
      return numericID(context.legacy_notebook_id ?? context.legacyNotebookId)
    },
    async notebook(c, name, args) {
      if (!['notebook_list', 'notebook_get', 'notebook_list_sources', 'notebook_source_content', 'notebook_retrieve'].includes(name)) fail('permission_denied')
      const endpoint = `${worker}/mcp/notebook`, controller = new AbortController()
      const client = new Client({ name: 'eduwork-cloud-reader', version: '0.1.0' }, { capabilities: {} })
      const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
        fetch: async (url, init) => {
          if (String(url) !== endpoint || !['GET', 'POST'].includes(init?.method ?? 'GET')) fail('permission_denied')
          return request(c, endpoint, { ...init, signal: AbortSignal.any([controller.signal, ...(init?.signal ? [init.signal] : [])]) })
        },
      })
      try {
        await client.connect(transport)
        const result = mcpData(await client.callTool({ name, arguments: args }, { timeout: 25000 }))
        await service.browser.current(c); unwrap(result); return result
      } finally { controller.abort(); await client.close().catch(() => {}) }
    },
  }
}

/** Project discovery is Notebook-backed; a workspace mapping requires explicit server evidence. */
export function createProjects(service, reader = createProjectReader(service)) {
  let cache
  async function context(lease, signal) {
    const c = await service.browser.context(lease)
    return { ...c, signal: AbortSignal.any([AbortSignal.timeout(60000), ...(signal ? [signal] : [])]) }
  }
  async function selected(value, signal) {
    const p = input.parse(value), c = await context(p.lease, signal)
    if (!cache || cache.lease !== c.lease || !cache.rows.has(p.projectKey)) fail('account_changed')
    return { p, c, row: cache.rows.get(p.projectKey) }
  }
  return {
    selection: selected,
    async forConversation(c, conversationID) {
      const summary = c.summaries.get(conversationID)
      if (!summary) fail('account_changed')
      if (!summary.projectID) return null
      if (!cache || cache.lease !== c.lease) fail('project_mapping_unavailable')
      const rows = [...cache.rows.values()].filter(row => row.projectID === summary.projectID)
      if (rows.length !== 1) fail('project_mapping_unavailable')
      await service.browser.current(c)
      return rows[0]
    },
    list: (value, signal) => service.browser.run(async () => {
      const p = input.parse(value), c = await context(p.lease, signal), notebooks = [], conversations = []
      let complete = false
      for (let page = 0; page < 25; page++) {
        const raw = await reader.notebook(c, 'notebook_list', { page, page_size: 20 }), rows = unwrap(raw)
        if (!Array.isArray(rows) || rows.length > 20) fail('invalid_response')
        notebooks.push(...rows)
        if (raw.next == null || raw.next === false || rows.length === 0) { complete = true; break }
      }
      if (!complete) fail('too_large')
      complete = false
      for (let page = 1; page <= 100; page++) {
        const result = await service.browser.list({ lease: c.lease, page }, c.signal)
        if (result.state !== 'available') {
          if (['account_changed', 'sign_in_required', 'not_connected', 'timeout', 'cancelled', 'rate_limited'].includes(result.state)) fail(result.state)
          // Project knowledge remains usable without conversation-read access.
          break
        }
        conversations.push(...result.items)
        if (!result.hasMore) { complete = true; break }
      }
      const mapping = new Map(), attempted = new Set(); let mappingIncomplete = !complete
      for (const summary of conversations.filter(row => row.projectID)) {
        if (attempted.has(summary.projectID)) continue
        if (attempted.size >= 50) { mappingIncomplete = true; break }
        attempted.add(summary.projectID)
        try { mapping.set(summary.projectID, await reader.mapping(c, summary)) }
        catch (error) { c.signal.throwIfAborted(); if (['account_changed', 'sign_in_required', 'rate_limited'].includes(error.code)) throw error; mappingIncomplete = true }
      }
      const rows = new Map()
      for (const notebook of notebooks) {
        const notebookID = numericID(notebook.id), matches = [...mapping].filter(([, id]) => id === notebookID)
        // Never choose one of two conflicting project mappings.
        const projectID = matches.length === 1 ? matches[0][0] : null
        if (matches.length > 1) mappingIncomplete = true
        const projectKey = `notebook-${notebookID}`, chats = projectID ? conversations.filter(row => row.projectID === projectID) : []
        if (rows.has(projectKey)) fail('invalid_response')
        rows.set(projectKey, { projectKey, notebookID, projectID, title: text(notebook.name) || '未命名资料库', description: text(notebook.description, 1000), updatedAt: Number.isFinite(notebook.updateTime) ? notebook.updateTime : 0, conversations: chats, shared: notebook.shared === true })
      }
      await service.browser.current(c)
      cache = { lease: c.lease, rows }
      return { lease: c.lease, projects: [...rows.values()].map(({ notebookID, conversations, ...row }) => ({ ...row, conversationCount: conversations.length })), incomplete: mappingIncomplete }
    }),
    detail: (value, signal) => service.browser.run(async () => {
      const { c, row } = await selected(value, signal)
      const raw = await reader.notebook(c, 'notebook_list_sources', { notebook_id: row.notebookID })
      if (raw.ok !== true || raw.notebook_id !== row.notebookID || !Array.isArray(raw.sources) || raw.sources.length > 1000) fail('invalid_response')
      const sources = raw.sources.map(source => ({ sourceID: numericID(source.source_id), title: text(source.file_name || source.title, 500) || '未命名资料', type: text(source.source_type, 40), status: text(source.status, 40) }))
      if (new Set(sources.map(s => s.sourceID)).size !== sources.length) fail('invalid_response')
      await service.browser.current(c)
      const binding = service.knowledge ? await service.knowledge.projectState(c, row.projectKey) : { state: 'unbound' }
      await service.browser.current(c)
      row.sourceIDs = new Set(sources.map(s => s.sourceID))
      return { lease: c.lease, projectKey: row.projectKey, conversations: row.conversations, sources, workspaceID: binding.state === 'available' ? binding.workspaceID : undefined }
    }),
    source: (value, signal) => service.browser.run(async () => {
      const { p, c, row } = await selected(value, signal)
      if (!row.sourceIDs?.has(p.sourceID)) fail('permission_denied')
      const raw = await reader.notebook(c, 'notebook_source_content', { notebook_id: row.notebookID, source_id: p.sourceID })
      if (raw.ok !== true || raw.source_id !== p.sourceID || typeof raw.content !== 'string') fail('invalid_response')
      await service.browser.current(c)
      return { sourceID: p.sourceID, text: raw.content.slice(0, 200000), empty: raw.content_empty === true || !raw.content.trim(), truncated: raw.content_truncated === true || raw.content.length > 200000 }
    }),
  }
}
