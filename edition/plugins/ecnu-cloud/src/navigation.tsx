import { conversationEntries } from './conversation-entries.js'
import { ConversationRow } from './conversation-row.js'
import { projectStatus, ProjectStatusIcon } from './project-status.js'
import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { Tooltip, IconGlobeOutlineRegular, IconLinkOutlineRegular, IconChevronRightOutlineRegular, IconRefreshOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'

const empty = { lease: null, rows: [], projects: [], bindings: [], conversations: [], busy: false, error: '', projectError: '', route: null }
export function createCloudNavigation(api: any, watch: any, show: () => void) {
  let state: any = empty, generation = 0, pending: Promise<void> | undefined, sequence = 0
  const listeners = new Set<() => void>()
  const set = (patch: any) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()) }
  async function refresh() {
    if (pending) return pending
    const g = generation
    pending = (async () => {
      set({ busy: true, error: '' })
      try {
        const identity = await api('cloudState')
        if (g !== generation) return
        if (identity.state !== 'available') { set({ ...empty, error: '请登录学校账号后查看云端内容。' }); return }
        if (identity.lease !== state.lease) set({ ...empty, busy: true, lease: identity.lease })
        const lease = identity.lease
        const results = await Promise.allSettled([api('cloudList', { lease, page: 1 }), api('cloudProjects', { lease }), api('cloudWorkspaceBindings', { lease })])
        if (g !== generation || lease !== state.lease) return
        const [chats, projects, local] = results.map(r => r.status === 'fulfilled' ? r.value : { state: 'unavailable' })
        set({ rows: chats.state === 'available' ? chats.items : [], projects: projects.state === 'available' ? projects.projects : [],
          bindings: local.state === 'available' ? local.bindings : [], conversations: local.state === 'available' ? local.conversations ?? [] : [],
          error: chats.state === 'available' ? '' : '暂时无法读取云端会话，可重试。', projectError: projects.state === 'available' ? '' : '暂时无法读取项目，可重试。' })
      } catch { if (g === generation) set({ error: '暂时无法读取云端内容，可重试。' }) }
      finally { if (g === generation) { pending = undefined; set({ busy: false }) } }
    })()
    return pending
  }
  const stop = watch(async (reset: boolean) => {
    const g = generation
    let identity
    try { identity = reset ? null : await api('cloudState') } catch { identity = null }
    if (g !== generation) return
    if (!identity || identity.state !== 'available' || identity.lease !== state.lease) {
      generation++; pending = undefined; set(empty); void refresh()
    }
  })
  return {
    getSnapshot: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) }, refresh,
    go(kind: string, row?: any, extra?: any) { set({ route: { kind, row, ...extra, seq: ++sequence, lease: state.lease } }); show() },
    dispose() { generation++; stop(); listeners.clear() },
  }
}
export const useCloud = (store: any) => useSyncExternalStore(store.subscribe, store.getSnapshot)

