import { randomUUID, createHash } from 'node:crypto'
import { lstat, mkdir, open, readFile, realpath } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path'

const operations = { generate: 'generations', plan: 'plans', cover: 'covers', transcribe: 'transcriptions' }
const MAX_JSON = 2 * 1024 * 1024
const MAX_AUDIO = 39 * 1024 * 1024
const MAX_DOWNLOAD = 128 * 1024 * 1024
const hash = value => createHash('sha256').update(value).digest('hex')
const contained = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\') }

function text(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || [...value].length > max) throw Error(`${field} must contain 1–${max} characters`)
  return value
}
export function segment(value, field = 'job_id') {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value)) throw Error(`Invalid ${field}`)
  return value
}
export function requestID(value = randomUUID()) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw Error('request_id must be a UUID v4')
  return value.toLowerCase()
}
export function resolveMusicConfig(raw = {}) {
  const allowed = ['baseURL', 'credentialRef', 'oidcProfileId', 'requestTimeoutMs']
  for (const key of Object.keys(raw)) if (!allowed.includes(key)) throw Error(`Unknown music setting: ${key}`)
  const url = new URL(text(raw.baseURL, 'baseURL', 2048))
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) || url.username || url.password || url.search || url.hash) throw Error('Music baseURL requires HTTPS (HTTP loopback is allowed), without credentials, query or fragment')
  const baseURL = url.href.replace(/\/+$/, '')
  if (baseURL.endsWith('/music')) throw Error('baseURL must be the model API root, without /music')
  const credentialRef = text(raw.credentialRef ?? 'EDUWORK_API_KEY', 'credentialRef', 128)
  if (/^DSH_OIDC_/i.test(credentialRef)) throw Error('Use oidcProfileId for school sign-in, never a session credential reference')
  const oidcProfileId = raw.oidcProfileId ? text(raw.oidcProfileId, 'oidcProfileId', 128) : undefined
  const requestTimeoutMs = raw.requestTimeoutMs ?? 120000
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1000 || requestTimeoutMs > 180000) throw Error('requestTimeoutMs must be 1000–180000')
  return { baseURL, credentialRef, oidcProfileId, requestTimeoutMs }
}

export function normalizeSubmission(args) {
  const operation = args.operation ?? 'generate'
  if (!Object.hasOwn(operations, operation)) throw Error('operation must be generate, plan, cover or transcribe')
  const fields = ['operation', 'request_id', ...(operation === 'transcribe' ? ['audio', 'mode'] : ['style', 'lyrics', 'seed', 'cfg_scale', ...(operation === 'cover' ? ['audio'] : ['n', 'cot', 'abc'])])]
  for (const key of Object.keys(args)) if (!fields.includes(key)) throw Error(`${key} is not supported for ${operation}`)
  const body = { model: 'ecnu-music' }
  if (operation !== 'transcribe') {
    body.style = text(args.style, 'style', 2000)
    body.lyrics = text(args.lyrics, 'lyrics', 16000)
    // Omission preserves the server's random default, including explicit zero.
    if (args.seed !== undefined && args.seed !== null) {
      if (!Number.isSafeInteger(args.seed) || args.seed < 0) throw Error('seed must be a non-negative safe integer (at most 9007199254740991)')
      body.seed = args.seed
    }
    if (args.cfg_scale !== undefined) {
      if (!Number.isFinite(args.cfg_scale) || args.cfg_scale < 0 || args.cfg_scale > 20) throw Error('cfg_scale must be 0–20')
      body.cfg_scale = args.cfg_scale
    }
  }
  if (operation === 'generate' || operation === 'plan') {
    body.n = args.n ?? 1
    body.cot = args.cot ?? 'full'
    if (![1, 2].includes(body.n) || operation === 'plan' && body.n !== 1) throw Error('generate supports n=1 or 2; plan requires n=1')
    if (!(operation === 'plan' ? ['full', 'melody'] : ['full', 'melody', 'off']).includes(body.cot)) throw Error('Unsupported cot for this operation')
    if (args.abc !== undefined) body.abc = text(args.abc, 'abc', 64000)
  }
  if (operation === 'transcribe') {
    body.mode = args.mode ?? 'full'
    if (!['full', 'melody'].includes(body.mode)) throw Error('mode must be full or melody')
  }
  if (operation === 'cover' || operation === 'transcribe') text(args.audio, 'audio', 4096)
  return { operation, path: operations[operation], body }
}

