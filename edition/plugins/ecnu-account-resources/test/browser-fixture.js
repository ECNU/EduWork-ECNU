const ecnu = { id: 'ecnu', displayName: '示例大学', organization: '示例大学', brand: { mark: 'E' }, provider: { id: 'fixture-ai', models: [{ name: 'Example model' }] } }
const other = { ...ecnu, id: 'third-party', displayName: '另一所学校', organization: '另一所学校' }
const configuration = { uiMode: 'standard', profiles: [ecnu], manageProductBrand: false }
const connected = profileID => ({ profileID, state: 'connected', credentialReady: true, userName: profileID === 'ecnu' ? 'ECNU synthetic user' : 'Other synthetic user' })
let account = connected('ecnu'), reads = 0, calls = [], pending = false, quotaReleases = [], remaining = 90, quotaFailure = null
const pointsEnabled = new URLSearchParams(location.search).has('points')
let pointReads = 0, invitationCalls = 0, denied = false, delayInvitation = false, releaseInvitation
let delayPoints = new URLSearchParams(location.search).has('slowPoints'), pointReleases = []
let accountRevision = '10000000-0000-4000-8000-000000000001'
const registrations = [], events = new Map(), localEvents = new Map(), loaded = []
const emit = async name => { await Promise.all([...(events.get(name) ?? [])].map(listener => listener({ ref: 'SYNTHETIC_SESSION' }))) }
const ok = value => Promise.resolve({ ok: true, value })
const quota = () => ({ state: 'available', providerID: 'fixture-ai', unit: 'credits', windows: [{ type: 'fixed_168h', limit: 100, used: 10, remaining, resetAt: '2026-09-17T00:00:00Z' }], resourcePacks: [
  { id: '1', name: '科研资源包', total: 1000, used: 70, remaining: 930, expiresAt: '2027-01-01T00:00:00Z', status: 'active' },
  { id: '2', name: '补充资源包', total: null, used: null, remaining: 55, expiresAt: null, status: '' },
], consoleURL: 'https://example.org/allowance' })
const ctx = {
  provide: (name, value) => { ctx[name] = value },
  locale: { dictionaries: new Map(), register(namespace, values) { this.dictionaries.set(namespace, values); return () => {} }, bind(namespace) { return key => this.dictionaries.get(namespace)?.zh[key] ?? key } },
  remote: { $mount: async () => () => {}, $on: (name, listener) => { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(listener); return () => events.get(name)?.delete(listener) },
    oidcAccounts: {
      configuration: () => ok(configuration), status: () => ok(account), selectEnterpriseModel: () => ok({ changed: false }), reconcile: () => ok(account),
      resources: () => ok({ profileID: account.profileID, models: [], modelSource: 'profile', issues: [] }),
      logout: () => { account = { profileID: account.profileID, state: 'signed_out', credentialReady: false }; return ok(account) },
      begin: () => ok({ mode: 'external', loginID: 'test' }), loginStatus: () => ok({ state: 'completed', status: account }), cancelLogin: () => ok({ state: 'cancelled' }),
    },
    ecnuAccountResources: { configuration: () => ok({ profileIDs: ['ecnu'], ...(pointsEnabled ? { pointsProfileID: 'ecnu' } : {}) }),
      accountState: () => ok({ state: account.credentialReady ? 'available' : 'not_connected', accountRevision }),
      points: async () => {
        pointReads++
        const snapshot = { ...(denied ? { state: 'permission_denied' } : { state: 'available', currentPoints: 156, nextExpiryAt: '2099-05-01T00:00:00Z', nextExpiryPoints: 42, expiryNotice: '最近到期信息由平台提供。' }), accountRevision }
        if (delayPoints) await new Promise(resolve => { pointReleases.push(resolve) })
        return ok(snapshot)
      },
      invitation: async () => { invitationCalls++; const revision = accountRevision; if (delayInvitation) await new Promise(resolve => { releaseInvitation = resolve }); return ok({ ...(denied ? { state: 'permission_denied' } : { state: 'available', referralCode: 'SYNTHETIC', inviteURL: 'https://example.org/html/#/invite/SYNTHETIC', expiresAt: '2099-11-24T12:00:00Z' }), accountRevision: revision }) },
      quota: async id => {
      reads++; calls.push(id)
      if (quotaFailure === 'rpc') throw new Error('Synthetic quota RPC failure')
      const snapshot = quotaFailure === 'unavailable' ? { state: 'unavailable' } : quota()
      if (pending) await new Promise(resolve => { quotaReleases.push(resolve) })
      return ok(snapshot)
    } },
  },
  on: (name, listener) => { if (!localEvents.has(name)) localEvents.set(name, new Set()); localEvents.get(name).add(listener); return () => localEvents.get(name)?.delete(listener) }, get: () => undefined, inject: (_names, callback) => callback(ctx), effect: setup => setup(),
  slots: { inject: (_name, callback) => callback(), register: (definition, component) => { registrations.push({ ...definition, component }); return () => {} } },
}
window.__ModuleLoader__ = { load: definition => {
  const plugin = definition.factory(name => {
    if (name === 'react') return window.React
    if (name === 'react-dom') return window.ReactDOM
    throw new Error('Unexpected module ' + name)
  })
  loaded.push(Promise.resolve(plugin.apply(ctx)))
} }
window.mountFixture = async () => {
  await Promise.all(loaded); await new Promise(resolve => setTimeout(resolve, 0))
  const footer = registrations.find(item => item.name === 'sidebar.footer.action')
  const inject = footer.inject
  footer.inject = () => ({ ...inject(), t: ctx.locale.bind(footer.locale) })
  const root = ReactDOM.createRoot(document.getElementById('root'))
  let wide = true
  const renderSlot = (name, owner, options) => {
    const entry = registrations.find(item => item.name === name)
    return entry ? React.createElement(entry.component, { ...owner, ...entry.inject?.() }) : options?.fallback
  }
  const render = () => root.render(React.createElement(React.Fragment, null,
    React.createElement('aside', { style: { position: 'fixed', left: 0, bottom: 0, width: wide ? 250 : 44, padding: 4 } }, React.createElement(footer.component, { ...footer.inject(), renderSlot, wide })),
    React.createElement('button', { id: 'outside', style: { position: 'fixed', top: 20, right: 20 } }, 'Outside')))
  window.fixture = {
    reads: () => reads, calls: () => calls,
    points: () => ({ pointReads, invitationCalls }),
    renew: async () => { account = { ...account }; await emit('credentials/reference-updated') },
    replaceAccount: async () => { accountRevision = '10000000-0000-4000-8000-000000000002'; account = { ...account }; await emit('credentials/reference-updated') },
    reconnect: async () => { accountRevision = '10000000-0000-4000-8000-000000000003'; await Promise.all([...(localEvents.get('connection/reset') ?? [])].map(listener => listener())) },
    deny: () => { denied = true },
    collapse: () => { wide = false; render() },
    delayInvite: () => { delayInvitation = true }, releaseInvite: () => { delayInvitation = false; releaseInvitation?.() },
    delayPoints: () => { delayPoints = true }, releasePoints: () => { delayPoints = false; pointReleases.splice(0).forEach(resolve => resolve()) },
    declarations: () => footer.children,
    setRemaining: value => { remaining = value },
    failQuota: mode => { quotaFailure = mode },
    delay: () => { pending = true }, release: () => { pending = false; quotaReleases.splice(0).forEach(resolve => resolve()) },
    switch: async id => {
      account = connected(id); configuration.profiles[0] = id === 'ecnu' ? ecnu : other
      await footer.inject().service.status(id); render()
    },
  }
  render()
}
