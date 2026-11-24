import React, { useEffect, useRef, useState } from 'react'
import remote from '../lib/typert.remote-client.js'
const h = React.createElement
const button = { border: '1px solid var(--dsw-alias-border-l2, #dedee8)', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-2, #f5f5fa)', color: 'inherit', font: 'inherit', padding: '8px 12px', cursor: 'pointer' }
const messages: Record<string, string> = { not_connected: '学校登录已变化，请重新打开反馈。', permission_denied: '当前账户暂时无法使用反馈功能，请稍后重试或联系管理员。', unavailable: '反馈服务暂不可用，请稍后重试。', preview_changed: '问答或学校账号已变化，请重新打开反馈。', too_large: '这轮问答超过反馈接口的长度限制。' }
function thumb(down: boolean, active: boolean) {
  return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', 'aria-hidden': true, fill: active ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.6, style: down ? { transform: 'rotate(180deg)' } : {} }, h('path', { d: 'M7 10v11H3V10h4Zm0 0 5-8c3 0 3 3 2 7h5c2 0 2 2 1 4l-2 7H7' }))
}
function FeedbackActions({ sessionId, messageId, api, subscribeAccountChanges, configuration, useAccess }: any) {
  const allowed = !useAccess || useAccess('ecnuFeedback/submit')
  const [preview, setPreview] = useState<any>(null), [current, setCurrent] = useState<any>(null)
  const [selected, setSelected] = useState(1), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const [desc, setDesc] = useState(''), [reason, setReason] = useState('')
  const dialog = useRef<HTMLDialogElement>(null), generation = useRef(0), readVersion = useRef(0), pending = useRef(false), opener = useRef<HTMLButtonElement | null>(null)
  const close = () => { setOpen(false); opener.current?.focus() }
  useEffect(() => {
    const stamp = ++generation.current
    setPreview(null); setCurrent(null); setOpen(false); setBusy(false); pending.current = false
    void api.preview(sessionId, messageId).then((value: any) => { if (stamp === generation.current) setPreview(value) }).catch(() => {})
    const unsubscribe = subscribeAccountChanges(() => {
      generation.current++; pending.current = false; setCurrent(null); setOpen(false); setBusy(false); setNotice('')
    })
    return () => { generation.current++; unsubscribe() }
  }, [sessionId, messageId, api, subscribeAccountChanges])
  useEffect(() => { if (open && dialog.current && !dialog.current.open) dialog.current.showModal(); else if (!open && dialog.current?.open) dialog.current.close() }, [open])
  const read = async () => {
    const stamp = generation.current, version = ++readVersion.current
    const value = await api.read(sessionId, messageId)
    if (stamp === generation.current && version === readVersion.current) setCurrent(value)
    return value
  }
  const seed = () => { if (current || pending.current) return; void read().catch(() => {}) }
  const save = async (favorite: number, value = current) => {
    readVersion.current++
    const stamp = generation.current
    const result = await api.submit(sessionId, messageId, { favorite, accountBinding: value.accountBinding, digest: preview.digest, confirmed: true, reason: favorite === 0 || !reason ? [] : [reason], desc: favorite === 0 ? '' : desc })
    if (stamp !== generation.current) return
    if (result.state !== 'available') { setNotice(messages[result.state] || messages.unavailable); return }
    setCurrent(result); setNotice(favorite === 0 ? '反馈已撤回。' : '感谢反馈。'); setOpen(false)
  }
  const run = async (work: () => Promise<void>) => {
    if (pending.current) return
    const stamp = generation.current; pending.current = true; setBusy(true); setNotice('')
    try { await work() } catch { if (stamp === generation.current) setNotice(messages.unavailable) }
    finally { if (stamp === generation.current) { pending.current = false; setBusy(false) } }
  }
  const choose = (favorite: number, event: any) => {
    opener.current = event.currentTarget
    void run(async () => {
      const stamp = generation.current
      const value = await read()
      if (stamp !== generation.current) return
      if (value.state === 'available' && value.favorite === favorite) { await save(0, value); return }
      setSelected(favorite); setDesc(''); setReason(''); setOpen(true)
      if (value.state !== 'available') setNotice(messages[value.state] || messages.unavailable)
    })
  }
  if (!allowed || !preview || preview.state === 'ineligible' || preview.state === 'unavailable') return null
  if (preview.state === 'too_large') return h('span', { style: { fontSize: 12 } }, messages.too_large)
  return h(React.Fragment, null,
    ...[1, -1].map(favorite => h('button', { key: favorite, type: 'button', disabled: busy, 'aria-label': current?.favorite === favorite ? (favorite === 1 ? '撤回点赞' : '撤回点踩') : (favorite === 1 ? '点赞' : '点踩'), 'aria-pressed': current?.favorite === favorite, onFocus: seed, onPointerEnter: seed, onClick: (event: any) => choose(favorite, event), style: { ...button, display: 'inline-grid', placeItems: 'center', width: 28, height: 28, padding: 0, border: 0, background: 'transparent' } }, thumb(favorite === -1, current?.favorite === favorite))),
    !open && notice && h('span', { role: 'status', style: { fontSize: 12 } }, notice),
    h('dialog', { ref: dialog, 'aria-labelledby': `ecnu-feedback-${messageId}`, onCancel: (event: any) => { event.preventDefault(); close() }, onClose: () => setOpen(false), style: { width: 'min(620px, calc(100vw - 32px))', maxHeight: '85vh', boxSizing: 'border-box', padding: 24, border: '1px solid var(--dsw-alias-border-l2, #dedee8)', borderRadius: 16, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', fontSize: 14, lineHeight: 1.6 } },
      h('h2', { id: `ecnu-feedback-${messageId}`, style: { marginTop: 0, fontSize: 18 } }, selected === 1 ? '评价这条回答：赞' : '评价这条回答：踩'),
      h('p', null, '提交后，以下本轮问题、最终回答及你填写的反馈将发送给 ChatECNU，用于评估和改进回答。'),
      h('details', { open: true }, h('summary', null, '预览将发送的问答正文'), h('div', { style: { maxHeight: 240, overflow: 'auto', padding: 12, background: 'var(--dsw-alias-bg-layer-2, #f5f5fa)', borderRadius: 8 } },
        h('strong', null, '问题'), h('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, preview.question), h('strong', null, '回答'), h('p', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, preview.answer))),
      configuration.reasons.length > 0 && h('label', { style: { display: 'block', marginTop: 16 } }, '反馈分类（选填）', h('select', { value: reason, onChange: (event: any) => setReason(event.target.value), style: { ...button, display: 'block' } }, h('option', { value: '' }, '不选择分类'), ...configuration.reasons.map((item: string) => h('option', { key: item, value: item }, item)))),
      h('label', { style: { display: 'block', marginTop: 16 } }, '补充说明（选填）', h('textarea', { value: desc, maxLength: 1000, rows: 3, onChange: (event: any) => setDesc(event.target.value), style: { ...button, display: 'block', width: '100%', boxSizing: 'border-box', resize: 'vertical' } })),
      h('p', { role: 'status', 'aria-live': 'polite' }, notice || (busy ? '正在处理…' : '')),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8 } }, h('button', { type: 'button', style: button, onClick: close }, '取消'),
        h('button', { type: 'button', style: button, disabled: busy || current?.state !== 'available', onClick: () => void run(() => save(selected)) }, '提交反馈'))))
}
export const inject = ['slots', 'remote']
export async function apply(ctx: any) {
  const unmount = await ctx.remote.$mount(remote)
  ctx.inject(['remote.ecnuFeedback'], (inner: any) => {
    const unwrap = async (value: any) => { const response = await value; if (response.ok) return response.value; throw Error('Feedback request failed') }
    const api = Object.fromEntries(['preview', 'read', 'submit'].map(method => [method, (...args: any[]) => unwrap(inner.remote.ecnuFeedback[method](...args))]))
    const subscribeAccountChanges = (listener: () => void) => {
      const stopCredentials = inner.remote.$on('credentials/reference-updated', listener)
      const stopConnection = inner.on('connection/reset', listener)
      return () => { stopCredentials(); stopConnection() }
    }
    let disposed = false, unregister = () => {}
    void unwrap(inner.remote.ecnuFeedback.configuration()).then(configuration => {
      if (disposed) return
      unregister = inner.slots.inject('conversation.chat.assistant-actions', () => inner.slots.register({ name: 'conversation.chat.assistant-actions', id: 'ecnu-feedback', order: 10,
        inject: (sessionId: string) => ({ sessionId, api, subscribeAccountChanges, configuration }) }, FeedbackActions))
    }).catch(() => {})
    inner.effect(() => () => { disposed = true; unregister() })
  })
  return () => unmount()
}