const collapseKey = 'eduwork.ecnuCloud.sidebarExpanded.v1'
function savedExpansion() { try { return localStorage.getItem(collapseKey) === 'true' } catch { return false } }
function IconButton({ label, children, onClick, ...props }: any) {
  return <Tooltip label={label} side="right" delayMs={350} portal><button type="button" className="ecnu-cloud-icon" aria-label={label} onClick={e => { e.stopPropagation(); onClick?.() }} {...props}>{children}</button></Tooltip>
}
const previewLimit = 3
function PreviewHeading({ title, hint, expanded, toggle, allLabel, openAll }: any) {
  return <div className="ecnu-nav-section-heading">
    <button className="ecnu-nav-section" aria-label={hint ? `${title}，${hint}` : title} aria-expanded={expanded} onClick={toggle}><IconChevronRightOutlineRegular size={12} /><span>{title}</span>{hint && <span className="ecnu-nav-preview-count">{hint}</span>}</button>
    <button type="button" className="ecnu-nav-all" aria-label={allLabel} onClick={openAll}>{allLabel}</button>
  </div>
}
export function CloudSidebar({ children, wide, store, api, useWorkspaces, useSessions, usePanelInfo = (select: any) => select({ activePanelId: 'ecnu-cloud' }) }: any) {
  const state = useCloud(store), [open, setOpen] = useState(savedExpansion), [sections, setSections] = useState({ chats: true, projects: true })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}), [details, setDetails] = useState<Record<string, any>>({})
  const workspaces = useWorkspaces((s: any) => s.items), sessions = useSessions((s: any) => s.byId), archived = useWorkspaces((s: any) => s.archivedSessionIds)
  const panel = usePanelInfo((s: any) => s.activePanelId)
  const currentSession = panel === null ? Object.entries(sessions).find(([, row]: any) => (row.retainedBy?.mainView ?? 0) > 0)?.[0] : undefined
  useEffect(() => { void store.refresh() }, [store])
  useEffect(() => { setDetails({}); setExpanded({}) }, [state.lease, state.projects])
  function toggle() { setOpen(value => { const next = !value; try { localStorage.setItem(collapseKey, String(next)) } catch {} return next }) }
  async function expand(project: any) {
    const key = project.projectKey, lease = state.lease
    setExpanded(old => ({ ...old, [key]: !old[key] }))
    if (details[key] || expanded[key]) return
    try { const result = await api('cloudProject', { lease, projectKey: key }); if (store.getSnapshot().lease === lease) setDetails(old => ({ ...old, [key]: result })) }
    catch { if (store.getSnapshot().lease === lease) setDetails(old => ({ ...old, [key]: { state: 'unavailable' } })) }
  }
  const entries = (project: any = null) => conversationEntries({ cloudRows: project ? details[project.projectKey]?.conversations ?? [] : state.rows,
    bindings: state.conversations, workspaceBindings: state.bindings, workspaces, sessions, archived, project })
  const chatRow = (entry: any) => {
    const selected = panel === 'ecnu-cloud' ? state.route?.kind === 'conversation' && state.route.row.conversationID === entry.cloud?.conversationID : entry.sessionID === currentSession
    return <ConversationRow key={entry.key} entry={entry} compact selected={selected}
      open={(row: any) => row.kind === 'cloud' ? store.go('conversation', row.cloud) : store.go('local', row)}
      original={(row: any) => store.go('conversation', row, { original: true })} />
  }
  const recentChats = entries().slice(0, previewLimit)
  const previewProjects = state.projects.filter((row: any) => row.projectID).slice(0, previewLimit)
  return <div className="ecnu-workspace-flow" data-sidebar-workspace-flow={wide ? 'outer' : undefined}><style>{navigationStyles}</style>{children}{wide && <nav className="ecnu-nav" aria-label="ChatECNU 会话与项目">
    <div className="ecnu-nav-heading"><button className="ecnu-nav-disclosure" aria-label="ChatECNU" aria-expanded={open} aria-controls="ecnu-cloud-sidebar-content" onClick={toggle}><span className="ecnu-nav-leading"><IconGlobeOutlineRegular size={16} className="ecnu-nav-globe" /><IconChevronRightOutlineRegular size={13} className="ecnu-nav-chevron" /></span><span className="ecnu-nav-label">ChatECNU</span></button>
      {open && <IconButton label="刷新侧栏云端内容" disabled={state.busy} onClick={() => void store.refresh()}><IconRefreshOutlineRegular size={14} /></IconButton>}</div>
    {open && <div id="ecnu-cloud-sidebar-content" className="ecnu-nav-content">
      {state.busy && !state.lease && <p className="ecnu-nav-note" role="status">正在读取…</p>}
      {state.error && <p className="ecnu-nav-note" role="status">{state.error}</p>}
      {state.lease && <><PreviewHeading title="会话" hint={recentChats.length ? `最近 ${recentChats.length} 条` : ''} expanded={sections.chats} toggle={() => setSections(v => ({ ...v, chats: !v.chats }))} allLabel="查看全部会话" openAll={() => store.go('home')} />
        {sections.chats && <div className="ecnu-nav-section-body">{recentChats.map(chatRow)}</div>}
        <PreviewHeading title="项目" hint={previewProjects.length ? `预览 ${previewProjects.length} 项` : ''} expanded={sections.projects} toggle={() => setSections(v => ({ ...v, projects: !v.projects }))} allLabel="查看全部项目" openAll={() => store.go('home', undefined, { tab: 'projects' })} />
        {sections.projects && <div className="ecnu-nav-section-body">{state.projectError && <p className="ecnu-nav-note">{state.projectError}</p>}
          {previewProjects.map((project: any) => {
            const status = projectStatus(project, state.bindings, workspaces)
            const projectChats = entries(project), shownChats = projectChats.slice(0, previewLimit)
            return <div key={project.projectKey} className="ecnu-nav-project" data-project-status={status.kind}><div className="ecnu-nav-project-head"><button className="ecnu-cloud-icon" aria-label={`展开项目 ${project.title}`} aria-expanded={!!expanded[project.projectKey]} onClick={() => void expand(project)}><IconChevronRightOutlineRegular size={13} /></button>
              <Tooltip label={status.label} side="right" delayMs={350} portal><button className="ecnu-nav-row" aria-label={project.title} aria-current={panel === 'ecnu-cloud' && state.route?.kind === 'project' && state.route.row.projectKey === project.projectKey ? 'page' : undefined} onClick={() => store.go('project', project)}><span className="ecnu-nav-label">{project.title}</span><ProjectStatusIcon status={status} size={14} /></button></Tooltip></div>
              {expanded[project.projectKey] && <div className="ecnu-nav-project-chats">
                {!details[project.projectKey] ? <p className="ecnu-nav-note">正在读取…</p> : details[project.projectKey].state !== 'available' ? <p className="ecnu-nav-note">读取失败，请打开项目重试。</p> : null}
                {details[project.projectKey]?.state === 'available' && shownChats.length > 0 && <div className="ecnu-nav-preview-note">{projectChats.length > previewLimit ? `最近 ${shownChats.length} 条会话` : `${shownChats.length} 条会话`}</div>}
                {shownChats.map(chatRow)}
                <button className="ecnu-nav-more" aria-label={`查看 ${project.title} 的全部会话与资料`} onClick={() => store.go('project', project)}>查看全部会话与资料</button>
              </div>}
            </div>
          })}</div>}
      </>}
    </div>}
  </nav>}</div>
}

