import React, { useEffect, useRef, useState } from 'react'
import { Button, IconFolderOpenOutlineRegular, IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { workspaceDisplayTitle } from '@deepseek-ai/dsh-api-workspace-controller/default-workspace'

const messages: Record<string, string> = {
  workspace_already_linked: '这个工作区已关联其他云端项目，请选择另一个或新建工作区。',
  project_already_linked: '这个项目已经关联工作区，请刷新关联状态后打开。',
  missing_workspace: '关联的工作区已移除。可先解除关联，再选择工作区。',
  missing_directory: '工作区目录暂不可用。请恢复目录，或解除关联后重新选择。',
  account_changed: '学校账号已变化，请重新打开项目。', permission_denied: '当前账号暂时无法读取这个项目。',
  rate_limited: '项目查询较多，请稍后重试。',
}
const errorText = (state: string) => messages[state] ?? '暂未完成关联，请重试。已创建的本地工作区会保留。'
export function ProjectWorkspace({ project, lease, api, openWorkspace, renderFactorySlot, useWorkspaces }: any) {
  const workspaces = useWorkspaces((state: any) => state.items)
  const [binding, setBinding] = useState<any>(null), [busy, setBusy] = useState(false), [picker, setPicker] = useState(false), [error, setError] = useState('')
  const active = useRef(true), request = useRef<AbortController | null>(null), anchor = useRef<HTMLButtonElement>(null)
  const current = (controller: AbortController) => active.current && request.current === controller && !controller.signal.aborted
  const input = { lease, projectKey: project.projectKey }
  async function refresh() {
    const controller = new AbortController(); request.current?.abort(); request.current = controller
    setError('')
    try { const value = await api('cloudWorkspaceState', input, controller.signal); if (current(controller)) { if (value.state !== 'available') setError(errorText(value.state)); else setBinding(value) } }
    catch { if (current(controller)) setError(errorText('unavailable')) }
  }
  useEffect(() => { active.current = true; void refresh(); return () => { active.current = false; request.current?.abort() } }, [])
  async function connect(workspaceID: string) {
    setPicker(false); setBusy(true); setError('')
    const controller = new AbortController(); request.current?.abort(); request.current = controller
    try {
      const value = await api('cloudWorkspaceConnect', { ...input, workspaceID }, controller.signal)
      if (!current(controller)) return
      if (value.state !== 'available') { setError(errorText(value.state)); return }
      setBinding(value)
      await openWorkspace(value.workspaceID, () => current(controller))
    } catch { if (current(controller)) setError(errorText('unavailable')) }
    finally { if (current(controller)) setBusy(false) }
  }
  async function disconnect() {
    setBusy(true); setError('')
    const controller = new AbortController(); request.current?.abort(); request.current = controller
    try { const value = await api('cloudWorkspaceDisconnect', { ...input, workspaceID: binding.workspaceID }, controller.signal); if (current(controller)) { if (value.state !== 'available') setError(errorText(value.state)); else setBinding(value) } }
    catch { if (current(controller)) setError(errorText('unavailable')) }
    finally { if (current(controller)) setBusy(false) }
  }
  async function open() {
    const controller = new AbortController(); request.current?.abort(); request.current = controller
    setBusy(true); setError('')
    try { await openWorkspace(binding.workspaceID, () => current(controller)) } catch { if (current(controller)) setError('暂时无法打开本地工作区，请检查目录后重试。') }
    finally { if (current(controller)) setBusy(false) }
  }
  const bound = binding?.bindingState === 'available', stale = binding?.workspaceID && !bound
  const workspace = workspaces.find((item: any) => item.workspaceId === binding?.workspaceID)
  return <section className="ecnu-project-workspace" aria-label="项目工作区">
    <div className="ecnu-project-workspace-main"><span className="ecnu-folder">{bound ? <IconCheckOutlineRegular size={21} /> : <IconFolderOpenOutlineRegular size={22} />}</span>
      <div className="ecnu-project-workspace-copy"><strong>{bound ? `已关联 ${workspace ? workspaceDisplayTitle(workspace.title, '默认工作区') : '本地工作区'}` : '在本地开展这个项目'}</strong>
        <p>{bound ? '工作区内已启用本项目的知识库检索与资料读取。' : '创建或选择工作区，其中的会话会自动获得本项目的只读检索能力。'}</p></div>
      {bound ? <Button variant="primary" className="ecnu-continue-primary" disabled={busy} onClick={() => void open()}>打开工作区</Button>
        : !stale && <Button ref={anchor} variant="primary" className="ecnu-continue-primary" disabled={busy || !binding} aria-haspopup="menu" aria-expanded={picker} onClick={() => setPicker(true)}>{busy ? '正在关联…' : '创建项目工作区'}</Button>}
    </div>
    {renderFactorySlot('workspace.picker', { open: picker, anchorRef: anchor, selectedId: binding?.workspaceID, onPick: (id: string) => { if (!busy) void connect(id) }, onClose: () => setPicker(false) })}
    <div className="ecnu-project-workspace-foot"><span>云端资料按需读取，任务和产物保存在本地工作区。</span>{binding?.workspaceID && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void disconnect()}>解除关联</Button>}</div>
    {stale && <p role="alert" className="ecnu-notice">{errorText(binding.bindingState)}</p>}
    {error && <p role="alert" className="ecnu-notice">{error}<Button variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}>刷新关联状态</Button></p>}
  </section>
}

