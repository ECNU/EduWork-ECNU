import { conversationEntries } from './conversation-entries.js'
import { ConversationRow } from './conversation-row.js'
import { projectStatus, ProjectStatusIcon } from './project-status.js'
import React, { useEffect, useRef, useState } from 'react'
import { Button, Tooltip, Input, FileTypeIcon, IconGlobeOutlineRegular, IconSearchOutlineRegular, IconChevronRightOutlineRegular, IconRefreshOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import contribution from '../lib/typert.remote-client.js'
import { Continuation } from './continuation.js'
import { WorkspaceBindings } from './project-workspace.js'
import { Transcript, ReadOnlyMarkdown } from './reader.js'
import { styles } from './styles.js'
import { createCloudNavigation, useCloud, CloudSidebar, CloudWorkspaceLink, CloudSessionOrigin, ProjectContext } from './navigation.js'

const errors: Record<string, string> = {
  not_connected: '请先在左下角登录学校账号。', sign_in_required: '请先在左下角登录学校账号。',
  identity_unavailable: '当前登录组件尚不支持云端会话，请更新组件。', permission_denied: '当前学校账号暂时无法读取这项内容。',
  account_changed: '登录状态已变化，请刷新后重试。', not_configured: '云端服务尚未配置。', rate_limited: '请求较多，请稍后重试。',
  too_large: '内容超过当前可读取的范围。', history_changed: '云端内容已更新，请重新打开。',
  timeout: '读取超时，请稍后重试。', cancelled: '读取已取消，可以重新打开。',
}
export const errorText = (state: string) => errors[state] ?? '暂时无法读取，请稍后重试。'
function group(at: number) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const days = Math.floor((now.getTime() - at) / 86400000)
  return days < 0 ? '今天' : days < 1 ? '昨天' : days < 7 ? '近 7 天' : '更早'
}
function Loading() { return <div role="status" aria-label="正在读取" className="ecnu-skeleton">{Array.from({ length: 6 }, (_, i) => <div key={i} className="ecnu-skeleton-line" />)}</div> }
function Tabs({ value, onChange, items, label }: any) {
  return <div className="ecnu-tabs" role="tablist" aria-label={label}>{items.map(([id, name]: string[], index: number) => <button key={id} className="ecnu-tab" role="tab" aria-selected={value === id} tabIndex={value === id ? 0 : -1}
    id={`ecnu-tab-${label}-${id}`} aria-controls={`ecnu-panel-${label}`} onClick={() => onChange(id)} onKeyDown={e => {
      const next = e.key === 'ArrowRight' ? (index + 1) % items.length : e.key === 'ArrowLeft' ? (index + items.length - 1) % items.length : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1
      if (next >= 0) { e.preventDefault(); onChange(items[next][0]); (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus() }
    }}>{name}</button>)}</div>
}
function ConversationList({ rows, open, original, grouped = false }: any) {
  let last = ''
  return <ul className="ecnu-list" aria-label="会话列表">{rows.map((entry: any) => {
    const label = grouped ? group(entry.updatedAt) : '', show = label !== last; last = label
    return <li key={entry.key}>{show && <div className="ecnu-group-label">{label}</div>}<ConversationRow {...{ entry, open, original }} /></li>
  })}</ul>
}
export function CloudPage({ api, watch, openSession, openWorkspace, sendSession, createSession, changed, useNavigation = () => null, useCloudState = () => null, renderFactorySlot, useWorkspaces, useSessions }: any) {
  const route = useNavigation(), routed = useRef(0)
  const cloudState = useCloudState()
  const archivedSessions = useWorkspaces((s: any) => s.archivedSessionIds)
  const localWorkspaces = useWorkspaces((s: any) => s.items), localSessions = useSessions ? useSessions((s: any) => s.byId) : {}
  const [list, setList] = useState<any>(null), [preview, setPreview] = useState<any>(null), [projectList, setProjectList] = useState<any>(null)
  const [detail, setDetail] = useState<any>(null), [source, setSource] = useState<any>(null), [view, setView] = useState<any>({ kind: 'home' })
  const [busy, setBusy] = useState(false), [reading, setReading] = useState(false), [projectsBusy, setProjectsBusy] = useState(false)
  const [tab, setTab] = useState('recent'), [projectTab, setProjectTab] = useState('conversations'), [query, setQuery] = useState('')
  const [error, setError] = useState(''), [projectError, setProjectError] = useState('')
  const generation = useRef(0), selection = useRef(0), projectGeneration = useRef(0), lease = useRef<string | null>(null), heading = useRef<HTMLHeadingElement>(null)
  const projectRequest = useRef<AbortController | null>(null), detailRequest = useRef<AbortController | null>(null)
  const cancelReads = () => { projectRequest.current?.abort(); detailRequest.current?.abort() }
  const projects = projectList?.projects ?? []
  const clear = () => { cancelReads(); ++generation.current; ++selection.current; ++projectGeneration.current; lease.current = null; setList(null); setPreview(null); setDetail(null); setSource(null); setProjectList(null); setView({ kind: 'home' }); setQuery(''); setError(''); setProjectError(''); setBusy(false); setReading(false); setProjectsBusy(false) }
  async function loadProjects(currentLease: string, g: number) {
    projectRequest.current?.abort(); const controller = new AbortController(); projectRequest.current = controller
    const pg = ++projectGeneration.current; setProjectsBusy(true); setProjectError('')
    try {
      const value = await api('cloudProjects', { lease: currentLease }, controller.signal)
      if (g !== generation.current || pg !== projectGeneration.current) return
      if (value.state !== 'available') { setProjectError(errorText(value.state)); return }
      setProjectList(value)
    } catch { if (g === generation.current && pg === projectGeneration.current) setProjectError(errorText('unavailable')) }
    finally { if (g === generation.current && pg === projectGeneration.current) setProjectsBusy(false) }
  }
  async function load(page = 1) {
    const g = page === 1 ? ++generation.current : generation.current
    if (page === 1) { cancelReads(); ++projectGeneration.current; ++selection.current; setView({ kind: 'home' }); setPreview(null); setDetail(null); setSource(null); setReading(false); setProjectsBusy(false) }
    setBusy(true); setError('')
    try {
      const state = await api('cloudState')
      if (g !== generation.current) return
      if (state.state !== 'available') { clear(); setError(errorText(state.state)); return }
      if (lease.current !== state.lease) { setList(null); setProjectList(null) }
      lease.current = state.lease
      if (page === 1) void loadProjects(state.lease, g)
      const value = await api('cloudList', { lease: state.lease, page })
      if (g !== generation.current) return
      if (value.state !== 'available') { setError(errorText(value.state)); return }
      setList((old: any) => ({ ...value, items: page === 1 ? value.items : [...new Map([...(old?.items ?? []), ...value.items].map((r: any) => [r.conversationID, r])).values()] }))
    } catch { if (g === generation.current) setError(errorText('unavailable')) }
    finally { if (g === generation.current) setBusy(false) }
  }
  async function select(row: any, original = false) {
    detailRequest.current?.abort()
    const project = row.projectID && projects.find((p: any) => p.projectID === row.projectID)
    const s = ++selection.current, g = generation.current, parent = project ? { kind: 'project', row: project } : { kind: 'home' }
    setView({ kind: 'conversation', row, parent }); setPreview(null); setReading(true); setError('')
    try {
      const input = { lease: lease.current, conversationID: row.conversationID }, destination = await api('cloudDestination', input)
      if (s !== selection.current || g !== generation.current) return
      if (!original && destination?.state === 'available' && destination.bindingState === 'available') {
        await openSession(destination.sessionID, () => s === selection.current && g === generation.current); return
      }
      const value = await api('cloudPreview', input)
      if (s !== selection.current || g !== generation.current) return
      if (value.state !== 'available') { setError(errorText(value.state)); return }
      setPreview(value)
    } catch { if (s === selection.current && g === generation.current) setError(errorText('unavailable')) }
    finally { if (s === selection.current && g === generation.current) setReading(false) }
  }
  async function selectProject(row: any) {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller
    const s = ++selection.current, g = generation.current
    setView({ kind: 'project', row }); setDetail(null); setProjectTab('conversations'); setReading(true); setError('')
    try {
      const value = await api('cloudProject', { lease: lease.current, projectKey: row.projectKey }, controller.signal)
      if (s !== selection.current || g !== generation.current) return
      if (value.state !== 'available') { setError(errorText(value.state)); return }
      setDetail(value)
    } catch { if (s === selection.current && g === generation.current) setError(errorText('unavailable')) }
    finally { if (s === selection.current && g === generation.current) setReading(false) }
  }
  async function selectSource(row: any) {
    detailRequest.current?.abort(); const controller = new AbortController(); detailRequest.current = controller
    const s = ++selection.current, g = generation.current, parent = view
    setView({ kind: 'source', row, parent }); setSource(null); setReading(true); setError('')
    try {
      const value = await api('cloudSource', { lease: lease.current, projectKey: parent.row.projectKey, sourceID: row.sourceID }, controller.signal)
      if (s !== selection.current || g !== generation.current) return
      if (value.state !== 'available') { setError(errorText(value.state)); return }
      setSource(value)
    } catch { if (s === selection.current && g === generation.current) setError(errorText('unavailable')) }
    finally { if (s === selection.current && g === generation.current) setReading(false) }
  }
  function back() { detailRequest.current?.abort(); ++selection.current; setPreview(null); setSource(null); setReading(false); setError(''); if (view.parent?.kind === 'project') void selectProject(view.parent.row); else setView({ kind: 'home' }) }
  useEffect(() => {
    let active = true, checks = 0; void load()
    const stop = watch(async (reset: boolean) => {
      const check = ++checks
      if (reset) { clear(); void load(); return }
      try {
        const state = await api('cloudState')
        if (!active || check !== checks) return
        if (state.state !== 'available' || state.lease !== lease.current) { clear(); void load() }
      } catch { if (active && check === checks) { clear(); setError(errorText('unavailable')) } }
    })
    return () => { active = false; cancelReads(); ++generation.current; ++selection.current; ++projectGeneration.current; stop() }
  }, [api, watch])
  useEffect(() => { heading.current?.focus({ preventScroll: true }) }, [view.kind, view.row?.conversationID, view.row?.projectKey, view.row?.sourceID])
  useEffect(() => {
    if (!route || !lease.current || route.seq === routed.current || route.lease !== lease.current) return
    routed.current = route.seq
    if (route.kind === 'conversation') void select(route.row, route.original)
    else if (route.kind === 'project') void selectProject(route.row)
    else if (route.kind === 'local') void openEntry(route.row)
    else { setView({ kind: 'home' }); setTab(route.tab ?? 'recent'); setQuery('') }
  }, [route, list, busy])
  const matches = (value: string) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  const navigation = cloudState?.lease === lease.current ? cloudState : null
  const entries = (cloudRows: any[], project: any = null, workspaceID?: string) => conversationEntries({ cloudRows,
    bindings: navigation?.conversations, workspaceBindings: navigation?.bindings, workspaces: localWorkspaces,
    sessions: localSessions, archived: archivedSessions, project, workspaceID })
  const rows = lease.current ? entries(list?.items ?? []).filter((row: any) => matches(row.title)) : []
  const projectRows = view.kind === 'project' ? entries(detail?.conversations ?? [], view.row, detail?.workspaceID) : []
  async function openEntry(entry: any) {
    if (entry.kind === 'cloud') { await select(entry.cloud); return }
    const g = generation.current, s = ++selection.current
    const workspace = localWorkspaces.find((w: any) => w.workspaceId === entry.workspaceID)
    if (entry.kind === 'continued' && !navigation?.conversations.some((row: any) => row.conversationID === entry.cloud.conversationID && row.sessionID === entry.sessionID && row.workspaceID === entry.workspaceID)) { setError('会话关联已变化，请刷新列表。'); return }
    if (!workspace?.sessionIds.includes(entry.sessionID) || archivedSessions.includes(entry.sessionID) || !localSessions[entry.sessionID] || localSessions[entry.sessionID].blank) { setError('这条本地会话已移动或归档，请刷新列表。'); return }
    try { await openSession(entry.sessionID, () => g === generation.current && s === selection.current) }
    catch { if (g === generation.current && s === selection.current) setError('暂时无法打开本地会话，请稍后重试。') }
  }
  const listProps = { open: openEntry, original: (row: any) => void select(row, true) }
  const filteredProjects = projects.filter((row: any) => matches(row.title))
  const statusFor = (row: any) => projectStatus(row, navigation?.bindings, localWorkspaces)
  return <section className="ecnu-cloud" aria-label="ChatECNU 云端"><style>{styles}</style>
    {view.kind !== 'home' && <header className="ecnu-topbar"><Button variant="ghost" size="sm" className="ecnu-back" aria-label={view.parent?.kind === 'project' ? '返回项目' : '返回云端列表'} onClick={back}><IconChevronRightOutlineRegular size={18} /></Button><h1 ref={heading} tabIndex={-1}>{view.row.title}</h1><Tooltip label="正在预览 ChatECNU 云端内容；首次发送时在本地接续" side="bottom" delayMs={350} portal><span className="ecnu-caption" tabIndex={0} aria-label="ChatECNU 云端预览" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconGlobeOutlineRegular size={14} />ChatECNU</span></Tooltip></header>}
    {error && (view.kind !== 'home' || tab === 'recent' || !lease.current) && <div role="alert" className="ecnu-error">{error}<Button variant="ghost" size="sm" onClick={() => void load()}>重新读取</Button></div>}
    <div className="ecnu-scroll" key={view.kind + (view.row?.conversationID ?? view.row?.sourceID ?? view.row?.projectKey ?? '')}>
      {view.kind === 'home' && <div className="ecnu-home"><div className="ecnu-home-heading"><div><h1 ref={heading} tabIndex={-1}>{tab === 'recent' ? '会话' : '项目'}</h1><p className="ecnu-subtitle">{tab === 'recent' ? 'ChatECNU 与本地工作区的会话。' : '查看 ChatECNU 项目、资料和关联工作区。'}</p></div><Button variant="ghost" size="sm" aria-label="刷新云端内容" disabled={busy || projectsBusy} onClick={() => void load()}><IconRefreshOutlineRegular size={17} /></Button></div>
        <div className="ecnu-toolbar"><Input className="ecnu-search" icon={<IconSearchOutlineRegular size={16} />} aria-label={tab === 'recent' ? '筛选已加载的会话' : '搜索项目'} placeholder={tab === 'recent' ? '查找会话' : '查找项目'} value={query} onChange={e => setQuery(e.target.value)} /></div>
        <div role="region" aria-label={tab === 'recent' ? '全部会话' : '全部项目'}>
        {tab === 'recent' ? <>{busy && !list ? <Loading /> : <ConversationList rows={rows} {...listProps} grouped />}
          {!busy && !rows.length && <div className="ecnu-empty"><strong>{query ? '没有匹配的会话' : '还没有会话'}</strong>{query ? '试试其他标题关键词。' : 'ChatECNU 普通会话和默认工作区的本地会话会出现在这里。'}</div>}
          {query && list?.hasMore && <p className="ecnu-caption">正在筛选已加载的会话，可继续加载更早记录。</p>}
          {list?.hasMore && <div className="ecnu-loadmore"><Button variant="ghost" disabled={busy} onClick={() => void load(list.page + 1)}>{busy ? '正在读取…' : '加载更早的会话'}</Button></div>}</>
          : <>{projectsBusy && !projectList ? <Loading /> : <>{projectError && <p role="alert" className="ecnu-notice">{projectError}</p>}{projectList?.incomplete && <p className="ecnu-notice">部分项目会话的关联暂未读取完整，可刷新后重试。资料仍按当前账号权限读取。</p>}
            {[true, false].map(linked => { const items = filteredProjects.filter((p: any) => !!p.projectID === linked); return items.length ? <div key={String(linked)}><div className="ecnu-group-label">{linked ? '项目' : '其他资料库'}</div><ul className="ecnu-list">{items.map((row: any) => { const status = statusFor(row); return <li key={row.projectKey}><Tooltip label={status.label} side="top" delayMs={350} portal><button className="ecnu-row" data-project-status={status.kind} aria-label={row.title} onClick={() => void selectProject(row)}><span className="ecnu-project-status"><ProjectStatusIcon status={status} size={20} /></span><span className="ecnu-row-body"><span className="ecnu-row-title">{row.title}</span><span className="ecnu-row-meta">{row.projectID ? '云端知识库' : '查看云端资料'}{row.shared ? ' · 已共享' : ''}</span></span><span className="ecnu-row-end"><IconChevronRightOutlineRegular size={15} /></span></button></Tooltip></li> })}</ul></div> : null })}
            {!projectError && !filteredProjects.length && <div className="ecnu-empty">{query ? '没有匹配的项目' : '还没有可读取的项目'}</div>}</>}
            {lease.current && <WorkspaceBindings key={lease.current + ':' + generation.current} lease={lease.current} {...{ api, useWorkspaces, changed }} />}
          </>}
        </div>
      </div>}
      {view.kind === 'conversation' && (reading ? <div className="ecnu-transcript"><Loading /></div> : preview && <Transcript preview={preview} />)}
      {view.kind === 'project' && <div className="ecnu-home"><div className="ecnu-project-title"><Tooltip label={statusFor(view.row).label} side="top" delayMs={350} portal><span className="ecnu-project-status" data-project-status={statusFor(view.row).kind} tabIndex={0} aria-label={statusFor(view.row).label}><ProjectStatusIcon status={statusFor(view.row)} size={24} /></span></Tooltip><div><h1>{view.row.title}</h1><p className="ecnu-subtitle">{view.row.description || '以云端知识库为基础，在本地工作区开展工作。'}</p></div></div>
        <p className="ecnu-project-binding">{detail?.workspaceID ? `已关联本地工作区 · 云端资料可检索` : '当前为云端预览。首次发送时设置本地项目工作区。'}</p>
        <Tabs value={projectTab} onChange={setProjectTab} items={[["conversations", '会话'], ["sources", `云端资料${detail ? ' ' + detail.sources.length : ''}`]]} label="项目内容" />
        <div role="tabpanel" id="ecnu-panel-项目内容" aria-labelledby={`ecnu-tab-项目内容-${projectTab}`}>
        {reading ? <Loading /> : detail && (projectTab === 'conversations' ? <><ConversationList rows={projectRows} {...listProps} />{!projectRows.length && <div className="ecnu-empty">{view.row.projectID ? '这个项目还没有会话，可以在下面开始。' : '暂未发现关联的项目会话，仍可查看资料。'}</div>}</>
          : <><ul className="ecnu-list">{detail.sources.map((row: any) => <li key={row.sourceID}><button className="ecnu-row" onClick={() => void selectSource(row)}><span className="ecnu-folder"><FileTypeIcon path={row.title} size={23} /></span><span className="ecnu-row-body"><span className="ecnu-row-title">{row.title}</span><span className="ecnu-row-meta">{row.type === 'file' ? '文件' : row.type || '资料'}</span></span><span className="ecnu-row-end"><span className="ecnu-status">{row.status === 'ready' ? '已就绪' : row.status === 'processing' ? '处理中' : row.status}</span><IconChevronRightOutlineRegular size={15} /></span></button></li>)}</ul>{!detail.sources.length && <div className="ecnu-empty">这个项目还没有资料</div>}</>)}
        </div></div>}
      {view.kind === 'source' && (reading ? <div className="ecnu-source-body"><Loading /></div> : source && (source.empty ? <div className="ecnu-source-empty"><h2>暂时无法读取正文</h2><p>云端已收录这份资料，但目前没有返回可阅读的正文。你可以稍后重试，或返回项目查看其他资料。</p><Button variant="outline" onClick={back}>返回项目资料</Button></div> : <div className="ecnu-source-body">{source.truncated && <p className="ecnu-notice">内容较长，当前展示前 200,000 字符。</p>}<ReadOnlyMarkdown text={source.text} /></div>))}
    </div>
    {view.kind === 'conversation' && preview && <Continuation key={preview.lease + ':' + preview.summary.conversationID + ':' + preview.snapshot} project={projects.find((p: any) => p.projectID === preview.summary.projectID && p.projectID)} {...{ preview, api, openSession, sendSession, createSession, changed, renderFactorySlot, useWorkspaces }} />}
    {view.kind === 'project' && detail && <Continuation key={lease.current + ':' + view.row.projectKey} project={view.row} preview={{ lease: lease.current, summary: { projectID: view.row.projectID }, importable: true }} {...{ api, sendSession, createSession, changed, renderFactorySlot, useWorkspaces }} />}
  </section>
}
export const inject = ['slots', 'remote', 'layout', 'sessions', 'uiWorkspace', 'conversation']
export async function apply(ctx: any) {
  const unmount = await ctx.remote.$mount(contribution)
  const ui = ctx.inject(['remote.ecnuCloud'], (inner: any) => {
    const api = async (method: string, input?: any, signal?: AbortSignal) => { const result = await inner.remote.ecnuCloud[method](...(input ? [input] : []), ...(signal ? [signal] : [])); if (!result.ok) throw Error('Cloud request failed'); return result.value }
    const watch = (callback: any) => { const off = inner.remote.$on('credentials/reference-updated', () => callback(false)), reset = inner.on('connection/reset', () => callback(true)); return () => { off(); reset() } }
    const openSession = async (sessionID: string, current: () => boolean) => { await inner.sessions.refresh(); if (current()) inner.uiWorkspace.openSession(sessionID) }
    const openWorkspace = async (workspaceID: string, current: () => boolean) => {
      if (current()) await inner.uiWorkspace.openWorkspace(workspaceID, () => { if (!current()) throw Error('Workspace selection expired') })
    }
    const store = createCloudNavigation(api, watch, () => inner.layout.selectPanel('ecnu-cloud'))
    inner.effect(() => () => store.dispose())
    const createSession = async (workspaceID: string, current: () => boolean) => { if (!current()) throw Error('Expired'); return inner.uiWorkspace.connectWorkspace(workspaceID) }
    const sendSession = async (sessionID: string, prompt: string, current: () => boolean, lease: string) => {
      await inner.sessions.refresh()
      await inner.sessions.using(sessionID, { source: 'workspaceOperation' }, async (ref: any) => {
        const identity = await api('cloudState')
        if (!current() || identity.state !== 'available' || identity.lease !== lease) throw Error('Expired')
        const result = inner.conversation.input.requestDraftInitialization(ref.binding, { prompt, whenDraftExists: 'keep' })
        if (result !== 'applied') throw Error('Draft already exists')
        const input = inner.conversation.input.for(ref.binding.ctx)
        inner.uiWorkspace.openSession(sessionID)
        input.submit('queue', 'click')
      })
      void store.refresh()
    }
    const common = () => ({ api, watch, openSession, openWorkspace, sendSession, createSession, changed: () => void store.refresh(), useNavigation: () => useCloud(store).route, useCloudState: () => useCloud(store), store })
    inner.slots.inject('main', () => inner.slots.register({ name: 'main', key: 'ecnu-cloud', inject: common }, CloudPage))
    inner.slots.inject('sidebar.workspaces.content', () => inner.slots.register({ name: 'sidebar.workspaces.content', id: 'ecnu-cloud', inject: common }, CloudSidebar))
    inner.slots.inject('sidebar.workspaces.group.actions', () => inner.slots.register({ name: 'sidebar.workspaces.group.actions', id: 'ecnu-cloud', inject: () => ({ store }) }, CloudWorkspaceLink))
    inner.slots.inject('sidebar.session.row.trailing', () => inner.slots.register({ name: 'sidebar.session.row.trailing', id: 'ecnu-cloud', inject: () => ({ store }) }, CloudSessionOrigin))
    inner.slots.inject('conversation.session.header.actions', () => inner.slots.register({ name: 'conversation.session.header.actions', id: 'ecnu-cloud-project', order: 50, inject: () => ({ store }) }, ProjectContext))
  })
  return async () => { await ui.dispose(); await unmount() }
}
