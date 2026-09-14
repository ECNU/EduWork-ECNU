const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0
export function remainingPercent(remaining, total) {
  if (!finite(remaining) || !finite(total) || total <= 0) return null
  return Math.round(Math.max(0, Math.min(100, remaining / total * 100)))
}
export function quotaSummary(quota, now = Date.now()) {
  const window = quota?.windows?.find(row => row.type === 'fixed_168h') || quota?.windows?.[0]
  const packs = (quota?.resourcePacks ?? []).filter(row => !['expired','revoked','disabled','deleted'].includes(row.status?.toLowerCase()) && (!row.expiresAt || Date.parse(row.expiresAt) > now))
  const known = packs.length > 0 && packs.every(row => finite(row.total) && finite(row.remaining))
  return { window, windowPercent: remainingPercent(window?.remaining, window?.limit),
    poolPercent: known ? remainingPercent(packs.reduce((n,row)=>n+row.remaining,0), packs.reduce((n,row)=>n+row.total,0)) : null,
    poolRemaining: packs.length && packs.every(row=>finite(row.remaining)) ? packs.reduce((n,row)=>n+row.remaining,0) : null }
}
