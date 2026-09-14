import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

const installationPattern = /^inst_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const validInstallation = value => typeof value === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(value)
const validText = (value, limit) => typeof value === 'string' && value.length <= limit && !/[\r\n\u0000]/.test(value)

export function normalizeWebConfig(raw = {}, environment = process.env) {
  if (raw.enabled !== true) return { enabled: false }
  if (typeof raw.profileID !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(raw.profileID)) throw new Error('heartbeat Web backend requires profileID')
  let base, endpoint
  try {
    base = new URL(raw.baseURL)
    endpoint = new URL(raw.endpoint ?? '/user/active', base)
  } catch { throw new Error('heartbeat Web backend requires an explicit HTTP(S) baseURL') }
  if (!['http:', 'https:'].includes(base.protocol) || endpoint.origin !== base.origin || base.username || base.password || endpoint.username || endpoint.password || endpoint.hash) {
    throw new Error('heartbeat endpoint must belong to its configured HTTP(S) origin')
  }
  const stateDirectory = raw.stateDirectory ?? (environment.DSH_HOME ? join(environment.DSH_HOME, 'state', 'chatecnu-active') : '')
  if (raw.installationID !== undefined && !validInstallation(raw.installationID)) throw new Error('invalid heartbeat installationID')
  if (raw.installationID === undefined && !isAbsolute(stateDirectory)) throw new Error('heartbeat requires an absolute stateDirectory or DSH_HOME')
  const productName = raw.productName ?? 'EduWork@ECNU'
  if (!validText(productName, 100) || !productName.trim()) throw new Error('invalid heartbeat productName')
  const version = typeof raw.version === 'string' && validText(raw.version, 32) ? raw.version : ''
  const platform = raw.platform ?? 'web'
  if (!validText(platform, 20) || !platform) throw new Error('invalid heartbeat platform')
  return { enabled: true, profileID: raw.profileID, endpoint: endpoint.toString(), stateDirectory, installationID: raw.installationID,
    productName, version, platform, channel: typeof raw.version === 'string' && raw.version.includes('-') ? 'dev' : 'stable' }
}

// The per-data-root UUID moves with the user's data. Never derive a device ID
// from hardware, account names, workspace paths or browser fingerprints.
export async function installationID(stateDirectory) {
  const path = join(stateDirectory, 'installation-id')
  try {
    const value = (await readFile(path, 'utf8')).trim()
    if (!installationPattern.test(value)) throw new Error('invalid stored heartbeat installation ID')
    return value
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  await mkdir(stateDirectory, { recursive: true, mode: 0o700 })
  const value = `inst_${randomUUID()}`
  let file
  try { file = await open(path, 'wx', 0o600) }
  catch (error) {
    if (error.code === 'EEXIST') return installationID(stateDirectory)
    throw error
  }
  try { await file.writeFile(`${value}\n`); await file.sync() }
  finally { await file.close() }
  return value
}

export function heartbeatPayload(config, installation, input, system = process) {
  if (!['active', 'background', 'idle'].includes(input.state) || !validText(input.locale ?? '', 20) || !validText(input.timezone ?? '', 64)) throw new Error('invalid heartbeat activity')
  if (input.timezone) {
    try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }) }
    catch { throw new Error('invalid heartbeat timezone') }
  }
  const os = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[system.platform]
  const client = { installation_id: installation, name: config.productName, platform: config.platform, channel: config.channel,
    device: 'Computer', ...(os ? { os } : {}), arch: system.arch,
    ...(config.version ? { version: config.version } : {}),
    ...(input.locale ? { locale: input.locale } : {}), ...(input.timezone ? { timezone: input.timezone } : {}) }
  return { client, activity: { state: input.state } }
}

async function responseValue(response) {
  // Only status and the next interval are used. Never return the response's
  // session identity or other account data to the browser or a log.
  const reader = response.body?.getReader()
  if (!reader) return undefined
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 32768) { await reader.cancel(); return undefined }
      chunks.push(value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch { return undefined }
  finally { reader.releaseLock() }
}

export function createWebHeartbeatSender(accounts, raw = {}, { signal, environment = process.env, system = process } = {}) {
  const config = normalizeWebConfig(raw, environment)
  let identifier
  return async input => {
    if (!config.enabled) return { state: 'disabled' }
    if (typeof accounts?.authorizedFetch !== 'function' || typeof accounts?.status !== 'function') return { state: 'local_error' }
    try {
      const status = await accounts.status(config.profileID)
      // Identity-only OIDC is sufficient: a model credential is unrelated.
      if (status.state === 'signed_out') return { state: 'signed_out' }
      if (!['connected', 'authenticated'].includes(status.state)) return { state: 'login_required', httpStatus: 401 }
      if (!identifier) identifier = config.installationID ? Promise.resolve(config.installationID) : installationID(config.stateDirectory)
      let payload
      try { payload = heartbeatPayload(config, await identifier, input, system) }
      catch { return { state: 'local_error' } }
      const response = await accounts.authorizedFetch(config.profileID, config.endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
        signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15000)]),
      })
      const httpStatus = response.status
      if (httpStatus !== 200) {
        await response.body?.cancel().catch(() => {})
        return { state: httpStatus === 401 ? 'login_required' : httpStatus === 429 || httpStatus >= 500 ? 'retry' : 'rejected', httpStatus }
      }
      const value = await responseValue(response)
      if (value?.status !== 'Success') return { state: 'retry', httpStatus }
      const interval = typeof value.next_heartbeat_in === 'number' && Number.isFinite(value.next_heartbeat_in) && value.next_heartbeat_in > 0 ? value.next_heartbeat_in : 600
      return { state: 'ok', httpStatus, nextHeartbeatIn: Math.max(60, Math.min(3600, interval)) }
    } catch (error) {
      if (error?.code === 'oidc_login_required') return { state: 'login_required', httpStatus: 401 }
      if (error?.code === 'oidc_authorized_origin_denied' || error?.code === 'oidc_profile_unknown') return { state: 'rejected' }
      return { state: 'retry' }
    }
  }
}
