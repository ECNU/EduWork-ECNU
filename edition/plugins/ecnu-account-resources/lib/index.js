import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { normalizeQuota, resolveQuotaProviderIDs } from './quota.js'
import { createPointsService } from './points.js'
import { createAccountScope } from './account-scope.js'

export const name = 'ecnu-account-resources'
const initializers = []
export class EcnuAccountResources extends TypertRemoteService {
  static inject = ['oidcAccounts']
  constructor(ctx, config = {}) {
    super(ctx, 'ecnuAccountResources')
    for (const initialize of initializers) initialize.call(this)
    const ids = config.profileIDs ?? ['ecnu']
    if (!Array.isArray(ids) || ids.length > 64 || ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id))) throw new Error('ECNU account resources requires explicit profile IDs')
    this.profileIDs = [...new Set(ids)]
    this.quotaProviderIDs = resolveQuotaProviderIDs(this.profileIDs, config.quotaProviderIDs)
    this.pointsService = createPointsService(ctx, config.points)
    if (this.pointsService.profileID && !this.profileIDs.includes(this.pointsService.profileID)) throw Error('points profileID must belong to profileIDs')
    this.accounts = createAccountScope(ctx, this.profileIDs)
  }
  configuration() { return Promise.resolve({ profileIDs: this.profileIDs, ...(this.pointsService.profileID ? { pointsProfileID: this.pointsService.profileID } : {}) }) }
  points(profileID) { return this.pointsService.points(profileID) }
  accountState(profileID) { return this.pointsService.accountState(profileID) }
  invitation(profileID) { return this.pointsService.invitation(profileID) }
  async quota(profileID) {
    if (!this.profileIDs.includes(profileID)) return { state: 'not_configured' }
    const account = this.accounts.begin(profileID)
    try {
      const configuration = await this.ctx.oidcAccounts.configuration()
      if (account.signal.aborted) return { state: account.failureState() }
      const profile = configuration.profiles.find(profile => profile.id === profileID)
      if (!profile?.provider) return { state: 'not_configured' }
      if (!await account.current()) return { state: account.failureState() }
      const status = await this.ctx.oidcAccounts.status(profileID)
      if (!status.credentialReady) return { state: 'not_connected' }
      if (!await account.current()) return { state: account.failureState() }
      const response = await this.ctx.oidcAccounts.modelResourceFetch(profileID, '/quota', { signal: account.signal })
      if (!response.ok) { await response.body?.cancel(); return { state: await account.current() ? 'unavailable' : account.failureState() } }
      const quota = normalizeQuota(await response.json(), profile.provider.id, this.quotaProviderIDs.get(profileID) ?? profile.provider.id)
      const currentStatus = await this.ctx.oidcAccounts.status(profileID)
      if (!currentStatus.credentialReady) return { state: 'not_connected' }
      if (!await account.current()) return { state: account.failureState() }
      return quota
    } catch { return { state: account.failureState() } }
  }
}
for (const method of ['configuration', 'quota', 'points', 'invitation', 'accountState']) Remote(method)(EcnuAccountResources.prototype[method], {
  kind: 'method', name: method, static: false, private: false, addInitializer(initialize) { initializers.push(initialize) },
})
export default EcnuAccountResources
