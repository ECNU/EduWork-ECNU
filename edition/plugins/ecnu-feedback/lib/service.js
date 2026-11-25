import { randomUUID } from 'node:crypto'
import { readFeedbackTarget, validID } from './context.js'
const state = state => ({ state })
export function resolveConfig(raw) {
  if (!raw || !validID(raw.profileID) || !validID(raw.providerID)) throw Error('Configure explicit school profile and provider IDs')
  const model = new URL(raw.modelBaseURL), worker = new URL(raw.workerBaseURL)
  const development = raw.allowInsecureDevelopment === true && model.protocol === 'http:'
  if (model.protocol !== 'https:' && !development || model.origin !== worker.origin || [model, worker].some(url => url.username || url.password || url.hash || url.search) || !/^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(worker.pathname)) throw Error('Feedback requires same-origin HTTPS model and Worker services')
  const reasons = raw.reasons ?? []
  if (!Array.isArray(reasons) || reasons.length > 20 || reasons.some(value => typeof value !== 'string' || !value.trim() || value.length > 80)) throw Error('Invalid feedback reason list')
  return Object.freeze({ profileID: raw.profileID, providerID: raw.providerID, modelBaseURL: model.href.replace(/\/$/, ''), workerBaseURL: worker.href.replace(/\/$/, ''), reasons: [...new Set(reasons)] })
}
async function readRating(response, signal, messageID) {
  if (!response.body || !/^application\/(?:[\w.+-]+\+)?json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) throw Error('Invalid feedback response')
  const reader = response.body.getReader(), chunks = []; let size = 0
  const cancel = () => { void reader.cancel().catch(() => {}) }; signal.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      signal.throwIfAborted(); const next = await reader.read()
      if (next.done) break
      size += next.value.length; if (size > 1048576) throw Error('Feedback response too large'); chunks.push(next.value)
    }
    signal.throwIfAborted()
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (![0, 1, -1].includes(result.favorite) || result.message_id !== undefined && result.message_id !== messageID) throw Error('Feedback response mismatch')
    return { state: 'available', favorite: result.favorite }
  } finally { signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock() }
}
export function createFeedbackService(ctx, raw) {
  const config = resolveConfig(raw), pending = new Map()
  let lifetime = new AbortController(), disposed = false, accountBinding = randomUUID()
  // An opaque revision binds a UI draft to this Host's current account session.
  // Existing credential/account events rotate it; no new OIDC identity API is needed.
  const invalidate = () => { lifetime.abort(); lifetime = new AbortController(); accountBinding = randomUUID() }
  ctx.on('oidc/accounts-changed', event => { if (event.profileID === config.profileID) invalidate() })
  ctx.on('credentials/reference-updated', invalidate)
  ctx.effect(() => () => { disposed = true; lifetime.abort() })
  const target = async (sessionID, messageID) => {
    try { return await readFeedbackTarget(ctx, sessionID, messageID, config.providerID) }
    catch { return state('unavailable') }
  }
  const run = async (sessionID, messageID, action) => {
    const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(20000)])
    try {
      if (disposed) return state('not_connected')
      const preview = await target(sessionID, messageID)
      if (preview.state !== 'available') return preview
      signal.throwIfAborted()
      const accounts = ctx.oidcAccounts
      if (!await accounts.modelAuthorization(config.profileID, config.modelBaseURL)) return state('not_connected')
      signal.throwIfAborted()
      const binding = accountBinding
      const endpoint = new URL(`${config.workerBaseURL}/feedback/${messageID}`)
      let body
      if (action) {
        if (action.confirmed !== true || action.digest !== preview.digest || action.accountBinding !== binding || ![0, 1, -1].includes(action.favorite) || typeof action.desc !== 'string' || action.desc.length > 1000 || !Array.isArray(action.reason) || action.reason.some(value => !config.reasons.includes(value))) return state('preview_changed')
        body = { conversation_id: sessionID, favorite: action.favorite,
          ...(action.favorite === 0 ? {} : {
            ...(action.reason.length ? { reason: [...new Set(action.reason)] } : {}),
            ...(action.desc.trim() ? { desc: action.desc } : {}),
            question_content: preview.question, answer_content: preview.answer,
          }) }
      } else endpoint.searchParams.set('conversation_id', sessionID)
      const response = await accounts.authorizedFetch(config.profileID, endpoint.href, { method: action ? 'POST' : 'GET', headers: { accept: 'application/json', ...(action ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal }, action ? { issuerServicePath: endpoint.pathname } : { serviceURL: endpoint.href })
      try {
        if (!response.ok) return state(response.status === 401 ? 'not_connected' : response.status === 403 ? 'permission_denied' : 'unavailable')
        const result = await readRating(response, signal, messageID)
        signal.throwIfAborted()
        if (accountBinding !== binding) return state('not_connected')
        return { ...result, accountBinding: binding }
      } finally { await response.body?.cancel().catch(() => {}) }
    } catch { return state(signal.aborted ? 'not_connected' : 'unavailable') }
  }
  return {
    configuration: () => ({ profileID: config.profileID, reasons: config.reasons }), preview: target,
    read: (sessionID, messageID) => run(sessionID, messageID),
    submit: (sessionID, messageID, action) => {
      const key = `${sessionID}/${messageID}`, previous = pending.get(key) ?? Promise.resolve()
      const result = previous.then(() => run(sessionID, messageID, action))
      const tail = result.catch(() => {}); pending.set(key, tail)
      return result.finally(() => { if (pending.get(key) === tail) pending.delete(key) })
    },
  }
}
