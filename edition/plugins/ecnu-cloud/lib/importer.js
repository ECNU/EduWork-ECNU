import { createHash, randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { Session, SESSION_FORMAT_VERSION, SessionLogOffset } from '@deepseek-ai/dsh-session'
import { z } from 'zod'

const id = z.string().min(1).max(256)
const headerSchema = z.object({ version: z.number().int(), id, createdAt: z.number(), cwd: z.string().min(1), isSeeded: z.literal(false), delegationDepth: z.literal(0) }).strict()
export const importDomain = defineDomain({ name: 'ecnu_cloud_imports', version: 1, tables: {
  jobs: domainTable(z.object({ scope: z.string().length(64), conversationID: id, workspaceID: id, sessionID: id,
    projectID: id.nullable(), rememberProject: z.boolean(), snapshot: z.string().length(64), phase: z.enum(['prepared', 'persisted', 'bound']),
    header: headerSchema, events: z.array(z.unknown()).max(10000), eventCount: z.number().int().min(0) }).strict()),
} })
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const historyDigest = history => digest({ summary: history.summary, messages: history.messages })
const fail = code => { throw Object.assign(new Error(code), { code }) }
export function convertHistory(history, sessionID, cwd) {
  if (!history.importable || !history.messages.length || history.messages[0].role !== 'user') fail('unsupported_history')
  const events = []; let time = history.messages[0].at, turn = 0
  const add = (type, data, surface = false) => events.push({ type, data, seq: events.length, time, ...(surface ? { surfaceOp: 'append' } : {}) })
  const messageID = source => digest([sessionID, source]).slice(0, 32)
  for (let i = 0; i < history.messages.length; i++) {
    const user = history.messages[i]
    if (user.role !== 'user' || !user.supported) fail('unsupported_history')
    time = user.at; turn++
    add('turn/start', { turn }); add('step/start', { turn, step: 1 })
    if (turn === 1) add('system/message', { turn, step: 1, message: { id: messageID('system-head'), role: 'system', content: [], source: { kind: 'system-prompt' } } }, true)
    add('user/message', { id: messageID(user.messageID), role: 'user', content: [{ type: 'text', text: user.text }], source: { kind: 'user' } }, true)
    const reply = history.messages[i + 1]?.role === 'assistant' ? history.messages[++i] : null
    if (reply) {
      time = reply.at
      add('assistant/message', { turn, step: 1, message: { id: messageID(reply.messageID), role: 'assistant', content: [{ type: 'text', text: reply.text }], source: { kind: 'model', provider: 'chatecnu-cloud-import', model: 'chatecnu-cloud-import' } }, stream: [] }, true)
    }
    add('step/end', { turn, step: 1 })
    add('turn/end', { turn, reason: reply ? { kind: 'completed' } : { kind: 'error', error: { code: 'CLOUD_NO_REPLY', message: '云端历史中没有这条消息的回复。' } } })
    if (turn === 1) {
      let title = ''
      for (const char of history.summary.title) { if (Buffer.byteLength(title + char) > 80) break; title += char }
      add('session/title', { title, messageSeqs: [], source: { kind: 'user' } })
    }
  }
  const header = { version: SESSION_FORMAT_VERSION, id: sessionID, createdAt: history.messages[0].at, cwd, isSeeded: false, delegationDepth: 0 }
  Session.create(sessionID, events, header)
  return { header, events }
}

/** Durable import journal. Retries reuse the same ID and append only a verified missing suffix. */
export function createImporter(service) {
  let domain, tail = Promise.resolve(), disposed = false
  const ready = service.ctx.storageDomain.open(importDomain).then(value => { domain = value })
  void ready.catch(() => {})
  service.ctx.effect(() => async () => { disposed = true; await tail; await ready.catch(() => {}); await domain?.close() })
  const request = z.object({ lease: z.string().uuid(), conversationID: id, workspaceID: id.optional(), snapshot: z.string().length(64).optional(), rememberProject: z.boolean().optional() }).strict()
  const current = async c => { if (disposed) fail('closed'); if (c.signal?.aborted) fail('cancelled'); await service.browser.current(c); if (c.signal?.aborted) fail('cancelled') }
  const jobKey = c => digest([c.scope, c.conversationID])
  async function destination(input) {
    const p = request.parse(input), c = await service.browser.context(p.lease)
    if (!c.summaries.has(p.conversationID)) fail('account_changed')
    await ready; await current(c)
    const binding = await service.conversation(p.conversationID)
    const job = domain.table('jobs').get(jobKey({ ...c, conversationID: p.conversationID }))
    const projectID = c.summaries.get(p.conversationID).projectID
    const preferred = projectID ? await service.projectWorkspace(projectID) : { state: 'unbound' }
    await current(c)
    return { bindingState: binding.state, sessionID: binding.sessionID, workspaceID: binding.workspaceID ?? job?.workspaceID ?? (preferred.state === 'available' ? preferred.workspaceID : undefined), pending: !!job && job.phase !== 'bound', rememberProject: job?.rememberProject ?? false, projectID }
  }
  async function perform(input, c) {
    await ready; await current(c)
    const table = domain.table('jobs'), key = jobKey({ ...c, conversationID: input.conversationID })
    let job = table.get(key)
    const existing = await service.conversation(input.conversationID)
    if (existing.state === 'available') {
      if (job && job.phase !== 'bound') {
        if (job.sessionID !== existing.sessionID || job.workspaceID !== existing.workspaceID) fail('binding_needs_repair')
        await current(c)
        if (job.rememberProject && job.projectID) await service.bindProject(job.projectID, job.workspaceID)
        await current(c); await table.put(key, { ...job, phase: 'bound', events: [] })
      }
      return { sessionID: existing.sessionID, workspaceID: existing.workspaceID, reused: true }
    }
    if (existing.state !== 'unbound') fail(existing.state)
    if (job && job.phase === 'bound') fail('binding_needs_repair')
    const workspaceID = job?.workspaceID ?? id.parse(input.workspaceID)
    if (job && input.workspaceID !== workspaceID) fail('workspace_changed')
    const checkWorkspace = async () => {
      await current(c)
      const status = await service.workspace(workspaceID)
      if (status.state !== 'available') fail(status.state)
      const workspace = service.ctx.workspaceRegistry.get(workspaceID)
      if (job && workspace.path !== job.header.cwd) fail('workspace_changed')
      await current(c); return workspace
    }
    let workspace = await checkWorkspace()
    if (!job) {
      await service.browser.verifySummary(c, input.conversationID)
      const history = await service.browser.history(c, input.conversationID)
      if (!input.snapshot || input.snapshot !== historyDigest(history)) fail('history_changed')
      const sessionID = `session-${randomUUID()}`, conversion = convertHistory(history, sessionID, workspace.path)
      job = { scope: c.scope, conversationID: input.conversationID, workspaceID, sessionID, projectID: history.summary.projectID, rememberProject: input.rememberProject === true,
        snapshot: input.snapshot, phase: 'prepared', ...conversion, eventCount: conversion.events.length }
      await checkWorkspace(); await table.put(key, job)
    }
    const persistence = service.ctx.get('sessionPersistence')
    if (!persistence) fail('not_configured')
    workspace = await checkWorkspace()
    const stat = await persistence.stat(job.sessionID)
    if (job.phase === 'persisted' && !stat) fail('binding_needs_repair')
    let handle
    try {
      await current(c)
      handle = stat ? await persistence.open(job.sessionID, 'write', { signal: c.signal }) : await persistence.create(job.header, { signal: c.signal })
      if (!isDeepStrictEqual(handle.header, job.header)) fail('binding_needs_repair')
      const stored = (await handle.read()).events
      if (stored.length > job.events.length || !stored.every((event, index) => isDeepStrictEqual(event, job.events[index]))) fail('binding_needs_repair')
      await checkWorkspace()
      if (stored.length < job.events.length) await handle.append(job.events.slice(stored.length), { signal: c.signal })
      await handle.flush({ signal: c.signal })
    } finally { await handle?.close() }
    await current(c)
    service.ctx.get('sessionProjectionCache')?.coldSnapshot(job.header, SessionLogOffset(0), job.events)
    job = { ...job, phase: 'persisted' }; await table.put(key, job)
    workspace = await checkWorkspace()
    await workspace.attachSession(job.sessionID)
    await current(c)
    await service.rememberConversation(job.conversationID, job.sessionID, workspaceID, job.projectID)
    await current(c)
    if (job.rememberProject && job.projectID) await service.bindProject(job.projectID, workspaceID)
    await current(c)
    await table.put(key, { ...job, phase: 'bound', events: [] })
    return { sessionID: job.sessionID, workspaceID, reused: false }
  }
  return { ready,
    destination: input => service.browser.run(() => destination(input)),
    import: (input, signal) => service.browser.run(async () => {
      const parsed = request.parse(input), c = { ...await service.browser.context(parsed.lease), signal }
      if (!c.summaries.has(parsed.conversationID)) fail('account_changed')
      const result = tail.then(() => perform(parsed, c)); tail = result.catch(() => {})
      return result
    }),
  }
}