// Local workspace and session rows always remain native. Only add provenance
// actions; cloud rows never replace or hide the workspace that owns the work.
export function CloudWorkspaceLink({ workspaceID, store }: any) {
  const state = useCloud(store), binding = state.bindings.find((b: any) => b.workspaceID === workspaceID)
  if (!binding) return null
  const project = state.projects.find((p: any) => p.projectKey === binding.projectKey)
  return <IconButton label={`已关联 ChatECNU 项目「${binding.title}」，查看云端会话和资料`} onClick={() => store.go(project ? 'project' : 'home', project, { tab: 'projects' })}><IconLinkOutlineRegular size={14} /></IconButton>
}
export function CloudSessionOrigin({ sessionId, store, useSessions }: any) {
  const state = useCloud(store), sessions = useSessions((s: any) => s.byId), binding = state.conversations.find((b: any) => b.sessionID === sessionId)
  if (!binding) return null
  const row = { conversationID: binding.conversationID, title: sessions[sessionId]?.title || 'ChatECNU 会话', projectID: binding.projectID }
  return <IconButton label="来自 ChatECNU，查看云端原会话" onClick={() => store.go('conversation', row, { original: true })}><IconGlobeOutlineRegular size={14} /></IconButton>
}
export function ProjectContext({ sessionId, useWorkspaces, store }: any) {
  const state = useCloud(store), workspaces = useWorkspaces((s: any) => s.items)
  const workspace = workspaces.find((w: any) => w.sessionIds.includes(sessionId)), binding = state.bindings.find((b: any) => b.workspaceID === workspace?.workspaceId)
  if (!binding) return null
  const project = state.projects.find((p: any) => p.projectKey === binding.projectKey)
  return <Tooltip label="此工作区可检索关联的 ChatECNU 项目资料，点击查看" side="bottom" delayMs={350} portal><button className="ecnu-project-context" onClick={() => store.go(project ? 'project' : 'home', project, { tab: 'projects' })}><IconLinkOutlineRegular size={14} />{binding.title}</button></Tooltip>
}
export const navigationStyles = `
.ecnu-workspace-flow{display:contents}
.ecnu-nav{padding:6px 0 10px;font-size:inherit;flex:none;color:var(--dsw-alias-label-primary)}
.ecnu-nav-heading{display:flex;align-items:center;gap:4px}.ecnu-nav-disclosure{display:flex;align-items:center;gap:var(--dsh-sidebar-label-gap,6px);flex:1;min-width:0;box-sizing:border-box;height:32px;border:0;border-inline:var(--dsh-sidebar-paint-inset,3px) solid transparent;background:none;background-clip:padding-box;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;padding:0 8px;padding-inline-start:calc(var(--dsh-sidebar-row-padding,12px) - var(--dsh-sidebar-paint-inset,3px));border-radius:var(--dsw-radius-md,8px);cursor:pointer}
.ecnu-nav-leading{display:inline-flex;align-items:center;justify-content:center;width:16px;height:20px;flex:none}.ecnu-nav-chevron{display:none}.ecnu-nav-disclosure[aria-expanded="true"] .ecnu-nav-chevron{transform:rotate(90deg)}.ecnu-nav-disclosure:focus-visible .ecnu-nav-globe{display:none}.ecnu-nav-disclosure:focus-visible .ecnu-nav-chevron{display:block}@media(hover:hover){.ecnu-nav-disclosure:hover .ecnu-nav-globe{display:none}.ecnu-nav-disclosure:hover .ecnu-nav-chevron{display:block}}
.ecnu-nav-content{padding:2px 0 4px}.ecnu-nav-section-heading{display:flex;align-items:center;gap:2px}.ecnu-nav-section-heading>.ecnu-nav-section{flex:1;min-width:0}.ecnu-nav-section{display:flex;align-items:center;gap:5px;background:none;border:0;color:var(--dsw-alias-label-secondary);text-align:left;font-size:12px;padding:7px 8px;cursor:pointer;white-space:nowrap}.ecnu-nav-section-body{padding-left:7px}.ecnu-nav-preview-count{font-size:12px;margin-left:3px}.ecnu-nav-all{flex:none;min-height:28px;padding:4px 6px;border:0;border-radius:5px;background:none;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;white-space:nowrap;cursor:pointer}.ecnu-nav-all:hover{background:var(--dsw-alias-interactive-bg-hover,#8881);text-decoration:underline;text-underline-offset:3px}.ecnu-nav-preview-note{padding:5px 8px 2px;font-size:12px;color:var(--dsw-alias-label-secondary)}
.ecnu-nav button[aria-expanded="true"]>svg:first-child{transform:rotate(90deg)}.ecnu-nav-row{display:flex;width:100%;align-items:center;gap:7px;border:0;background:transparent;color:inherit;padding:7px 8px;text-align:left;border-radius:7px;cursor:pointer;min-width:0;font:inherit}
.ecnu-nav-row[aria-current="page"],.ecnu-nav-row:hover,.ecnu-nav-more:hover,.ecnu-nav-disclosure:hover,.ecnu-cloud-icon:hover{background:var(--dsw-alias-interactive-bg-hover,#8881)}.ecnu-nav-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}.ecnu-nav-more{border:0;background:none;color:var(--dsw-alias-label-secondary);font-size:12px;padding:7px 8px;cursor:pointer;border-radius:6px}
.ecnu-nav-note{font-size:12px;color:var(--dsw-alias-label-secondary);padding:0 8px;line-height:1.6}.ecnu-nav-project-head{display:flex;align-items:center}.ecnu-cloud-icon{display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:5px;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;width:26px;height:28px;flex:none;padding:0}.ecnu-cloud-icon:disabled{opacity:.45;cursor:default}.ecnu-nav-project-chats{margin-left:16px;padding-left:6px;border-left:1px solid var(--dsw-alias-border-l2,#8883)}
.ecnu-nav-chat{display:flex;align-items:center}.ecnu-nav-chat>.ecnu-nav-row{flex:1}.ecnu-nav-project-head>.ecnu-nav-row{flex:1}
.ecnu-nav button:focus-visible,.ecnu-cloud-icon:focus-visible,.ecnu-project-context:focus-visible{outline:2px solid currentColor;outline-offset:1px}.ecnu-project-context{display:inline-flex;align-items:center;gap:5px;font-size:12px;background:transparent;border:1px solid var(--dsw-alias-border-l2,#8883);border-radius:7px;color:inherit;padding:4px 8px;cursor:pointer}
`
