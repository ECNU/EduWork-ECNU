import { AccountReadError, CONSOLE_URL, readRequest } from './operations.js'

const MAX_RESPONSE_BYTES = 1_048_576
const secretFields = new Set(['apikey', 'key', 'keyvalue', 'plaintextkey', 'secret', 'clientsecret', 'token', 'accesstoken', 'refreshtoken', 'idtoken', 'authorization', 'password', 'credential', 'credentials'])
const keyFields = new Set(['id', 'credential_id', 'name', 'masked_key', 'status', 'is_active', 'is_primary', 'can_reveal', 'expires_at', 'quota_subject', 'concurrency_subject'])
const scalar = value => value === null || ['string', 'boolean', 'number'].includes(typeof value)
const protocolError = () => new AccountReadError('invalid_response', '账户服务返回格式异常，请稍后重试。')

export function resolveConfig(raw) {
  if (!raw || typeof raw.oidcProfileId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(raw.oidcProfileId)) throw Error('Configure an explicit oidcProfileId')
  const url = new URL(raw.baseURL)
  const development = raw.allowInsecureDevelopment === true && url.protocol === 'http:'
  if ((url.protocol !== 'https:' && !development) || url.username || url.password || url.search || url.hash) throw Error('Configure an HTTPS Open API base URL; HTTP requires explicit development configuration')
  const requestTimeoutMs = raw.requestTimeoutMs ?? 20_000
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 100 || requestTimeoutMs > 120_000) throw Error('requestTimeoutMs must be 100–120000')
  return Object.freeze({ oidcProfileId: raw.oidcProfileId, baseURL: url.href.replace(/\/$/, ''), requestTimeoutMs })
}

function sanitize(value, depth = 0) {
  if (depth > 40) throw protocolError()
  if (Array.isArray(value)) return value.map(child => sanitize(child, depth + 1))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !secretFields.has(key.replace(/[_-]/g, '').toLowerCase()))
    .map(([key, child]) => [key, sanitize(child, depth + 1)]))
}
function safeData(operation, data) {
  if (operation !== 'account_list_keys') return sanitize(data)
  // A keys endpoint must never forward a future plaintext-key field to the model.
  if (!data || !Array.isArray(data.items)) throw protocolError()
  const items = data.items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw protocolError()
    return Object.fromEntries(Object.entries(item).filter(([key, value]) => keyFields.has(key) && scalar(value)))
  })
  const metadata = Object.fromEntries(['page', 'page_size', 'total', 'total_pages', 'has_more', 'next_page'].filter(key => scalar(data[key])).map(key => [key, data[key]]))
  return { ...metadata, items }
}
async function jsonResponse(response, signal) {
  if (!/(?:^|\s|;)application\/(?:[\w.+-]+\+)?json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) {
    await response.body?.cancel(); throw protocolError()
  }
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel(); throw new AccountReadError('response_too_large', '账户查询结果过大，请缩小日期范围或分页大小。')
  }
  if (!response.body) throw protocolError()
  const reader = response.body.getReader(), chunks = []
  let bytes = 0
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal.addEventListener('abort', cancel, { once: true })
  try {
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_RESPONSE_BYTES) throw new AccountReadError('response_too_large', '账户查询结果过大，请缩小日期范围或分页大小。')
      chunks.push(value)
    }
    signal.throwIfAborted()
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw protocolError() }
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}
function responseError(status, scope) {
  if (status === 401) return new AccountReadError('sign_in_required', '学校登录已失效，请重新登录后查询。')
  if (status === 403) return new AccountReadError('permission_denied', `当前学校登录暂时无法使用此查询（接口要求 ${scope}）。请联系管理员核查服务配置与账户资格，或自行前往 ${CONSOLE_URL} 查询。`)
  if (status === 404 || status === 501) return new AccountReadError('unavailable', '该查询暂不可用，或记录不存在/无权访问。')
  if (status === 429) return new AccountReadError('rate_limited', '账户查询过于频繁，请稍后重试。')
  return new AccountReadError('service_error', '账户查询失败，请稍后重试。')
}

/** Host-only reader. UI adapters can reuse read(); never expose authorizedFetch to RPC. */
export function createAccountReader(ctx, raw) {
  const config = resolveConfig(raw)
  let lifetime = new AbortController(), disposed = false, lastState
  const invalidate = () => { lifetime.abort(); lifetime = new AbortController() }
  ctx.on('oidc/accounts-changed', event => {
    if (event.profileID !== config.oidcProfileId) return
    if (event.authorizationChanged || event.state !== 'connected' || lastState !== undefined && lastState !== event.state) invalidate()
    lastState = event.state
  })
  ctx.effect(() => () => { disposed = true; lifetime.abort() })
  return Object.freeze({
    async read(operation, args = {}, options = {}) {
      const request = readRequest(config.baseURL, operation, args)
      const signal = AbortSignal.any([lifetime.signal, AbortSignal.timeout(config.requestTimeoutMs), ...(options.signal ? [options.signal] : [])])
      try {
        if (disposed) throw new AccountReadError('cancelled', '账户查询已取消。')
        signal.throwIfAborted()
        const accounts = ctx.oidcAccounts
        // This checks the configured model-service binding without returning its credential.
        if (!await accounts.modelAuthorization(config.oidcProfileId, config.baseURL)) throw new AccountReadError('sign_in_required', '请先登录对应的学校账户。')
        signal.throwIfAborted()
        const response = await accounts.authorizedFetch(config.oidcProfileId, request.url, {
          method: 'GET', headers: { accept: 'application/json' }, redirect: 'error', signal,
        }, { serviceURL: request.url })
        if (!response.ok) {
          await response.body?.cancel()
          throw responseError(response.status, request.spec.scope)
        }
        const body = await jsonResponse(response, signal)
        signal.throwIfAborted()
        if (!body || body.object !== 'account_result' || body.operation !== operation || !Object.hasOwn(body, 'data') || body.error) throw protocolError()
        return {
          operation, data: safeData(operation, body.data), parameters: request.parameters,
          coverage: request.coverage, timezone: 'Asia/Shanghai', consoleURL: CONSOLE_URL,
        }
      } catch (error) {
        if (signal.aborted) throw new AccountReadError(signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled', '账户查询超时、被取消或账号已变化，请重新查询。')
        if (error instanceof AccountReadError) throw error
        // Never relay transport errors containing tokens, URLs or server bodies.
        throw new AccountReadError('unavailable', '账户查询暂不可用，请检查学校登录与服务连接。')
      }
    },
  })
}
