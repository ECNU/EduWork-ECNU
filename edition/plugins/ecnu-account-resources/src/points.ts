import React, { useEffect, useRef, useState } from 'react'
const h = React.createElement
const button = { border: '1px solid var(--dsw-alias-border-l2, #dedee8)', borderRadius: 8, padding: '8px 10px', color: 'inherit', background: 'var(--dsw-alias-bg-layer-2, #f5f5fa)', font: 'inherit', cursor: 'pointer' }
const date = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) + '（北京时间）'
const messages: Record<string, string> = { unavailable: '服务暂不可用，请稍后重试。', not_configured: '此功能尚未启用。', not_connected: '请重新登录学校账户。', permission_denied: '当前账户暂时无法使用此功能，请到 ChatECNU 查看或联系管理员。', expired: '邀请链接已过期，请重新获取。' }
const gift = h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('path', { d: 'M4 10h16v11H4zM3 6h18v4H3zM12 6v15M12 6H8a2.5 2.5 0 1 1 2.5-2.5L12 6Zm0 0h4a2.5 2.5 0 1 0-2.5-2.5L12 6Z' }))

export function PointsFooter({ profile, status, wide, pointsProfileID, readPoints, getInvitation }: any) {
  const enabled = profile.id === pointsProfileID && status?.credentialReady
  const [points, setPoints] = useState<any>(null), [invite, setInvite] = useState<any>(null)
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null), generation = useRef(0), trigger = useRef<HTMLButtonElement>(null)
  const read = async () => {
    const stamp = generation.current
    try { const value = await readPoints(profile.id); if (stamp === generation.current) setPoints(value) }
    catch { if (stamp === generation.current) setPoints({ state: 'unavailable' }) }
  }
  useEffect(() => {
    generation.current++; setPoints(null); setInvite(null); setNotice(''); setBusy(false); setOpen(false)
    if (enabled) void read()
    return () => { generation.current++ }
  }, [profile.id, status, enabled, readPoints])
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal()
    else if (!open && dialog.current?.open) dialog.current.close()
  }, [open])
  const act = async (kind: 'points' | 'invite') => {
    if (busy) return
    const stamp = generation.current; setBusy(true); setNotice('')
    try {
      if (kind === 'points') await read()
      else { const value = await getInvitation(profile.id); if (stamp === generation.current) setInvite(value) }
    } catch (error: any) { if (stamp === generation.current) setNotice(error?.message || '操作未完成，请稍后重试。') }
    finally { if (stamp === generation.current) setBusy(false) }
  }
  const close = () => { generation.current++; setBusy(false); setOpen(false); trigger.current?.focus() }
  const copy = async () => {
    if (!invite?.inviteURL || Date.parse(invite.expiresAt) <= Date.now()) { setInvite({ state: 'expired' }); return }
    try { await navigator.clipboard.writeText(invite.inviteURL); setNotice('邀请链接已复制。') }
    catch { setNotice('无法自动复制，请选中链接手动复制。') }
  }
  if (!enabled) return null
  const balance = points?.state === 'available' ? `${points.currentPoints.toLocaleString()} 积分` : points ? '积分暂不可用' : '积分读取中…'
  return h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, padding: wide ? '2px 6px 6px' : '2px 0', fontSize: 12 } },
    wide && h('button', { type: 'button', disabled: busy, title: points?.expiryNotice || '查看积分与邀请', onClick: () => setOpen(true), style: { ...button, padding: '6px 8px', flex: 1, textAlign: 'left' } }, balance),
    h('button', { ref: trigger, type: 'button', 'aria-label': '积分与邀请', title: wide ? '邀请有礼' : balance, onClick: () => setOpen(true), style: { ...button, display: 'grid', placeItems: 'center', width: 36, height: 36, padding: 0 } }, gift),
    h('dialog', { ref: dialog, onCancel: (event: any) => { event.preventDefault(); close() }, onClose: () => setOpen(false), 'aria-labelledby': 'ecnu-points-title', style: { width: 'min(540px, calc(100vw - 32px))', boxSizing: 'border-box', maxHeight: '85vh', padding: 24, border: '1px solid var(--dsw-alias-border-l2, #dedee8)', borderRadius: 16, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'inherit', fontSize: 14, lineHeight: 1.6 } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } }, gift, h('h2', { id: 'ecnu-points-title', style: { flex: 1, fontSize: 18, margin: 0 } }, '积分与邀请'), h('button', { type: 'button', onClick: close, 'aria-label': '关闭', style: button }, '关闭')),
      h('p', { style: { fontSize: 16, fontWeight: 600 } }, balance),
      points?.expiryNotice && h('p', null, points.expiryNotice),
      points?.nextExpiryAt && h('p', null, `${points.nextExpiryPoints ?? '部分'} 积分到期：${date(points.nextExpiryAt)}`),
      h('button', { type: 'button', disabled: busy, onClick: () => void act('points'), style: button }, '刷新积分'),
      h('hr', { style: { margin: '20px 0', border: 0, borderTop: '1px solid var(--dsw-alias-border-l2, #dedee8)' } }),
      h('h3', { style: { fontSize: 16 } }, '邀请有礼'),
      h('p', null, '获取你的专属邀请链接，分享给好友。奖励金额、资格和有效期以 ChatECNU 当前规则为准。'),
      invite?.state === 'available' ? h(React.Fragment, null,
        h('label', { htmlFor: 'ecnu-invite-link' }, '专属邀请链接'),
        h('input', { id: 'ecnu-invite-link', readOnly: true, value: invite.inviteURL, onFocus: (event: any) => event.currentTarget.select(), style: { ...button, display: 'block', width: '100%', boxSizing: 'border-box', margin: '8px 0' } }),
        h('button', { type: 'button', style: button, onClick: () => void copy() }, '复制链接'),
        h('p', null, `邀请码 ${invite.referralCode}`), h('p', null, `有效期至 ${date(invite.expiresAt)}`)) : h(React.Fragment, null,
        invite && h('p', { role: 'status' }, messages[invite.state] || messages.unavailable),
        h('button', { type: 'button', style: button, disabled: busy, onClick: () => void act('invite') }, busy ? '正在处理…' : '获取邀请链接')),
      h('p', { role: 'status', 'aria-live': 'polite' }, notice || (busy ? '正在读取…' : ''))))
}