export async function readBounded(response, maximum) {
  if (Number(response.headers.get('content-length')) > maximum) { await response.body?.cancel(); throw Error('Music response exceeds size limit') }
  if (!response.body) return Buffer.alloc(0)
  const reader = response.body.getReader(), chunks = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maximum) throw Error('Music response exceeds size limit')
      chunks.push(value)
    }
    return Buffer.concat(chunks, total)
  } catch (error) { await reader.cancel().catch(() => {}); throw error }
  finally { reader.releaseLock() }
}

const statusMessages = {
  400: 'Unsupported request combination', 401: 'Sign in again or check the configured API key',
  403: 'Check ecnu-music assignment, llm:invoke scope, OpenApp status and IP allowlist',
  404: 'Task missing, expired or owned by another identity; use its original account',
  409: 'Task or idempotency conflict', 422: 'Invalid request fields', 429: 'Service quota or concurrency limit',
  502: 'Music upstream unavailable', 503: 'Music service or task ownership store unavailable',
}
export async function musicRequest(config, authorization, path, { method = 'GET', body, headers = {}, signal, binary = false, expectedStatus } = {}) {
  // All call sites construct paths from code-owned routes and validated segments.
  const response = await authorization.fetch(`${config.baseURL}/music/${path}`, {
    method, body, headers: { Accept: binary ? '*/*' : 'application/json', ...headers },
    redirect: 'error', signal,
  })
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    throw Object.assign(Error(`Music HTTP ${response.status}: ${statusMessages[response.status] ?? 'Request failed'}`), { musicStatus: response.status })
  }
  if (expectedStatus !== undefined && response.status !== expectedStatus) { await response.body?.cancel(); throw Error('Unexpected music submission response status') }
  const bytes = await readBounded(response, binary ? MAX_DOWNLOAD : MAX_JSON)
  authorization.assertCurrent()
  if (binary) return { bytes, mime: response.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream' }
  let data
  // Random 63-bit server seeds cannot be faithfully represented as JS numbers.
  // Preserve oversized integer literals as decimal strings in tool reports.
  try { data = JSON.parse(bytes.toString('utf8'), (_key, value, context) => typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value) ? context.source : value) } catch { throw Error('Music returned invalid JSON') }
  return data
}

async function safeDirectory(root) {
  const project = await realpath(root)
  let path = project
  for (const part of ['.eduwork', 'generated', 'music']) {
    path = join(path, part)
    try { await mkdir(path, { mode: 0o700 }) } catch (error) { if (error.code !== 'EEXIST') throw error }
    const info = await lstat(path)
    if (info.isSymbolicLink() || !info.isDirectory()) throw Error('Music output directory must not be a symlink')
  }
  if (!contained(project, await realpath(path))) throw Error('Music output escaped the workspace')
  return path
}
async function exclusive(root, name, bytes) {
  const directory = await safeDirectory(root), path = join(directory, name)
  const file = await open(path, 'wx', 0o600)
  try { await file.writeFile(bytes) } finally { await file.close() }
  return path
}
async function record(root, name) {
  const path = join(await safeDirectory(root), name)
  try {
    const info = await lstat(path)
    if (info.isSymbolicLink() || !info.isFile() || info.size > MAX_JSON) throw Error('Invalid music receipt')
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) { if (error.code === 'ENOENT') return undefined; throw error }
}
async function upload(root, audio) {
  const project = await realpath(root), path = await realpath(resolve(project, audio))
  if (!contained(project, path)) throw Error('Audio must be inside the session workspace; copy the supplied file there first')
  const info = await lstat(path)
  if (!info.isFile() || info.size < 1 || info.size > MAX_AUDIO) throw Error('Audio must be a regular file of 1–39 MiB')
  if (!/\.(wav|mp3|flac|ogg|m4a|aac|opus)$/i.test(path)) throw Error('Unsupported audio file extension')
  const bytes = await readFile(path)
  if (bytes.length > MAX_AUDIO) throw Error('Audio exceeds upload limit')
  return { bytes, name: basename(path) }
}

