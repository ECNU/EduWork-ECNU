const registrations = [], loaded = [], listeners = new Map()
let rating = 0, posts = [], denied = false, account = { profileID: 'school', state: 'connected', credentialReady: true, userName: 'Synthetic user' }
let delayed = false, release, reads = 0, privateModelSelected = false
let delayRead = false, releaseRead
const profile = { id: 'school', displayName: '示例学校', organization: '示例学校', brand: {}, provider: { id: 'school-ai', models: [] } }
const ok = value => Promise.resolve({ ok: true, value })
const ctx = {
  locale: { dictionaries: new Map(), register(name, values) { this.dictionaries.set(name, values); return () => {} }, bind(name) { return key => this.dictionaries.get(name)?.zh[key] ?? key } },
  provide: (name, value) => { ctx[name] = value }, get: name => ctx[name], effect: setup => setup(), inject: (_names, fn) => fn(ctx), on: () => () => {},
  slots: { inject: (_name, fn) => fn(), register: (definition, component) => { registrations.push({ ...definition, component }); return () => {} } },
  remote: { $mount: async () => () => {}, $on: (name, listener) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener); return () => listeners.get(name).delete(listener) },
    oidcAccounts: {
      configuration: () => ok({ profiles: [profile], uiMode: 'standard', manageProductBrand: false }), status: () => ok(account), selectEnterpriseModel: () => ok({ changed: false }),
    },
    ecnuFeedback: {
      configuration: () => ok({ profileID: 'school', reasons: ['回答不准确'] }),
      preview: (_session, message) => ok(message === 'school-message' ? { state: 'available', question: '用户可见的问题', answer: '模型最终回答。\n包含可核对的正文。', digest: 'a'.repeat(64) } : { state: 'ineligible' }),
      read: async () => { reads++; const snapshot = denied ? { state: 'permission_denied' } : { state: 'available', favorite: rating, accountBinding: 'b2275353-c236-42cb-babb-3dbe2647b40a' }; if (delayRead) { delayRead = false; await new Promise(resolve => { releaseRead = resolve }) } return ok(snapshot) },
      submit: async (session, message, action) => { posts.push({ session, message, action }); if (delayed) await new Promise(resolve => { release = resolve }); rating = action.favorite; return ok({ state: 'available', favorite: rating, accountBinding: 'b2275353-c236-42cb-babb-3dbe2647b40a' }) },
    },
  },
}
window.__ModuleLoader__ = { load: definition => { const plugin = definition.factory(name => name === 'react' ? React : name === 'react-dom' ? ReactDOM : undefined); loaded.push(Promise.resolve(plugin.apply(ctx))) } }
window.mountFixture = async () => {
  await Promise.all(loaded); await new Promise(resolve => setTimeout(resolve, 0))
  const entry = registrations.find(value => value.name === 'conversation.chat.assistant-actions'), root = ReactDOM.createRoot(document.getElementById('root')); let mount = 0
  const render = () => root.render(React.createElement('main', { style: { margin: '48px auto', width: 700, maxWidth: '95vw' } },
    React.createElement('h2', null, '回答反馈'), React.createElement('p', null, privateModelSelected ? '当前选择：个人模型' : '当前选择：学校模型'),
    ...[['school-message', '学校模型历史回答'], ['personal-message', '个人模型回答']].map(([messageId, label]) => React.createElement('section', { key: `${mount}-${messageId}`, 'aria-label': label, style: { padding: 16, border: '1px solid #dedee8', borderRadius: 12, marginBottom: 20 } }, React.createElement('p', null, label), React.createElement(entry.component, { ...entry.inject('local-session'), messageId, useAccess: () => true }))),
    React.createElement('button', { id: 'outside' }, 'Outside')))
  window.fixture = { state: () => ({ rating, posts, reads }), deny: value => { denied = value }, remount: () => { mount++; render() }, selectPersonal: () => { privateModelSelected = true; render() }, delay: () => { delayed = true }, release: () => { delayed = false; release?.() },
    delayRead: () => { delayRead = true }, releaseRead: () => releaseRead?.(),
    switchAccount: async () => { account = { ...account, userName: 'Another synthetic user' }; for (const callback of listeners.get('credentials/reference-updated') ?? []) await callback() },
  }
  render()
}
