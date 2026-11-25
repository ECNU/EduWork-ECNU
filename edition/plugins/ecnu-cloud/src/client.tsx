import React, { useEffect, useRef, useState } from 'react'
import { Button, IconNewChatOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import contribution from '../lib/typert.remote-client.js'

const errors: Record<string, string> = {
  not_connected: '请先在左下角登录学校账号。', sign_in_required: '请先在左下角登录学校账号。',
  identity_unavailable: '当前登录组件尚不支持云端会话，请更新组件。',
  permission_denied: '当前登录没有云端会话读取权限。', account_changed: '登录状态已变化，请刷新云端会话。',
  not_configured: '云端会话服务尚未配置。', rate_limited: '请求较多，请稍后重试。',
  too_large: '这段会话超过首期导入范围（1,000 条消息或 1 MB 文本）。',
  history_changed: '云端历史发生变化，请重新选择会话。',
}
export const errorText = (state: string) => errors[state] ?? '暂时无法读取云端会话，请稍后重试。'
const muted = 'var(--dsw-alias-label-secondary, #777)'
const border = '1px solid var(--dsw-alias-border-l2, #ddd)'

export function CloudPage({ api, watch, continuation }: any) {
  const [list, setList] = useState<any>(null), [preview, setPreview] = useState<any>(null)
  const [busy, setBusy] = useState(false), [previewBusy, setPreviewBusy] = useState(false)
  const [selected, setSelected] = useState<string | null>(null), [error, setError] = useState('')
  const generation = useRef(0), selection = useRef(0), lease = useRef<string | null>(null)
  const clear = () => { ++generation.current; ++selection.current; lease.current = null; setList(null); setPreview(null); setSelected(null); setPreviewBusy(false); setBusy(false) }
  async function load(page = 1) {
    const g = ++generation.current; ++selection.current; setBusy(true); setPreview(null); setSelected(null); setPreviewBusy(false); setError('')
    try {
      const state = await api('cloudState')
      if (g !== generation.current) return
      if (state.state !== 'available') { clear(); setError(errorText(state.state)); return }
      if (lease.current !== state.lease) setList(null)
      lease.current = state.lease
      const value = await api('cloudList', { lease: state.lease, page })
      if (g !== generation.current) return
      if (value.state !== 'available') { setList(null); setError(errorText(value.state)); return }
      setList(value)
    } catch { if (g === generation.current) { setList(null); setError(errorText('unavailable')) } }
    finally { if (g === generation.current) setBusy(false) }
  }
  async function select(id: string) {
    const s = ++selection.current, g = generation.current
    setSelected(id); setPreview(null); setPreviewBusy(true); setError('')
    try {
      const value = await api('cloudPreview', { lease: lease.current, conversationID: id })
      if (s !== selection.current || g !== generation.current) return
      if (value.state !== 'available') { setError(errorText(value.state)); return }
      setPreview(value)
    } catch { if (s === selection.current && g === generation.current) setError(errorText('unavailable')) }
    finally { if (s === selection.current && g === generation.current) setPreviewBusy(false) }
  }
  useEffect(() => {
    let active = true, checks = 0
    void load()
    const stop = watch(async (reset: boolean) => {
      const check = ++checks
      if (reset) { clear(); void load(); return }
      try {
        const state = await api('cloudState')
        if (!active || check !== checks) return
        if (state.state !== 'available' || state.lease !== lease.current) { clear(); void load() }
      } catch { if (active && check === checks) { clear(); setError(errorText('unavailable')) } }
    })
    return () => { active = false; ++generation.current; ++selection.current; stop() }
  }, [api, watch])
  return <section aria-label="ChatECNU 云端" style={{ height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0, padding: '20px 24px', boxSizing: 'border-box' }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 16, paddingLeft: 'var(--dsh-frame-leading-clearance, 0px)' }}>
      <h1 style={{ fontSize: 20, margin: '0 auto 0 0' }}>ChatECNU 云端</h1>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>刷新</Button>
    </header>
    <p style={{ color: muted, fontSize: 12 }}>查看学校账号的云端会话。导入后在本地继续，新的消息保存在 EduWork。</p>
    {error && <p role="alert">{error}</p>}
    <div className="ecnu-cloud-columns" style={{ flex: 1, minHeight: 0, display: 'flex', gap: 24 }}>
      <nav aria-label="云端会话列表" style={{ width: 240, minWidth: 160, overflowY: 'auto', borderRight: border, paddingRight: 12 }}>
        {busy && <p role="status">正在读取会话…</p>}
        {!busy && list?.items.length === 0 && <p>还没有云端会话。</p>}
        {list?.items.map((row: any) => <button key={row.conversationID} aria-current={selected === row.conversationID ? 'true' : undefined} disabled={busy} onClick={() => void select(row.conversationID)}
          style={{ display: 'block', textAlign: 'left', width: '100%', border: 0, borderRadius: 8, padding: '12px 10px', marginBottom: 4, font: 'inherit', color: 'inherit', cursor: 'pointer', overflowWrap: 'anywhere', background: selected === row.conversationID ? 'var(--dsw-alias-bg-layer-2, #eee)' : 'transparent' }}>
          <div>{row.title}</div><div style={{ fontSize: 11, color: muted, marginTop: 5 }}>{new Date(row.updatedAt).toLocaleDateString()}{row.projectID ? ' · 项目会话' : ''}</div>
        </button>)}
        {list && <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12 }}>
          <Button variant="outline" size="sm" disabled={busy || list.page === 1} onClick={() => void load(list.page - 1)}>上一页</Button>
          <span>{list.page}</span><Button variant="outline" size="sm" disabled={busy || !list.hasMore} onClick={() => void load(list.page + 1)}>下一页</Button>
        </div>}
      </nav>
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }} aria-label="云端会话预览">
        {previewBusy && <p role="status">正在读取完整历史…</p>}
        {!selected && <p style={{ color: muted }}>选择左侧会话，查看历史内容。</p>}
        {preview && <>
          <h2 style={{ fontSize: 18, overflowWrap: 'anywhere' }}>{preview.summary.title}</h2>
          <p style={{ color: muted, fontSize: 12 }}>{preview.total} 条消息 · 云端只读预览</p>
          {!preview.importable && <p role="status">包含尚不支持的消息，暂不能导入续聊。</p>}
          {continuation?.(preview)}
          {preview.messages.length === 0 && <p>这段会话还没有消息。</p>}
          {preview.messages.map((message: any) => <article key={message.messageID} style={{ borderTop: border, padding: '16px 0' }}>
            <strong style={{ fontSize: 12, color: muted }}>{message.role === 'user' ? '你' : message.role === 'assistant' ? 'ChatECNU' : '其他消息'}</strong>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 8, lineHeight: 1.65 }}>{message.text}</div>
          </article>)}
        </>}
      </div>
    </div>
  </section>
}
export const inject = ['slots', 'remote', 'layout']
export async function apply(ctx: any) {
  const unmount = await ctx.remote.$mount(contribution)
  const ui = ctx.inject(['remote.ecnuCloud'], (inner: any) => {
    const api = async (method: string, input?: any) => { const result = await inner.remote.ecnuCloud[method](...(input ? [input] : [])); if (!result.ok) throw Error('Cloud request failed'); return result.value }
    const watch = (callback: any) => {
      const off = inner.remote.$on('credentials/reference-updated', () => callback(false))
      const reset = inner.on('connection/reset', () => callback(true))
      return () => { off(); reset() }
    }
    inner.slots.inject('main', () => inner.slots.register({ name: 'main', key: 'ecnu-cloud', inject: () => ({ api, watch }) }, CloudPage))
    inner.slots.inject('sidebar.panellist', () => inner.slots.register({ name: 'sidebar.panellist', id: 'ecnu-cloud', order: 10, label: () => 'ChatECNU 云端' }, ({ size }: any) => <IconNewChatOutlineRegular size={size} />))
  })
  return async () => { await ui.dispose(); await unmount() }
}
