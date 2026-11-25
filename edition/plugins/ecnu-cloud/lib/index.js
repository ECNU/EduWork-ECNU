import { createHash } from 'node:crypto'
import { principalOf, Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { createBrowser } from './browser.js'
import { createImporter } from './importer.js'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

const id = z.string().min(1).max(256).regex(/^[^\u0000-\u001f\u007f]+$/)
const common = { scope: z.string().length(64), sourceID: id, workspaceID: id }
export const bindingsDomain = defineDomain({ name: 'ecnu_cloud_bindings', version: 1, tables: {
  projects: domainTable(z.object(common).strict()),
  conversations: domainTable(z.object({ ...common, sessionID: id, projectID: id.nullable() }).strict()),
} })
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const key = (scope, sourceID) => hash([scope, sourceID])
const checkID = value => id.parse(value)
export class CloudBindingError extends Error {
  constructor(code) { super(code); this.name = 'CloudBindingError'; this.code = code }
}
const fail = code => { throw new CloudBindingError(code) }
function configOf(raw) {
  checkID(raw?.profileID)
  const base = new URL(raw.modelBaseURL)
  const development = raw.allowInsecureDevelopment === true && base.protocol === 'http:'
  if (base.protocol !== 'https:' && !development || base.username || base.password || base.search || base.hash) fail('invalid_environment')
  return { profileID: raw.profileID, modelBaseURL: base.href.replace(/\/$/, '') }
}

const initializers = []
/** Local bindings stay Host-only. Only the fixed browser methods are Remote. */
export default class EcnuCloud extends TypertRemoteService {
  static inject = ['storageDomain', 'workspaceRegistry', 'oidcAccounts']
  constructor(ctx, raw) {
    super(ctx, 'ecnuCloud')
    for (const initialize of initializers) initialize.call(this)
    this.config = configOf(raw)
    this.epoch = 0; this.closed = false; this.tail = Promise.resolve()
    const verify = async () => {
      const epoch = this.epoch
      const identity = await ctx.oidcAccounts.accountIdentity?.(this.config.profileID)
      if (epoch === this.epoch && this.identity && this.identity !== identity?.accountID) this.epoch++
    }
    ctx.on('oidc/accounts-changed', event => {
      if (event.profileID !== this.config.profileID) return
      if (event.state === 'connected' && !event.authorizationChanged) void verify().catch(() => {})
      else { this.epoch++; this.identity = undefined }
    })
    ctx.on('credentials/reference-updated', () => { void verify().catch(() => {}) })
    this.browser = createBrowser(this)
    this.importer = createImporter(this)
    this.ready = ctx.storageDomain.open(bindingsDomain).then(domain => { this.domain = domain })
    void this.ready.catch(() => ctx.logger.warn('Cloud bindings storage unavailable'))
    ctx.effect(() => async () => {
      this.closed = true; this.epoch++
      await this.ready.catch(() => {})
      await this.tail
      await this.domain?.close()
    })
  }
  async account() {
    if (this.closed) fail('closed')
    const epoch = this.epoch, accounts = this.ctx.oidcAccounts, config = this.config
    // The existing shared Host API supplies a verified stable identity. Do not
    // derive it from a display name, renderer input, or decoded credential.
    if (typeof accounts.accountIdentity !== 'function') fail('identity_unavailable')
    if (!await accounts.modelAuthorization(config.profileID, config.modelBaseURL)) fail('not_connected')
    const identity = await accounts.accountIdentity(config.profileID)
    if (this.closed || epoch !== this.epoch) fail('account_changed')
    if (identity?.profileID !== config.profileID || typeof identity.accountID !== 'string' || !identity.accountID) fail('not_connected')
    if (this.identity && this.identity !== identity.accountID) this.epoch++
    this.identity = identity.accountID
    if (epoch !== this.epoch) fail('account_changed')
    return { epoch, scope: hash([config.modelBaseURL, config.profileID, identity.accountID]) }
  }
  guard(account) {
    if (this.closed) fail('closed')
    if (account.epoch !== this.epoch) fail('account_changed')
  }
  cloudState() { return principalOf(this.ctx.invocation) === undefined ? this.browser.state() : Promise.resolve({ state: 'permission_denied' }) }
  cloudList(input) { return principalOf(this.ctx.invocation) === undefined ? this.browser.list(input) : Promise.resolve({ state: 'permission_denied' }) }
  cloudPreview(input) { return principalOf(this.ctx.invocation) === undefined ? this.browser.preview(input) : Promise.resolve({ state: 'permission_denied' }) }
  cloudDestination(input) { return principalOf(this.ctx.invocation) === undefined ? this.importer.destination(input) : Promise.resolve({ state: 'permission_denied' }) }
  cloudImport(input, signal) { return principalOf(this.ctx.invocation) === undefined ? this.importer.import(input, signal ?? this.ctx.invocation?.signal) : Promise.resolve({ state: 'permission_denied' }) }
  operation(work) {
    // Capture the initiating identity before queuing. A queued operation must
    // not silently execute for a newly signed-in account.
    const identity = this.account()
    void identity.catch(() => {})
    const result = this.tail.then(async () => {
      const account = await identity
      await this.ready
      this.guard(account)
      const value = await work(account)
      this.guard(account)
      return value
    })
    this.tail = result.catch(() => {})
    return result
  }
  async workspace(workspaceID) {
    const workspace = this.ctx.workspaceRegistry.get(workspaceID)
    if (!workspace) return { state: 'missing_workspace', workspaceID }
    if (await workspace.status() !== 'ok') return { state: 'missing_directory', workspaceID }
    return { state: 'available', workspaceID }
  }
  async conversationState(row) {
    const status = await this.workspace(row.workspaceID)
    if (status.state !== 'available') return { ...status, sessionID: row.sessionID }
    const workspace = this.ctx.workspaceRegistry.get(row.workspaceID)
    if (!workspace?.sessionIds.includes(row.sessionID)) return { state: 'missing_or_moved_session', workspaceID: row.workspaceID, sessionID: row.sessionID }
    return { state: 'available', workspaceID: row.workspaceID, sessionID: row.sessionID, projectID: row.projectID }
  }
  projectWorkspace(projectID) {
    checkID(projectID)
    return this.operation(async account => {
      const row = this.domain.table('projects').get(key(account.scope, projectID))
      return row ? this.workspace(row.workspaceID) : { state: 'unbound' }
    })
  }
  bindProject(projectID, workspaceID) {
    checkID(projectID); checkID(workspaceID)
    return this.operation(async account => {
      const status = await this.workspace(workspaceID)
      if (status.state !== 'available') fail(status.state)
      this.guard(account)
      await this.domain.table('projects').put(key(account.scope, projectID), { scope: account.scope, sourceID: projectID, workspaceID })
      return { state: 'available', workspaceID }
    })
  }
  unbindProject(projectID) {
    checkID(projectID)
    return this.operation(async account => { this.guard(account); await this.domain.table('projects').delete(key(account.scope, projectID)) })
  }
  conversation(conversationID) {
    checkID(conversationID)
    return this.operation(async account => {
      const row = this.domain.table('conversations').get(key(account.scope, conversationID))
      return row ? this.conversationState(row) : { state: 'unbound' }
    })
  }
  rememberConversation(conversationID, sessionID, workspaceID, projectID = null) {
    checkID(conversationID); checkID(sessionID); checkID(workspaceID)
    if (projectID !== null) checkID(projectID)
    return this.operation(async account => {
      const table = this.domain.table('conversations'), recordKey = key(account.scope, conversationID)
      const row = { scope: account.scope, sourceID: conversationID, sessionID, workspaceID, projectID }
      const existing = table.get(recordKey)
      if (existing && (existing.sessionID !== sessionID || existing.workspaceID !== workspaceID || existing.projectID !== projectID)) fail('conversation_already_bound')
      // A local conversation cannot inherit two cloud project scopes.
      for (const [, item] of table.entries()) if (item.sessionID === sessionID && (item.scope !== account.scope || item.sourceID !== conversationID)) fail('session_already_bound')
      const status = await this.conversationState(row)
      if (status.state !== 'available') fail(status.state)
      this.guard(account)
      if (!existing) await table.put(recordKey, row)
      return status
    })
  }
  forgetConversation(conversationID) {
    checkID(conversationID)
    return this.operation(async account => { this.guard(account); await this.domain.table('conversations').delete(key(account.scope, conversationID)) })
  }
  projectForSession(sessionID) {
    checkID(sessionID)
    return this.operation(async account => {
      const row = [...this.domain.table('conversations').entries()].map(([, value]) => value).find(value => value.scope === account.scope && value.sessionID === sessionID)
      if (!row || row.projectID === null) return { state: 'unbound' }
      // Never derive project access from other sessions in the same directory
      // or from the project's default-workspace preference.
      const status = await this.conversationState(row)
      return status.state === 'available' ? { state: 'bound', projectID: row.projectID } : { state: 'invalid_local_binding' }
    })
  }
}
for (const method of ['cloudState', 'cloudList', 'cloudPreview', 'cloudDestination', 'cloudImport']) Remote(method)(EcnuCloud.prototype[method], {
  kind: 'method', name: method, static: false, private: false, addInitializer(initialize) { initializers.push(initialize) },
})