export async function submitMusic({ config, authorization, root, args, signal }) {
  const normalized = normalizeSubmission(args), id = requestID(args.request_id)
  const audio = ['cover', 'transcribe'].includes(normalized.operation) ? await upload(root, args.audio) : undefined
  const fingerprint = hash(JSON.stringify([normalized.operation, normalized.body, audio ? hash(audio.bytes) : null]))
  const binding = hash(JSON.stringify([config.baseURL, config.oidcProfileId ?? null, config.credentialRef]))
  const receiptName = `request-${id}.json`, acceptedName = `accepted-${id}.json`
  const receipt = { version: 1, request_id: id, operation: normalized.operation, binding, fingerprint, created_at: new Date().toISOString() }
  const receiptPath = join(await safeDirectory(root), receiptName)
  authorization.assertCurrent()
  try { await exclusive(root, receiptName, JSON.stringify(receipt, null, 2) + '\n') }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
    const previous = await record(root, receiptName)
    if (previous?.binding !== binding || previous?.fingerprint !== fingerprint) throw Error('request_id already used for a different request or service')
    const accepted = await record(root, acceptedName)
    if (accepted?.id) {
      const job = await musicRequest(config, authorization, `jobs/${segment(accepted.id)}`, { signal })
      return { request_id: id, receiptPath, resumed: true, job }
    }
    return { request_id: id, receiptPath, submission: 'unknown', message: 'An earlier submission may still be running. No POST was replayed. Check the original tool result or ask the service operator to locate this idempotency key before starting a new request.' }
  }
  let body, headers = { 'Idempotency-Key': id }
  if (audio) {
    body = new FormData()
    for (const [key, value] of Object.entries(normalized.body)) body.set(key, String(value))
    body.set('audio', new Blob([audio.bytes]), audio.name)
  } else { body = JSON.stringify(normalized.body); headers['Content-Type'] = 'application/json' }
  let job
  try {
    authorization.assertCurrent()
    job = await musicRequest(config, authorization, normalized.path, { method: 'POST', body, headers, signal, expectedStatus: 202 })
    segment(job?.id)
  } catch (error) {
    // No raw upstream exception/body: they may contain headers or user data.
    return { request_id: id, receiptPath, submission: 'unknown', ...(error.musicStatus ? { httpStatus: error.musicStatus, diagnostic: error.message } : {}), message: 'Submission did not complete locally. It may have reached the server; no automatic retry was made. Keep this receipt and check the original account and service logs before submitting again.' }
  }
  try { await exclusive(root, acceptedName, JSON.stringify({ id: job.id, request_id: id }) + '\n') }
  catch { return { request_id: id, receiptPath, submission: 'accepted', job, warning: 'Could not save the accepted task id locally. Preserve this returned id and query it directly; do not resubmit.' } }
  return { request_id: id, receiptPath, submission: 'accepted', job }
}

export function artifactNames(data) {
  const rows = Array.isArray(data) ? data : data?.artifacts
  if (!Array.isArray(rows)) throw Error('Music artifact response must contain an artifacts array')
  return rows.map(row => typeof row === 'string' ? row : row?.name).filter(name => typeof name === 'string')
}
export async function downloadMusic({ config, authorization, root, jobID, artifact, signal }) {
  const id = segment(jobID)
  if (typeof artifact !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}\.(flac|wav|mp3|ogg|abc|mid|midi|pdf|json)$/i.test(artifact)) throw Error('Choose a supported artifact filename from music artifacts')
  const listing = await musicRequest(config, authorization, `jobs/${id}/artifacts`, { signal })
  if (!artifactNames(listing).includes(artifact)) throw Error('Artifact is not in the server listing')
  const result = await musicRequest(config, authorization, `jobs/${id}/artifacts/${encodeURIComponent(artifact)}`, { signal, binary: true })
  if (!result.bytes.length) throw Error('Empty music artifact')
  if (extname(artifact).toLowerCase() === '.pdf' && result.bytes.subarray(0, 5).toString() !== '%PDF-') throw Error('Server returned a non-PDF score; use its actual artifact format')
  authorization.assertCurrent()
  const path = await exclusive(root, `${id}-${randomUUID()}-${artifact}`, result.bytes)
  return { id, artifact, path, relativePath: relative(await realpath(root), path).split('\\').join('/'), mime: result.mime, bytes: result.bytes.length }
}
