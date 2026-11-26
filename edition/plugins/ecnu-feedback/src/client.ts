import React, { useEffect, useRef, useState } from 'react'
import { Button, Modal, Toast, Tooltip, IconLikeFillRegular, IconLikeOutlineRegular, IconDislikeFillRegular, IconDislikeOutlineRegular, IconWarningOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import remote from '../lib/typert.remote-client.js'
import { styles } from './styles.js'
const h = React.createElement
const messages: Record<string, string> = { not_connected: '学校登录已变化，请重新打开反馈。', permission_denied: '当前账户暂时无法使用反馈功能，请稍后重试或联系管理员。', unavailable: '反馈服务暂不可用，请稍后重试。', preview_changed: '问答或学校账号已变化，请重新打开反馈。', too_large: '这轮问答超过反馈接口的长度限制。' }
function FeedbackActions({ sessionId, messageId, api, subscribeAccountChanges, configuration, useAccess }: any) {
  const allowed = !useAccess || useAccess('ecnuFeedback/submit')
  const [preview, setPreview] = useState<any>(null), [current, setCurrent] = useState<any>(null)
  const [selected, setSelected] = useState(1), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const [desc, setDesc] = useState(''), [reason, setReason] = useState('')
  const [checkingAccount, setCheckingAccount] = useState(false)
  const [toast, setToast] = useState<{ id: number, text: string } | null>(null)
  const generation = useRef(0), readVersion = useRef(0), pending = useRef(false), opener = useRef<HTMLButtonElement | null>(null), binding = useRef<string | undefined>(undefined), validation = useRef(0)
  const close = () => { setOpen(false) }
  useEffect(() => {
    const stamp = ++generation.current
    setPreview(null); setCurrent(null); setOpen(false); setBusy(false); setToast(null); pending.current = false; binding.current = undefined
    void api.preview(sessionId, messageId).then((value: any) => { if (stamp === generation.current) setPreview(value) }).catch(() => {})
    const resetAccount = () => {
      generation.current++; pending.current = false; binding.current = undefined; setCurrent(null); setOpen(false); setBusy(false); setCheckingAccount(false); setNotice(''); setToast(null)
    }
    const unsubscribe = subscribeAccountChanges(async (reset: boolean) => {
      if (reset) { resetAccount(); return }
      if (!binding.current) return
      const stamp = generation.current, check = ++validation.current, previous = binding.current, readStamp = readVersion.current
      setCheckingAccount(true)
      // The standard event includes silent token renewal. Ask the Host to compare
      // its opaque account binding, never expose identity/credentials to the UI.
      try {
        const value = await api.read(sessionId, messageId)
        if (stamp !== generation.current || check !== validation.current || binding.current !== previous || readVersion.current !== readStamp) return
        if (value.state === 'not_connected' || value.state === 'available' && value.accountBinding !== previous) { resetAccount(); return }
        if (value.state !== 'available') { setCurrent(value); setNotice(messages[value.state] || messages.unavailable) }
        else { setCurrent((old: any) => old?.state === 'available' ? old : value); setNotice('') }
      } catch { if (stamp === generation.current && check === validation.current && readVersion.current === readStamp) { setCurrent({ state: 'unavailable' }); setNotice(messages.unavailable) } }
      finally { if (stamp === generation.current && check === validation.current) setCheckingAccount(false) }
    })
    return () => { generation.current++; unsubscribe() }
  }, [sessionId, messageId, api, subscribeAccountChanges])
  const read = async () => {
    const stamp = generation.current, version = ++readVersion.current
    const value = await api.read(sessionId, messageId)
    if (stamp === generation.current && version === readVersion.current) { setCurrent(value); if (value.state === 'available') binding.current = value.accountBinding }
    return value
  }
  const seed = () => { if (current || pending.current) return; void read().catch(() => {}) }
  const save = async (favorite: number, value = current) => {
    readVersion.current++
    const stamp = generation.current
    const result = await api.submit(sessionId, messageId, { favorite, accountBinding: value.accountBinding, digest: preview.digest, confirmed: true, reason: favorite === 0 || !reason ? [] : [reason], desc: favorite === 0 ? '' : desc })
    if (stamp !== generation.current) return
    if (result.state !== 'available') { setNotice(messages[result.state] || messages.unavailable); return }
    setCurrent(result); setNotice(''); setToast({ id: Date.now(), text: favorite === 0 ? '反馈已撤回。' : '感谢反馈。' }); setOpen(false)
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
      // DSH Modal captures the focused opener and owns focus trapping/restoration.
      opener.current?.focus()
      setSelected(favorite); setDesc(''); setReason(''); setOpen(true)
      if (value.state !== 'available') setNotice(messages[value.state] || messages.unavailable)
    })
  }
  const retryRead = () => void run(async () => {
    const previous = binding.current, stamp = generation.current
    const value = await read()
    if (stamp !== generation.current) return
    if (value.state === 'available' && previous && value.accountBinding !== previous) { generation.current++; setOpen(false); setCurrent(null); binding.current = undefined; setBusy(false); pending.current = false; return }
    if (value.state !== 'available') setNotice(messages[value.state] || messages.unavailable)
  })
  if (!allowed || !preview || preview.state === 'ineligible' || preview.state === 'unavailable') return null
  if (preview.state === 'too_large') return h('span', { style: { fontSize: 12 } }, messages.too_large)
  return h(React.Fragment, null,
    ...[1, -1].map(favorite => {
      const active = current?.favorite === favorite
      const label = active ? (favorite === 1 ? '撤回点赞' : '撤回点踩') : (favorite === 1 ? '点赞' : '点踩')
      const Icon = favorite === 1 ? (active ? IconLikeFillRegular : IconLikeOutlineRegular) : (active ? IconDislikeFillRegular : IconDislikeOutlineRegular)
      return h(Tooltip, { key: favorite, label, side: 'bottom' }, h(Button, { variant: 'ghost', size: 'sm', className: 'ecnu-feedback-action', 'aria-disabled': busy, 'aria-label': label, 'aria-pressed': active, onFocus: seed, onPointerEnter: seed, onClick: (event: any) => choose(favorite, event) }, h(Icon, { 'aria-hidden': true, size: 16 })))
    }),
    !open && notice && h('span', { role: 'status', className: 'ecnu-feedback-notice' }, notice),
    toast && h(Toast, { key: toast.id, text: toast.text, tone: 'success', onDone: () => setToast(null) }),
    h(Modal, { open, title: selected === 1 ? '提交反馈 · 好的回答' : '提交反馈 · 有问题的回答', closeLabel: '关闭反馈', onClose: close, className: 'ecnu-feedback-dialog', contentClassName: 'ecnu-feedback-content',
      footer: h(React.Fragment, null, h(Button, { onClick: close }, '取消'), h(Button, { variant: 'primary', disabled: busy || checkingAccount || current?.state !== 'available', onClick: () => void run(() => save(selected)) }, busy ? '正在提交…' : '提交反馈')) },
      configuration.reasons.length > 0 && h('div', { className: 'ecnu-feedback-categories', role: 'group', 'aria-label': '反馈分类（选填）' }, ...configuration.reasons.map((item: string) => h(Button, { key: item, size: 'sm', variant: reason === item ? 'primary' : 'outline', disabled: busy, 'aria-pressed': reason === item, onClick: () => setReason(reason === item ? '' : item) }, item))),
      h('label', { className: 'ecnu-feedback-label' }, '补充说明（选填）', h('textarea', { className: 'ecnu-feedback-detail', value: desc, maxLength: 1000, rows: 3, readOnly: busy, 'data-modal-autofocus': true, placeholder: '填写详情，帮助我们改进回答', onChange: (event: any) => setDesc(event.target.value) })),
      h('p', { className: 'ecnu-feedback-disclosure' }, '提交后，本轮问题、最终回答及你填写的反馈将发送给 ChatECNU，用于评估和改进回答。'),
      h('details', { className: 'ecnu-feedback-preview' }, h('summary', null, '预览将发送的问答正文'), h('div', null, h('strong', null, '问题'), h('p', null, preview.question), h('strong', null, '回答'), h('p', null, preview.answer))),
      notice && h('p', { role: 'status', 'aria-live': 'polite', className: 'ecnu-feedback-notice' }, h(IconWarningOutlineRegular, { 'aria-hidden': true, size: 16 }), notice),
      notice && current?.state !== 'available' && h(Button, { size: 'sm', disabled: busy || checkingAccount, onClick: retryRead }, '重试')))
}
export const inject = ['slots', 'remote']
export async function apply(ctx: any) {
  ctx.effect(() => { const tag = document.createElement('style'); tag.dataset.pluginCss = 'ecnu-feedback'; tag.textContent = styles; document.head.append(tag); return () => tag.remove() })
  const unmount = await ctx.remote.$mount(remote)
  ctx.inject(['remote.ecnuFeedback'], (inner: any) => {
    const unwrap = async (value: any) => { const response = await value; if (response.ok) return response.value; throw Error('Feedback request failed') }
    const api = Object.fromEntries(['preview', 'read', 'submit'].map(method => [method, (...args: any[]) => unwrap(inner.remote.ecnuFeedback[method](...args))]))
    const subscribeAccountChanges = (listener: (reset: boolean) => void) => {
      const stopCredentials = inner.remote.$on('credentials/reference-updated', () => listener(false))
      const stopConnection = inner.on('connection/reset', () => listener(true))
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
