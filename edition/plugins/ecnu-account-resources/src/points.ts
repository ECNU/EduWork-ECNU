import React, { useEffect, useRef, useState } from 'react'
const h = React.createElement
const button = { border: '1px solid var(--dsw-alias-border-l2, #dedee8)', borderRadius: 8, padding: '8px 10px', color: 'inherit', background: 'var(--dsw-alias-bg-layer-2, #f5f5fa)', font: 'inherit', cursor: 'pointer' }
const date = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + '（北京时间）'
const messages: Record<string, string> = { unavailable: '服务暂不可用，请稍后重试。', not_configured: '此功能尚未启用。', not_connected: '请重新登录学校账户。', permission_denied: '当前账户暂时无法使用此功能，请到 ChatECNU 查看或联系管理员。', expired: '邀请链接已过期，请重新获取。' }
const gift = h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('path', { d: 'M4 10h16v11H4zM3 6h18v4H3zM12 6v15M12 6H8a2.5 2.5 0 1 1 2.5-2.5L12 6Zm0 0h4a2.5 2.5 0 1 0-2.5-2.5L12 6Z' }))

export function PointsFooter({ profile, status, wide, pointsProfileID, readPoints, getInvitation, watchAccount }: any) {
  const enabled = profile.id === pointsProfileID && status?.credentialReady
  const [points, setPoints] = useState<any>(null), [invite, setInvite] = useState<any>(null)
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const [checking, setChecking] = useState(false), [accountReady, setAccountReady] = useState(false)
  const [identityChecking, setIdentityChecking] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null), generation = useRef(0), dialogGeneration = useRef(0), readVersion = useRef(0)
  const pending = useRef(false), restoreFocus = useRef(false), opener = useRef<HTMLButtonElement | null>(null)
  const accountRevision = useRef<string | undefined>(undefined), previousProfile = useRef(''), previousStatus = useRef<any>(null)
  const identitySupport = useRef<boolean | null>(null)
  const reset = () => {
    generation.current++; dialogGeneration.current++; pending.current = false
    setInvite(null); setNotice(''); setBusy(false); setOpen(false); setAccountReady(false)
  }
  const read = async () => {
    const stamp = generation.current, version = ++readVersion.current
    const current = () => stamp === generation.current && version === readVersion.current
    setChecking(true); setAccountReady(false)
    try {
      const value = await readPoints(profile.id)
      if (!current()) return
      if (accountRevision.current && value.accountRevision !== accountRevision.current) reset()
      accountRevision.current = value.accountRevision
      identitySupport.current = Boolean(value.accountRevision)
      setPoints(value)
      setAccountReady(Boolean(value.accountRevision) || value.state === 'available')
    }
    catch { if (current()) setPoints({ state: 'unavailable' }) }
    finally { if (version === readVersion.current) setChecking(false) }
  }
  useEffect(() => {
    const changed = previousProfile.current !== profile.id || !enabled
    const legacyStatusChange = previousStatus.current && previousStatus.current !== status && identitySupport.current === false
    if (changed || legacyStatusChange) { reset(); accountRevision.current = undefined; identitySupport.current = null; setPoints(null) }
    previousProfile.current = profile.id; previousStatus.current = status
    if (enabled) void read()
  }, [profile.id, status, enabled, readPoints])
  useEffect(() => () => { generation.current++; readVersion.current++ }, [])
  useEffect(() => watchAccount?.(profile.id, (state: any) => {
    if (!state) { setIdentityChecking(true); return }
    setIdentityChecking(false)
    if (state.state !== 'available') {
      setAccountReady(false)
      if (state.state === 'not_connected') { reset(); accountRevision.current = undefined; setPoints(null) }
      return
    }
    if (!state.accountRevision || accountRevision.current && state.accountRevision !== accountRevision.current) {
      reset(); accountRevision.current = state.accountRevision; identitySupport.current = Boolean(state.accountRevision); setPoints(null)
      if (enabled) void read()
    } else { accountRevision.current = state.accountRevision; identitySupport.current = true; setAccountReady(true) }
  }), [profile.id, enabled, readPoints, watchAccount])
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal()
    else if (!open && dialog.current?.open) dialog.current.close()
    if (!open && restoreFocus.current) { restoreFocus.current = false; opener.current?.focus() }
  }, [open])
  const act = async (kind: 'points' | 'invite') => {
    if (pending.current || checking || identityChecking || kind === 'invite' && !accountReady) return
    const stamp = generation.current, dialogStamp = dialogGeneration.current
    const current = () => stamp === generation.current && dialogStamp === dialogGeneration.current
    pending.current = true; setBusy(true); setNotice('')
    try {
      if (kind === 'points') await read()
      else {
        const value = await getInvitation(profile.id)
        if (current()) {
          if (accountRevision.current && value.accountRevision !== accountRevision.current) { reset(); void read() }
          else setInvite(value)
        }
      }
    } catch (error: any) { if (current()) setNotice(error?.message || '操作未完成，请稍后重试。') }
    finally { if (current()) { pending.current = false; setBusy(false) } }
  }
  const show = (event: React.MouseEvent<HTMLButtonElement>) => { opener.current = event.currentTarget; setOpen(true) }
  const close = () => {
    // Closing an invitation draft must not invalidate the avatar's balance read.
    dialogGeneration.current++; pending.current = false; restoreFocus.current = true; setBusy(false); setOpen(false)
    dialog.current?.close()
  }
  const copy = async () => {
    if (checking || identityChecking || !accountReady) return
    if (!invite?.inviteURL || Date.parse(invite.expiresAt) <= Date.now()) { setInvite({ state: 'expired' }); return }
    try { await navigator.clipboard.writeText(invite.inviteURL); setNotice('邀请链接已复制。') }
    catch { setNotice('无法自动复制，请选中链接手动复制。') }
  }
  if (!enabled) return null
  const balance = points?.state === 'available' ? `${points.currentPoints.toLocaleString()} 积分` : points ? '积分暂不可用' : '积分读取中…'
  return h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: wide ? '2px 6px 6px' : '2px 0', fontSize: 12 } },
    wide && h('button', { type: 'button', disabled: busy, title: points?.expiryNotice || '查看积分与邀请', onClick: show, style: { ...button, padding: '6px 8px', flex: 1, textAlign: 'left' } }, balance),
    h('button', { type: 'button', 'aria-label': '积分与邀请', title: wide ? '邀请有礼' : balance, onClick: show, style: { ...button, display: 'grid', placeItems: 'center', width: 36, height: 36, padding: 0 } }, gift),
    h('dialog', { ref: dialog, onCancel: (event: any) => { event.preventDefault(); close() }, onClose: () => setOpen(false), 'aria-labelledby': 'ecnu-points-title', style: { width: 'min(540px, calc(100vw - 32px))', boxSizing: 'border-box', maxHeight: '85vh', padding: 24, border: '1px solid var(--dsw-alias-border-l2, #dedee8)', borderRadius: 16, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', fontSize: 14, lineHeight: 1.6 } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } }, gift, h('h2', { id: 'ecnu-points-title', style: { flex: 1, fontSize: 18, margin: 0 } }, '积分与邀请'), h('button', { type: 'button', onClick: close, 'aria-label': '关闭', style: button }, '关闭')),
      h('p', { style: { fontSize: 16, fontWeight: 600 } }, balance),
      points?.expiryNotice && h('p', null, points.expiryNotice),
      points?.nextExpiryAt && h('p', null, `${points.nextExpiryPoints ?? '部分'} 积分到期：${date(points.nextExpiryAt)}`),
      h('button', { type: 'button', disabled: busy || checking || identityChecking, onClick: () => void act('points'), style: button }, '刷新积分'),
      h('hr', { style: { margin: '20px 0', border: 0, borderTop: '1px solid var(--dsw-alias-border-l2, #dedee8)' } }),
      h('h3', { style: { fontSize: 16 } }, '邀请有礼'),
      h('p', null, '获取你的专属邀请链接，分享给好友。奖励金额、资格和有效期以 ChatECNU 当前规则为准。'),
      invite?.state === 'available' ? h(React.Fragment, null,
        h('label', { htmlFor: 'ecnu-invite-link' }, '专属邀请链接'),
        h('input', { id: 'ecnu-invite-link', readOnly: true, value: invite.inviteURL, onFocus: (event: any) => event.currentTarget.select(), style: { ...button, display: 'block', width: '100%', boxSizing: 'border-box', margin: '8px 0' } }),
        h('button', { type: 'button', style: button, disabled: checking || identityChecking || !accountReady, onClick: () => void copy() }, '复制链接'),
        h('p', null, `邀请码 ${invite.referralCode}`), h('p', null, `有效期至 ${date(invite.expiresAt)}`)) : h(React.Fragment, null,
        invite && h('p', { role: 'status' }, messages[invite.state] || messages.unavailable),
        h('button', { type: 'button', style: button, disabled: busy || checking || identityChecking || !accountReady, onClick: () => void act('invite') }, busy ? '正在处理…' : '获取邀请链接')),
      h('p', { role: 'status', 'aria-live': 'polite' }, notice || (busy || checking || identityChecking ? '正在读取…' : ''))))
}
