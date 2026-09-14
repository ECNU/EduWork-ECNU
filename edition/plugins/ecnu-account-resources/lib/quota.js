const numberOrNull = value => value === null || value === undefined ? null
  : typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value
    : (() => { throw new Error('invalid quota number') })()
const label = value => typeof value === 'string' ? value.slice(0, 256) : ''
const dateOrNull = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null

export function normalizeQuota(raw, providerID) {
  if (raw?.provider_id !== providerID) throw new Error('quota provider mismatch')
  if (!Array.isArray(raw.windows) || raw.windows.length > 64) throw new Error('invalid quota windows')
  if (raw.resource_packs !== undefined && (!Array.isArray(raw.resource_packs) || raw.resource_packs.length > 256)) throw new Error('invalid quota resource packs')
  let consoleURL
  if (raw.ops_console_url || raw.console_url) {
    const url = new URL(raw.ops_console_url || raw.console_url)
    if (url.protocol === 'https:' && !url.username && !url.password) consoleURL = url.toString()
  }
  return {
    state: 'available', providerID, unit: label(raw.unit),
    windows: raw.windows.map(row => ({
      type: label(row.type), limit: numberOrNull(row.limit), used: numberOrNull(row.used),
      remaining: numberOrNull(row.remaining), resetAt: dateOrNull(row.reset_at),
    })),
    resourcePacks: (raw.resource_packs ?? []).map(row => ({
      id: label(String(row.id ?? '')), name: label(row.name),
      total: numberOrNull(row.total_credits), used: numberOrNull(row.used_credits),
      remaining: numberOrNull(row.remaining_credits), expiresAt: dateOrNull(row.expires_at), status: label(row.status),
    })),
    ...(consoleURL ? { consoleURL } : {}),
  }
}
