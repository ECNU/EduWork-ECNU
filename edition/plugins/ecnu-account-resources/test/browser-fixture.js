const ecnu = { id: 'ecnu', displayName: '示例大学', organization: '示例大学', brand: { mark: 'E' }, provider: { id: 'fixture-ai', models: [{ name: 'Example model' }] } }
const other = { ...ecnu, id: 'third-party', displayName: '另一所学校', organization: '另一所学校' }
const configuration = { uiMode: 'standard', profiles: [ecnu], manageProductBrand: false }
const connected = profileID => ({ profileID, state: 'connected', credentialReady: true, userName: profileID === 'ecnu' ? 'ECNU synthetic user' : 'Other synthetic user' })
let account = connected('ecnu'), reads = 0, calls = [], pending = false, release, remaining = 90
const registrations = [], events = new Map(), loaded = []
const ok = value => Promise.resolve({ ok: true, value })
const quota = () => ({ state: 'available', providerID: 'fixture-ai', unit: 'credits', windows: [{ type: 'fixed_168h', limit: 100, used: 10, remaining, resetAt: '2026-09-17T00:00:00Z' }], resourcePacks: [
  { id: '1', name: '科研资源包', total: 1000, used: 70, remaining: 930, expiresAt: '2027-01-01T00:00:00Z', status: 'active' },
  { id: '2', name: '补充资源包', total: null, used: null, remaining: 55, expiresAt: null, status: '' },
], consoleURL: 'https://example.org/allowance' })
const ctx = {
  remote: { $mount: async () => () => {}, $on: (name, listener) => { events.set(name, listener); return () => events.delete(name) },
    oidcAccounts: {
      configuration: () => ok(configuration), status: () => ok(account), selectEnterpriseModel: () => ok({ changed: false }), reconcile: () => ok(account),
      resources: () => ok({ profileID: account.profileID, models: [], modelSource: 'profile', issues: [] }),
      logout: () => { account = { profileID: account.profileID, state: 'signed_out', credentialReady: false }; return ok(account) },
      begin: () => ok({ mode: 'external', loginID: 'test' }), loginStatus: () => ok({ state: 'completed', status: account }), cancelLogin: () => ok({ state: 'cancelled' }),
    },
    ecnuAccountResources: { configuration: () => ok({ profileIDs: ['ecnu'] }), quota: async id => {
      reads++; calls.push(id); const snapshot = quota()
      if (pending) await new Promise(resolve => { release = resolve })
      return ok(snapshot)
    } },
  },
  on: () => () => {}, get: () => undefined, inject: (_names, callback) => callback(ctx), effect: () => {},
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
  const root = ReactDOM.createRoot(document.getElementById('root'))
  const renderSlot = (name, owner, options) => {
    const entry = registrations.find(item => item.name === name)
    return entry ? React.createElement(entry.component, { ...owner, ...entry.inject?.() }) : options?.fallback
  }
  const render = () => root.render(React.createElement(React.Fragment, null,
    React.createElement('aside', { style: { position: 'fixed', left: 0, bottom: 0, width: 250, padding: 4 } }, React.createElement(footer.component, { ...footer.inject(), renderSlot, wide: true })),
    React.createElement('button', { id: 'outside', style: { position: 'fixed', top: 20, right: 20 } }, 'Outside')))
  window.fixture = {
    reads: () => reads, calls: () => calls,
    declarations: () => footer.children,
    setRemaining: value => { remaining = value },
    delay: () => { pending = true }, release: () => { pending = false; release?.() },
    switch: async id => {
      account = connected(id); configuration.profiles[0] = id === 'ecnu' ? ecnu : other
      await footer.inject().service.status(id); render()
    },
  }
  render()
}
