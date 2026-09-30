export const DEFAULT_BASE_URL = 'https://institution.example.edu/open/api/v1'
export const DEFAULT_CREDENTIAL_REF = 'CHATECNU_API_KEY'
export const DEFAULT_REQUEST_TIMEOUT_MS = 65_000

const MAX_KEYWORD_CHARS = 512
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024
const MAX_RESULTS = 50
const MAX_WORKER_QUERY_CHARS = 1024
const MAX_WORKER_DATA_CHARS = 60_000

// Worker routes live on the issuer origin, outside the model API prefix. The
// account layer only authorizes these exact code-owned paths.
export const WORKER_SEARCH_PATHS = Object.freeze({
  campus: '/api/worker/v1/search/campus',
  web: '/api/worker/v1/search/web',
})

function codePointLength(value) {
  return Array.from(value).length
}

function requiredText(value, field, maximum) {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`)
  const normalized = value.trim()
  if (normalized.length === 0) throw new Error(`${field} must not be empty`)
  const length = codePointLength(normalized)
  if (length > maximum) throw new Error(`${field} has ${length} characters; maximum is ${maximum}`)
  return normalized
}

function positiveInteger(value, fallback, field, maximum) {
  const normalized = value ?? fallback
  if (!Number.isSafeInteger(normalized) || normalized <= 0 || normalized > maximum) {
    throw new Error(`${field} must be an integer between 1 and ${maximum}`)
  }
  return normalized
}

export function resolveCampusSearchConfig(raw = {}, environment = process.env) {
  const baseURLEnv = typeof raw.baseURLEnv === 'string' ? raw.baseURLEnv.trim() : ''
  const configuredBaseURL = baseURLEnv.length > 0 && typeof environment?.[baseURLEnv] === 'string'
    ? environment[baseURLEnv]
    : raw.baseURL
  const baseURL = String(configuredBaseURL ?? DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  let parsed
  try {
    parsed = new URL(baseURL)
  } catch {
    throw new Error('tool-ecnu-campus-search: baseURL must be an absolute HTTP(S) URL')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('tool-ecnu-campus-search: baseURL must use HTTP or HTTPS')
  }
  const credentialRef = String(raw.credentialRef ?? DEFAULT_CREDENTIAL_REF).trim()
  if (credentialRef.length === 0) throw new Error('tool-ecnu-campus-search: credentialRef must not be empty')
  if (raw.webSearch !== undefined && typeof raw.webSearch !== 'boolean') throw new Error('tool-ecnu-campus-search: webSearch must be a boolean')
  return Object.freeze({
    baseURL,
    credentialRef,
    ...(raw.oidcProfileId ? { oidcProfileId: String(raw.oidcProfileId) } : {}),
    webSearch: raw.webSearch ?? true,
    requestTimeoutMs: positiveInteger(raw.requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS, 'requestTimeoutMs', 120_000),
  })
}

export function workerSearchURL(baseURL, kind) {
  const path = WORKER_SEARCH_PATHS[kind]
  if (!path) throw new Error(`unknown worker search kind ${JSON.stringify(kind)}`)
  return new URL(baseURL).origin + path
}

export function normalizeWorkerSearchRequest(args = {}) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) throw new Error('search arguments must be an object')
  return Object.freeze({ query: requiredText(args.query, 'query', MAX_WORKER_QUERY_CHARS) })
}

export function normalizeCampusSearchRequest(args = {}) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) throw new Error('search arguments must be an object')
  const cancelSegment = args.cancel_segment ?? false
  if (typeof cancelSegment !== 'boolean') throw new Error('cancel_segment must be a boolean')
  return Object.freeze({
    keyword: requiredText(args.keyword, 'keyword', MAX_KEYWORD_CHARS),
    page: positiveInteger(args.page, 1, 'page', 10_000),
    size: positiveInteger(args.size, 10, 'size', MAX_RESULTS),
    cancel_segment: cancelSegment,
  })
}

async function readBoundedText(response, maximum = MAX_RESPONSE_BYTES, label = 'ECNU campus search') {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maximum) throw new Error(`the ${label} response exceeded the safety size limit`)
  if (response.body === null) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let result = ''
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maximum) throw new Error(`the ${label} response exceeded the safety size limit`)
      result += decoder.decode(value, { stream: true })
    }
    result += decoder.decode()
    return result
  } finally {
    reader.releaseLock()
  }
}

function boundedString(value, maximum, fallback = '') {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim()
  return codePointLength(normalized) <= maximum ? normalized : Array.from(normalized).slice(0, maximum).join('')
}

function resultURL(value) {
  const normalized = boundedString(value, 4096)
  let parsed
  try {
    parsed = new URL(normalized)
  } catch {
    return ''
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : ''
}

function normalizeResults(value) {
  if (!Array.isArray(value)) throw new Error('the ECNU campus search response did not contain a results array')
  return value.slice(0, MAX_RESULTS).map((item) => {
    const source = item !== null && typeof item === 'object' ? item : {}
    const normalized = {
      title: boundedString(source.title, 512),
      url: resultURL(source.url),
      snippet: boundedString(source.snippet, 8000),
    }
    const date = boundedString(source.date, 128)
    return date.length === 0 ? normalized : { ...normalized, date }
  }).filter(item => item.title.length > 0 || item.url.length > 0 || item.snippet.length > 0)
}

const SAFE_UPSTREAM_CODES = new Set(['invalid_request', 'method_not_allowed', 'upstream_error', 'response_error'])

function upstreamError(status, decoded) {
  const code = typeof decoded?.error?.code === 'string' && SAFE_UPSTREAM_CODES.has(decoded.error.code)
    ? decoded.error.code
    : undefined
  const message = typeof decoded?.error?.message === 'string'
    ? boundedString(decoded.error.message.replace(/[\r\n]+/gu, ' '), 300)
    : ''
  if (code !== undefined) {
    throw new Error(`the ECNU campus search service returned HTTP ${status} (${code})${message.length === 0 ? '' : `: ${message}`}`)
  }
  throw new Error(`the ECNU campus search service returned HTTP ${status}`)
}

export async function searchCampus({ fetchImpl = fetch, baseURL, apiKey, request, signal }) {
  let response
  try {
    response = await fetchImpl(`${baseURL}/search`, {
      method: 'POST',
      signal,
      redirect: 'manual',
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        keyword: request.keyword,
        page: request.page,
        size: request.size,
        cancel_segment: request.cancel_segment,
      }),
    })
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') throw new Error('the ECNU campus search request timed out')
    throw new Error('the ECNU campus search service could not be reached')
  }
  const text = await readBoundedText(response)
  let decoded
  try {
    decoded = JSON.parse(text)
  } catch {
    throw new Error(`the ECNU campus search service returned HTTP ${response.status} with invalid JSON`)
  }
  if (!response.ok) upstreamError(response.status, decoded)
  const results = normalizeResults(decoded?.results)
  return Object.freeze({
    id: boundedString(decoded?.id, 256),
    query: boundedString(decoded?.query, MAX_KEYWORD_CHARS, request.keyword) || request.keyword,
    results,
  })
}

const WORKER_LABELS = Object.freeze({ campus: 'ECNU campus search', web: 'ECNU web search' })

function workerStatusError(kind, status) {
  const label = WORKER_LABELS[kind]
  if (status === 400) return new Error(`the ${label} service rejected the query (HTTP 400)`)
  if (status === 401) return new Error(`the ${label} service rejected the school sign-in (HTTP 401); sign in to the school account again`)
  if (status === 403) return new Error(`the school account is not authorized for search.${kind} (HTTP 403); sign out and sign in to the school account again to grant it`)
  if (status === 503) return new Error(`the ${label} service is not configured (HTTP 503)`)
  if (status === 502) return new Error(`the ${label} upstream service failed (HTTP 502); retry later`)
  return new Error(`the ${label} service returned HTTP ${status}`)
}

// The route fixes its own response envelope; `data` is an extensible MCP result
// and is returned only as bounded, untrusted JSON text.
export async function searchWorker({ fetchImpl, baseURL, kind, request, signal }) {
  const label = WORKER_LABELS[kind]
  let response
  try {
    response = await fetchImpl(workerSearchURL(baseURL, kind), {
      method: 'POST',
      signal,
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: request.query }),
    })
  } catch (error) {
    if (error?.code === 'oidc_login_required') throw new Error('Sign in to the school account')
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') throw new Error(`the ${label} request timed out`)
    throw new Error(`the ${label} service could not be reached`)
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw workerStatusError(kind, response.status)
  }
  const text = await readBoundedText(response, MAX_RESPONSE_BYTES, label)
  let decoded
  try {
    decoded = JSON.parse(text)
  } catch {
    throw new Error(`the ${label} service returned invalid JSON`)
  }
  if (decoded === null || typeof decoded !== 'object' || !('data' in decoded)) throw new Error(`the ${label} response did not contain data`)
  const serialized = JSON.stringify(decoded.data ?? null)
  const truncated = serialized.length > MAX_WORKER_DATA_CHARS
  return Object.freeze({
    query: request.query,
    tool: boundedString(decoded.tool, 128),
    dataJSON: truncated ? serialized.slice(0, MAX_WORKER_DATA_CHARS) : serialized,
    truncated,
  })
}
