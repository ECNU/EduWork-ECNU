import { randomUUID } from 'node:crypto'
/** Keep account-scoped reads valid across token renewal, but never across accounts. */
export function createAccountScope(ctx, profileIDs) {
  const fresh = () => ({ controller: new AbortController(), accountID: undefined, revision: randomUUID() })
  const records = new Map(profileIDs.map(id => [id, fresh()]))
  const hasIdentity = typeof ctx.oidcAccounts.accountIdentity === 'function'
  let disposed = false
  const invalidate = profileID => {
    const record = records.get(profileID)
    if (!record) return
    record.controller.abort()
    records.set(profileID, fresh())
  }
  const verify = async (profileID, record) => {
    if (disposed || record.controller.signal.aborted) return false
    if (hasIdentity) {
      const identity = await ctx.oidcAccounts.accountIdentity(profileID)
      if (disposed || records.get(profileID) !== record || record.controller.signal.aborted) return false
      if (identity?.profileID !== profileID || typeof identity.accountID !== 'string' || !identity.accountID
        || record.accountID !== undefined && record.accountID !== identity.accountID) {
        invalidate(profileID)
        return false
      }
      record.accountID = identity.accountID
    }
    return true
  }
  ctx.on('oidc/accounts-changed', event => {
    // A first status read can announce an already connected account. Stable
    // identity checks cover that announcement; completed sign-ins still reset.
    if (hasIdentity && event.state === 'connected' && !event.authorizationChanged) {
      const record = records.get(event.profileID)
      if (record?.accountID) void verify(event.profileID, record).catch(() => {})
      return
    }
    invalidate(event.profileID)
  })
  ctx.on('credentials/reference-updated', () => {
    // Older identity providers cannot distinguish token renewal from replacement.
    if (!hasIdentity) for (const profileID of profileIDs) invalidate(profileID)
    else for (const [profileID, record] of records) {
      if (record.accountID) void verify(profileID, record).catch(() => {})
    }
  })
  ctx.effect(() => () => { disposed = true; for (const record of records.values()) record.controller.abort() })
  return {
    invalidate,
    begin(profileID) {
      const record = records.get(profileID)
      const signal = AbortSignal.any([record.controller.signal, AbortSignal.timeout(20000)])
      return {
        signal,
        revision: hasIdentity ? record.revision : undefined,
        failureState: () => disposed || record.controller.signal.aborted ? 'not_connected' : 'unavailable',
        async current() {
          if (disposed || signal.aborted) return false
          return await verify(profileID, record) && !signal.aborted
        },
      }
    },
  }
}
