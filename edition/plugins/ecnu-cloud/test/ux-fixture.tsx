import React from 'react'
import { createRoot } from 'react-dom/client'
import { ICON_SYMBOLS } from '@deepseek-ai/dsh-client-ui-primitives'
import { CloudPage } from '../src/client'
import { CloudSidebar, CloudWorkspaceLink, CloudSessionOrigin, createCloudNavigation, useCloud } from '../src/navigation'
let connected = true, delayed: string | undefined, release: any, projectFailure = false
const listeners = new Set<any>(), bindings = new Map<string, any>(), imports = new Map<string, any>()
const calls: any[] = [], opened: string[] = [], sent: any[] = [], created: string[] = [], aborted: string[] = []
const rows = [1, 2, 3].map(i => ({ conversationID: `cloud-${i}`, title: `云端示例${['一', '二', '三'][i - 1]}`, projectID: i === 2 ? 'p1' : null, updatedAt: Date.now() - i * 3600000 }))
const projects = [{ projectKey: 'notebook-1', projectID: 'p1', title: '研究项目', description: '把云端资料和手边工作联系起来。', conversationCount: 1 }, { projectKey: 'notebook-2', projectID: null, title: '历史资料库', conversationCount: 0 }]
const workspaces = [{ workspaceId: 'local-workspace', title: 'default-workspace', path: '/synthetic/default', sessionIds: [] }, { workspaceId: 'project-workspace', title: '研究项目', path: '/synthetic/project', sessionIds: [] }]
const sessions: Record<string, any> = {}
const archived: string[] = []
async function api(method: string, input?: any, signal?: AbortSignal) {
  calls.push({ method, input }); signal?.addEventListener('abort', () => aborted.push(method), { once: true })
  if (delayed === method) { delayed = undefined; await new Promise(resolve => { release = resolve; signal?.addEventListener('abort', () => resolve(null), { once: true }) }) }
  if (signal?.aborted) throw Error('Aborted')
  if (method === 'cloudState') return connected ? { state: 'available', lease: 'test-lease' } : { state: 'not_connected' }
  if (!connected) return { state: 'account_changed' }
  if (method === 'cloudWorkspaceBindings') return { state: 'available', bindings: [...bindings.values()], conversations: [...imports.values()] }
  if (method === 'cloudWorkspaceState') return { state: 'available', bindingState: bindings.has(input.projectKey) ? 'available' : 'unbound', workspaceID: bindings.get(input.projectKey)?.workspaceID }
  if (method === 'cloudWorkspaceConnect') { bindings.set(input.projectKey, { projectKey: input.projectKey, workspaceID: input.workspaceID, title: '研究项目' }); return { state: 'available', bindingState: 'available', workspaceID: input.workspaceID } }
  if (method === 'cloudWorkspaceDisconnect') { bindings.delete(input.projectKey); return { state: 'available', bindingState: 'unbound' } }
  if (method === 'cloudImport') {
    if (!imports.has(input.conversationID)) {
      const sessionID = 'local-' + input.conversationID, row = rows.find(r => r.conversationID === input.conversationID)!
      imports.set(input.conversationID, { conversationID: input.conversationID, sessionID, workspaceID: input.workspaceID, projectID: row.projectID })
      workspaces.find(w => w.workspaceId === input.workspaceID)!.sessionIds.push(sessionID); sessions[sessionID] = { title: row.title }
    }
    return { state: 'available', ...imports.get(input.conversationID) }
  }
  if (method === 'cloudList') return { state: 'available', lease: 'test-lease', items: rows, page: 1, hasMore: false }
  if (method === 'cloudProjects') return projectFailure ? { state: 'rate_limited' } : { state: 'available', projects }
  if (method === 'cloudProject') return { state: 'available', workspaceID: bindings.get(input.projectKey)?.workspaceID, conversations: input.projectKey === 'notebook-1' ? rows.filter(r => r.projectID === 'p1') : [], sources: [{ sourceID: 1, title: '项目说明.docx', type: 'file', status: 'ready' }] }
  if (method === 'cloudSource') return { state: 'available', sourceID: 1, text: '', empty: true }
  if (method === 'cloudDestination') { const linked = imports.get(input.conversationID), project = rows.find(r => r.conversationID === input.conversationID)?.projectID; return { state: 'available', bindingState: linked ? 'available' : project && !bindings.has('notebook-1') ? 'project_unbound' : 'unbound', ...linked, ...(project ? { projectKey: 'notebook-1', workspaceID: bindings.get('notebook-1')?.workspaceID } : {}) } }
  if (method === 'cloudPreview') return { state: 'available', lease: 'test-lease', summary: rows.find(r => r.conversationID === input.conversationID), total: 2, importable: true, snapshot: 'a'.repeat(64), messages: [
    { messageID: 'm1', role: 'user', supported: true, text: '请帮我整理项目计划。' },
    { messageID: 'm2', role: 'assistant', supported: true, text: '# 下一步\n\n先阅读资料，再继续讨论。\n\n- **整理**需求\n- 核对时间\n\n<script>window.unsafe = true</script>\n\n![远程图片](https://images.invalid/pixel.png)\n\n![参考图][pic]\n\n[pic]: https://images.invalid/reference.png\n\n<img src="https://images.invalid/html.png">' },
  ] }
  throw Error('Unknown fixture operation ' + method)
}
const watch = (callback: any) => { listeners.add(callback); return () => listeners.delete(callback) }
const store = createCloudNavigation(api, watch, () => {})
const openSession = async (id: string, current: any) => { if (!current || current()) opened.push(id) }
const common = { api, watch, store, openSession, openWorkspace: openSession, changed: () => store.refresh(),
  useNavigation: () => useCloud(store).route, useCloudState: () => useCloud(store), useWorkspaces: (select: any) => select({ items: workspaces, archivedSessionIds: archived }), useSessions: (select: any) => select({ byId: sessions }),
  createSession: async (id: string) => { created.push(id); workspaces.find(w => w.workspaceId === id)!.sessionIds.push('new-project-local'); sessions['new-project-local'] = { title: '本地项目任务', updatedAt: Date.now() }; return 'new-project-local' },
  sendSession: async (id: string, text: string) => { sent.push({ id, text }); opened.push(id) },
  renderFactorySlot: (_name: string, props: any) => props.open ? <div role="menu"><button onClick={() => props.onPick('local-workspace')}>默认工作区目录</button><button onClick={() => props.onPick('project-workspace')}>项目专用目录</button><button onClick={props.onClose}>取消目录选择</button></div> : null,
}
window.fixture = { async seedLists() {
  const now = Date.now()
  projects.push(...['一', '二', '三', '四'].map((name, i) => ({ projectKey: 'extra-' + i, projectID: 'extra-p-' + i, title: '额外项目' + name, description: '', conversationCount: 0 })))
  workspaces.push({ workspaceId: 'extra', title: '其他工作区', path: '/synthetic/extra', sessionIds: ['other-continuation', 'unrelated'] })
  workspaces[0].sessionIds.push('ordinary-local', 'ordinary-continued', 'archived', 'blank')
  workspaces[1].sessionIds.push('project-local', 'project-continued')
  Object.assign(sessions, { 'ordinary-local': { title: '默认工作区本地任务', updatedAt: now - 2000 }, 'ordinary-continued': { title: '已改名的本地续聊', updatedAt: now - 1000 }, 'other-continuation': { title: '其他工作区的普通续聊', updatedAt: now - 3000 }, unrelated: { title: '其他工作区无关任务', updatedAt: now }, 'project-local': { title: '项目本地任务', updatedAt: now - 4000 }, 'project-continued': { title: '项目已接续会话', updatedAt: now - 5000 }, archived: { title: '不应展示的归档任务', updatedAt: now }, blank: { title: '不应展示的空白任务', blank: true } })
  archived.push('archived')
  imports.set('cloud-1', { conversationID: 'cloud-1', sessionID: 'ordinary-continued', workspaceID: 'local-workspace', projectID: null })
  imports.set('cloud-3', { conversationID: 'cloud-3', sessionID: 'other-continuation', workspaceID: 'extra', projectID: null })
  rows.push({ conversationID: 'cloud-4', title: '项目原始标题', projectID: 'p1', updatedAt: now - 20000 }, { conversationID: 'cloud-5', title: '未接续的云端会话', projectID: null, updatedAt: now - 30000 })
  imports.set('cloud-4', { conversationID: 'cloud-4', sessionID: 'project-continued', workspaceID: 'project-workspace', projectID: 'p1' })
  bindings.set('notebook-1', { projectKey: 'notebook-1', workspaceID: 'project-workspace', title: '研究项目' })
  await store.refresh()
}, calls, opened, sent, created, aborted, imports, bindings, delay(method: string) { delayed = method }, release() { release?.() }, failProjects(value: boolean) { projectFailure = value }, renew() { listeners.forEach(fn => fn(false)) }, logout() { connected = false; listeners.forEach(fn => fn(false)) }, refresh: () => store.refresh() }
const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sprite.style.display = 'none'
for (const [id, markup] of Object.entries(ICON_SYMBOLS)) { const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement, symbol = document.createElementNS(svg.namespaceURI, 'symbol'); symbol.id = id; for (const { name, value } of svg.attributes) if (!['width', 'height', 'xmlns', 'class', 'aria-hidden'].includes(name)) symbol.setAttribute(name, value); symbol.append(...[...svg.childNodes].map(node => document.importNode(node, true))); sprite.append(symbol) }
document.body.append(sprite)
createRoot(document.getElementById('root')!).render(<div style={{ display: 'flex', height: '100vh' }}><aside style={{ width: 265, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid #8883' }}><CloudSidebar {...common} wide><div style={{ padding: 18 }}>本地工作区<div data-testid="native-project" style={{ display: 'flex', alignItems: 'center' }}>研究项目<CloudWorkspaceLink store={store} workspaceID="project-workspace" /></div><div data-testid="native-chat">原生接续条目<CloudSessionOrigin {...common} sessionId="local-cloud-1" /></div></div></CloudSidebar></aside><main style={{ flex: 1, minWidth: 0 }}><CloudPage {...common} /></main></div>)