/** Local grants stay manageable even after the cloud project is no longer visible. */
export function WorkspaceBindings({ lease, api, useWorkspaces, changed }: any) {
  const workspaces = useWorkspaces((state: any) => state.items)
  const [bindings, setBindings] = useState<any[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const request = useRef<AbortController | null>(null)
  async function refresh() {
    const controller = new AbortController(); request.current?.abort(); request.current = controller
    setBusy(true); setError('')
    try {
      const value = await api('cloudWorkspaceBindings', { lease }, controller.signal)
      if (controller.signal.aborted) return
      if (value.state !== 'available') setError('暂时无法读取本地关联，可稍后重试。')
      else setBindings(value.bindings)
    } catch { if (!controller.signal.aborted) setError('暂时无法读取本地关联，可稍后重试。') }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  useEffect(() => { void refresh(); return () => { request.current?.abort() } }, [lease])
  async function disconnect(row: any) {
    const controller = new AbortController(); request.current?.abort(); request.current = controller
    setBusy(true); setError('')
    try {
      const value = await api('cloudWorkspaceDisconnect', { lease, projectKey: row.projectKey, workspaceID: row.workspaceID }, controller.signal)
      if (controller.signal.aborted) return
      if (value.state !== 'available') setError(errorText(value.state))
      else { setBindings(old => old.filter(item => item !== row)); changed?.() }
    } catch { if (!controller.signal.aborted) setError(errorText('unavailable')) }
    finally { if (!controller.signal.aborted) setBusy(false) }
  }
  if (!bindings.length && !error) return null
  return <details className="ecnu-local-bindings"><summary>已关联工作区{bindings.length ? ` · ${bindings.length}` : ''}</summary>
    <p className="ecnu-caption">解除关联仅停止此工作区的项目检索，保留本地任务和文件。</p>
    {bindings.map(row => { const workspace = workspaces.find((item: any) => item.workspaceId === row.workspaceID); return <div className="ecnu-project-workspace-foot" key={row.workspaceID}>
      <span>{row.title} · {workspace ? workspaceDisplayTitle(workspace.title, '默认工作区') : '已移除的工作区'}</span>
      <Button variant="ghost" size="sm" disabled={busy} aria-label={`解除 ${row.title} 的工作区关联`} onClick={() => void disconnect(row)}>解除关联</Button>
    </div> })}
    {error && <p role="alert" className="ecnu-notice">{error}<Button variant="ghost" size="sm" disabled={busy} onClick={() => void refresh()}>重试</Button></p>}
  </details>
}
