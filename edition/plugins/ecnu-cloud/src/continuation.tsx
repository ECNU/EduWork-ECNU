import React, { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
const messages: Record<string, string> = {
  history_changed: '云端历史已变化，请关闭窗口并重新预览后再导入。',
  unsupported_history: '这段历史尚不能完整导入。首期支持以用户消息开始的纯文本会话。',
  missing_workspace: '原工作区已移除，请先恢复工作区。', missing_directory: '工作区目录已不存在，请先恢复目录。',
  missing_or_moved_session: '已导入的会话不在原工作区，请先恢复其位置。',
  binding_needs_repair: '已有本地导入记录需要检查，未创建重复会话。',
  workspace_changed: '未完成的导入属于原工作区，请恢复后重试。',
  account_changed: '登录状态已变化，请重新预览会话。',
}
const error = (state: string) => messages[state] ?? '导入未完成。已写入的历史会保留，重试将继续原来的导入。'
export function Continuation({ preview, api, openSession, renderFactorySlot, useWorkspaces }: any) {
  const workspaces = useWorkspaces((state: any) => state.items)
  const [destination, setDestination] = useState<any>(null), [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const [workspaceID, setWorkspaceID] = useState<string | undefined>(), [remember, setRemember] = useState(false)
  const [picker, setPicker] = useState(false), [failure, setFailure] = useState('')
  const anchor = useRef<HTMLButtonElement>(null), active = useRef(true), request = useRef<AbortController | null>(null)
  const input = { lease: preview.lease, conversationID: preview.summary.conversationID }
  useEffect(() => {
    active.current = true
    void api('cloudDestination', input).then((value: any) => {
      if (!active.current) return
      setDestination(value); setWorkspaceID(value.workspaceID); if (value.pending) setRemember(value.rememberProject)
      if (value.state !== 'available') setFailure(error(value.state))
    }).catch(() => { if (active.current) setFailure(error('unavailable')) })
    return () => { active.current = false; request.current?.abort() }
  }, [])
  const existing = destination?.bindingState === 'available'
  const invalid = destination?.bindingState && !['available', 'unbound'].includes(destination.bindingState)
  const selected = workspaces.find((item: any) => item.workspaceId === workspaceID)
  async function submit() {
    setBusy(true); setFailure('')
    const controller = new AbortController(); request.current = controller
    try {
      const result = await api('cloudImport', { ...input, workspaceID, snapshot: preview.snapshot, rememberProject: remember }, controller.signal)
      if (!active.current) return
      if (result.state !== 'available') {
        setFailure(error(result.state))
        const next = await api('cloudDestination', input)
        if (active.current && next.state === 'available') { setDestination(next); if (next.workspaceID) setWorkspaceID(next.workspaceID); if (next.pending) setRemember(next.rememberProject) }
        return
      }
      await openSession(result.sessionID, () => active.current)
    } catch { if (active.current) setFailure(error('unavailable')) }
    finally { if (active.current) setBusy(false) }
  }
  return <div style={{ margin: '16px 0' }}>
    <Button variant="primary" disabled={busy || !destination || destination.state !== 'available' || invalid || (!existing && (!preview.importable || !preview.messages.length))}
      onClick={() => existing ? void submit() : setOpen(true)}>{existing ? '打开本地续聊' : '在 EduWork 继续'}</Button>
    {invalid && <p role="alert">{error(destination.bindingState)}</p>}
    {!open && failure && <p role="alert">{failure}</p>}
    <Modal open={open} onClose={() => { if (!busy) setOpen(false) }} title="在 EduWork 继续" closeLabel="关闭"
      description="历史消息将复制到所选工作区。后续对话保存在 EduWork，不同步回 ChatECNU。"
      footer={<><Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>取消</Button><Button variant="primary" disabled={busy || !selected} onClick={() => void submit()}>{busy ? '正在导入…' : destination?.pending ? '继续上次导入' : '导入并打开'}</Button></>}>
      <p>{preview.summary.title} · {preview.total} 条消息</p>
      <div style={{ margin: '18px 0' }}>
        <p>保存到工作区</p>
        <Button ref={anchor} variant="outline" data-modal-autofocus disabled={busy || destination?.pending} aria-haspopup="menu" aria-expanded={picker} onClick={() => setPicker(true)}>{selected?.title || '选择或新建工作区'}</Button>
        {selected && <p style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{selected.path}</p>}
        {renderFactorySlot('workspace.picker', { open: picker, anchorRef: anchor, selectedId: workspaceID, onPick: (id: string) => { setWorkspaceID(id); setPicker(false) }, onClose: () => setPicker(false) })}
      </div>
      {preview.summary.projectID && <label><input type="checkbox" checked={remember} disabled={busy || destination?.pending} onChange={event => setRemember(event.target.checked)} />记住此项目的默认工作区（仅影响以后的导入）</label>}
      {destination?.pending && <p>将恢复上次未完成的导入，保存位置保持不变。</p>}
      {failure && <p role="alert">{failure}</p>}
    </Modal>
  </div>
}
