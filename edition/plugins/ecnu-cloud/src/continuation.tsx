import React, { useEffect, useRef, useState } from 'react'
import { Button, IconChevronDownOutlineRegular, IconFolderOpenOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { workspaceDisplayTitle } from '@deepseek-ai/dsh-api-workspace-controller/default-workspace'
const messages: Record<string, string> = {
  history_changed: '云端历史已更新，请重新打开这段会话。草稿仍保留在此。', unsupported_history: '这段历史暂不能完整导入，可继续阅读。',
  missing_workspace: '原工作区已移除，请先恢复工作区。', missing_directory: '原工作区目录不可用，请先恢复目录。',
  project_missing_workspace: '项目工作区已移除，请先恢复工作区。', project_missing_directory: '项目工作区目录不可用，请先恢复目录。',
  missing_or_moved_session: '本地续聊已移出原工作区，请先恢复其位置。', binding_needs_repair: '本地续聊的关联需要修复，未创建重复会话。',
  project_workspace_mismatch: '这条会话之前接续到了其他工作区，需要先修复项目归属。不会重复导入。',
  project_mapping_unavailable: '项目关联暂未读取完整，请刷新云端项目后重试。', project_unbound: '请先设置此项目唯一的本地工作区。',
  workspace_already_linked: '这个工作区已关联其他项目，请选择另一个或新建工作区。', project_already_linked: '项目已关联其他工作区，请刷新后重试。',
  workspace_changed: '请先恢复上次导入使用的工作区。', account_changed: '学校登录状态已变化，请重新打开会话。',
}
const errorText = (state: string) => messages[state] ?? '暂未完成，请重试。草稿和已保存的历史都会保留。'
export function Continuation({ preview, project, api, sendSession, createSession, changed, renderFactorySlot, useWorkspaces }: any) {
  const workspaces = useWorkspaces((state: any) => state.items)
  const [destination, setDestination] = useState<any>(null), [busy, setBusy] = useState(false), [draft, setDraft] = useState('')
  const [workspaceID, setWorkspaceID] = useState<string | undefined>(), [setup, setSetup] = useState(false)
  const [picker, setPicker] = useState(false), [failure, setFailure] = useState('')
  const anchor = useRef<HTMLButtonElement>(null), active = useRef(true), request = useRef<AbortController | null>(null), lock = useRef(false), created = useRef<string | null>(null)
  const isNew = !preview.summary.conversationID, isProject = !!project || !!preview.summary.projectID
  const projectKey = project?.projectKey ?? destination?.projectKey
  const input = { lease: preview.lease, conversationID: preview.summary.conversationID }
  useEffect(() => {
    active.current = true
    const promise = isNew ? api('cloudWorkspaceState', { lease: preview.lease, projectKey }) : api('cloudDestination', input)
    void promise.then((value: any) => {
      if (!active.current) return
      setDestination(value)
      setWorkspaceID(value.workspaceID ?? (!isProject ? workspaces.find((w: any) => w.title === 'default-workspace')?.workspaceId ?? (workspaces.length === 1 ? workspaces[0].workspaceId : undefined) : undefined))
      if (value.state !== 'available') setFailure(errorText(value.state))
    }).catch(() => { if (active.current) setFailure(errorText('unavailable')) })
    return () => { active.current = false; request.current?.abort() }
  }, [])
  const existing = !isNew && destination?.bindingState === 'available'
  const unboundProject = isProject && ['unbound', 'project_unbound'].includes(destination?.bindingState) && !destination?.workspaceID
  const invalid = destination?.bindingState && !['available', 'unbound', 'project_unbound'].includes(destination.bindingState)
  const selected = workspaces.find((item: any) => item.workspaceId === workspaceID)
  async function submit() {
    if (lock.current || !draft.trim()) return
    if (unboundProject && !setup) { setSetup(true); return }
    if (!selected && !existing) { setSetup(true); setPicker(true); return }
    lock.current = true; setBusy(true); setFailure('')
    const controller = new AbortController(); request.current = controller
    const current = () => active.current && !controller.signal.aborted
    try {
      let target = workspaceID
      if (isProject) {
        const status = await api('cloudWorkspaceState', { lease: preview.lease, projectKey }, controller.signal)
        if (!current()) return
        if (status.state !== 'available') { setFailure(errorText(status.state)); return }
        if (status.bindingState === 'unbound') {
          if (!setup || !target) { setSetup(true); return }
          const linked = await api('cloudWorkspaceConnect', { lease: preview.lease, projectKey, workspaceID: target }, controller.signal)
          if (!current()) return
          if (linked.state !== 'available') { setFailure(errorText(linked.state)); return }
          target = linked.workspaceID; setDestination(linked); setWorkspaceID(target); changed?.()
        } else if (status.bindingState !== 'available') { setFailure(errorText('project_' + status.bindingState)); return }
        else { target = status.workspaceID; setWorkspaceID(target) }
      }
      let result
      if (isNew) {
        if (!created.current) created.current = await createSession(target, current)
        result = { state: 'available', sessionID: created.current, workspaceID: target }
      } else result = await api('cloudImport', { ...input, workspaceID: target, snapshot: preview.snapshot }, controller.signal)
      if (!current()) return
      if (result.state !== 'available') { setFailure(errorText(result.state)); return }
      if (isProject) {
        const grant = await api('cloudWorkspaceState', { lease: preview.lease, projectKey }, controller.signal)
        if (!current()) return
        if (grant.state !== 'available' || grant.bindingState !== 'available' || grant.workspaceID !== target) { setFailure(errorText('project_workspace_mismatch')); return }
      }
      await sendSession(result.sessionID, draft, current, preview.lease)
      if (current()) { setDraft(''); changed?.() }
    } catch { if (current()) setFailure(errorText('unavailable')) }
    finally { lock.current = false; if (active.current) setBusy(false) }
  }
  return <footer className="ecnu-continuation"><div className="ecnu-continuation-inner">
    <div className="ecnu-draft"><textarea aria-label={isNew ? '在项目中新建会话' : '在 EduWork 继续这段对话'} placeholder={isNew ? '基于这个项目，开始手边的工作…' : '继续这段对话…'} rows={2} value={draft} disabled={busy} maxLength={20000} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit() } }} />
      <div className="ecnu-draft-actions"><div className="ecnu-workspace-pick"><IconFolderOpenOutlineRegular size={15} />
        {isProject && !unboundProject ? <span className="ecnu-caption">{project?.title || '项目工作区'} · 云端资料已关联</span> : <Button ref={anchor} variant="ghost" size="sm" disabled={busy || (isProject && !setup)} aria-haspopup="menu" aria-expanded={picker} onClick={() => setPicker(true)} title={selected?.path}>
          {selected ? workspaceDisplayTitle(selected.title, '默认工作区') : isProject ? '首次发送时设置项目工作区' : '选择本地工作区'}<IconChevronDownOutlineRegular size={13} /></Button>}
      </div><Button ref={isProject && !setup ? anchor : undefined} variant="primary" className="ecnu-continue-primary" disabled={busy || !destination || destination.state !== 'available' || invalid || !draft.trim() || !isNew && !preview.importable} onClick={() => void submit()}>{busy ? '正在接续…' : setup ? '确认并发送' : '在 EduWork 发送'}</Button></div>
    </div>
    {setup && <div className="ecnu-setup" role="group" aria-label="首次本地接续设置"><strong>{isProject ? '为项目设置一个本地工作区' : '选择本地保存位置'}</strong><p>{isProject ? '此项目的会话将在同一工作区继续，并可检索云端资料。选择目录不会下载全部资料。' : '后续消息和本地文件将保存在所选工作区。'}</p><Button variant="ghost" size="sm" disabled={busy} onClick={() => setPicker(true)}>选择或新建工作区</Button><Button variant="ghost" size="sm" disabled={busy} onClick={() => { setSetup(false); setPicker(false) }}>取消，保留草稿</Button></div>}
    {renderFactorySlot('workspace.picker', { open: picker, anchorRef: anchor, selectedId: workspaceID, onPick: (id: string) => { setWorkspaceID(id); setPicker(false) }, onClose: () => setPicker(false) })}
    <p className="ecnu-continue-note">{existing ? '继续已保存的本地会话。' : isNew ? '首次发送时建立本地会话。' : '首次发送时带入这段云端历史。'}后续消息保存在本地，不同步回 ChatECNU。</p>
    {invalid && <p role="alert" className="ecnu-notice">{errorText(destination.bindingState)}</p>}
    {failure && <p role="alert" className="ecnu-notice">{failure}</p>}
  </div></footer>
}
