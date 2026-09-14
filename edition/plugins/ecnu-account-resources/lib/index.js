import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { normalizeQuota } from './quota.js'

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
    this.version = 0
    this.abort = new AbortController()
    ctx.on('credentials/reference-updated', () => { this.version++ })
    ctx.on('oidc/accounts-changed', () => { this.version++ })
    ctx.effect(() => () => { this.version++; this.abort.abort() }, 'ecnu-account-resources: stop pending requests')
  }
  configuration() { return Promise.resolve({ profileIDs: this.profileIDs }) }
  async quota(profileID) {
    if (!this.profileIDs.includes(profileID)) return { state: 'not_configured' }
    const configuration = await this.ctx.oidcAccounts.configuration()
    const profile = configuration.profiles.find(profile => profile.id === profileID)
    if (!profile?.provider) return { state: 'not_configured' }
    const status = await this.ctx.oidcAccounts.status(profileID)
    if (!status.credentialReady) return { state: 'not_connected' }
    const version = this.version
    try {
      const response = await this.ctx.oidcAccounts.modelResourceFetch(profileID, '/quota', { signal: this.abort.signal })
      if (!response.ok) return { state: 'unavailable' }
      const quota = normalizeQuota(await response.json(), profile.provider.id)
      const currentStatus = await this.ctx.oidcAccounts.status(profileID)
      if (version !== this.version || this.abort.signal.aborted || !currentStatus.credentialReady) return { state: 'not_connected' }
      return quota
    } catch { return { state: this.abort.signal.aborted || version !== this.version ? 'not_connected' : 'unavailable' } }
  }
}
for (const method of ['configuration', 'quota']) Remote(method)(EcnuAccountResources.prototype[method], {
  kind: 'method', name: method, static: false, private: false, addInitializer(initialize) { initializers.push(initialize) },
})
export default EcnuAccountResources
