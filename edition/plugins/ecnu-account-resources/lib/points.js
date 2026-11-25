const fail = state => ({ state })
const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
export function businessTime(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)) return null
  const parsed = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+08:00`)
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null
}
export function normalizePoints(raw) {
  if (!raw || !number(raw.currentPoints)) return fail('unavailable')
  return { state: 'available', currentPoints: raw.currentPoints,
    nextExpiryAt: businessTime(raw.nextExpiryAt), nextExpiryPoints: number(raw.nextExpiryPoints) ? raw.nextExpiryPoints : null,
    expiryNotice: typeof raw.expiryNotice === 'string' ? raw.expiryNotice.slice(0, 2000) : '' }
}
export function normalizeInvitation(raw, origin) {
  if (!raw || typeof raw.referralCode !== 'string' || !raw.referralCode || raw.referralCode.length > 256 || typeof raw.invite_url !== 'string' || raw.invite_url.length > 4096) return fail('unavailable')
  let url
  try { url = new URL(raw.invite_url) } catch { return fail('unavailable') }
  const expiresAt = businessTime(raw.expiresAt)
  if (url.origin !== origin || url.username || url.password || !expiresAt) return fail('unavailable')
  if (Date.parse(expiresAt) <= Date.now()) return fail('expired')
  return { state: 'available', referralCode: raw.referralCode, expiresAt, inviteURL: url.href }
}
function configure(raw) {
  if (raw === undefined) return null
  if (!raw || !/^[A-Za-z0-9_-]{1,64}$/.test(raw.profileID ?? '')) throw Error('points requires an explicit profileID')
  const model = new URL(raw.modelBaseURL), worker = new URL(raw.workerBaseURL)
  const development = raw.allowInsecureDevelopment === true && model.protocol === 'http:'
  if (model.protocol !== 'https:' && !development || [model, worker].some(url => url.username || url.password || url.search || url.hash) || model.origin !== worker.origin) throw Error('points requires same-origin HTTPS model and worker services')
  return Object.freeze({ profileID: raw.profileID, modelBaseURL: model.href.replace(/\/$/, ''), workerBaseURL: worker.href.replace(/\/$/, ''), origin: worker.origin })
}
async function readJSON(response, signal) {
  if (!/^application\/(?:[\w.+-]+\+)?json(?:;|$)/i.test(response.headers.get('content-type') ?? '') || !response.body) throw Error('Invalid response')
  const reader = response.body.getReader(), chunks = []; let size = 0
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 16384) throw Error('Response too large')
      chunks.push(value)
    }
    signal.throwIfAborted()
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } finally { signal.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock() }
}
/** UI-only adapter: no tool registration and no caller-controlled route or method. */
export function createPointsService(ctx, raw) {
  const config = configure(raw)
  let lifetime = new AbortController(), disposed = false
  const invalidate = () => { lifetime.abort(); lifetime = new AbortController() }
  let accountReader
  if (config) ctx.inject(['ecnuAiconsole'], readerContext => {
    accountReader = readerContext.ecnuAiconsole
    readerContext.effect(() => () => { accountReader = undefined; invalidate() })
  })
  ctx.on('oidc/accounts-changed', event => { if (event.profileID === config?.profileID) invalidate() })
  ctx.on('credentials/reference-updated', invalidate)
  ctx.effect(() => () => { disposed = true; lifetime.abort() })
  const run = async (profileID, action) => {
    const reader = accountReader
    if (!config || profileID !== config.profileID || reader?.profileID !== profileID) return fail('not_configured')
    const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(20000)])
    try {
      if (disposed) return fail('not_connected')
      if (!(await ctx.oidcAccounts.status(profileID)).credentialReady) return fail('not_connected')
      signal.throwIfAborted()
      const result = await action(signal, reader)
      signal.throwIfAborted()
      return result
    } catch (error) {
      return fail(signal.aborted ? 'not_connected' : error?.code === 'permission_denied' ? 'permission_denied' : 'unavailable')
    }
  }
  return {
    profileID: config?.profileID ?? null,
    points: profileID => run(profileID, async (signal, reader) => normalizePoints((await reader.read('account_get_points', {}, { signal })).data)),
    invitation: profileID => run(profileID, async signal => {
      if (!await ctx.oidcAccounts.modelAuthorization(profileID, config.modelBaseURL)) return fail('not_connected')
      signal.throwIfAborted()
      const endpoint = `${config.workerBaseURL}/points/invitation`
      const response = await ctx.oidcAccounts.authorizedFetch(profileID, endpoint, { method: 'GET', headers: { accept: 'application/json' }, redirect: 'error', signal }, { serviceURL: endpoint })
      if (!response.ok) { await response.body?.cancel(); return fail(response.status === 403 ? 'permission_denied' : response.status === 401 ? 'not_connected' : 'unavailable') }
      try { return normalizeInvitation(await readJSON(response, signal), config.origin) }
      finally { await response.body?.cancel().catch(() => {}) }
    }),
  }
}
