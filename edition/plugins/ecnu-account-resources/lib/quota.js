const numberOrNull = value => value === null || value === undefined ? null
  : typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value
    : (() => { throw new Error('invalid quota number') })()
const label = value => typeof value === 'string' ? value.slice(0, 256) : ''
const dateOrNull = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null

// Local model-route IDs may differ from the server's stable quota namespace.
// Only an explicit, profile-scoped mapping may override the historical match.
export function resolveQuotaProviderIDs(profileIDs, mapping = {}) {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(mapping))) throw new Error('quotaProviderIDs must be a profile-to-provider object')
  const result = new Map()
  for (const profileID of Reflect.ownKeys(mapping)) {
    if (typeof profileID !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(profileID) || !profileIDs.includes(profileID)) throw new Error('quotaProviderIDs must only name configured profiles')
    const providerID = mapping[profileID]
    if (typeof providerID !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(providerID)) throw new Error('quotaProviderIDs requires a non-empty server provider ID')
    result.set(profileID, providerID)
  }
  return result
}

export function normalizeQuota(raw, providerID, expectedQuotaProviderID = providerID) {
  if (raw?.provider_id !== expectedQuotaProviderID) throw new Error('quota provider mismatch')
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
