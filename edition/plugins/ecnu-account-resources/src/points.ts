import React, { useEffect, useRef, useState } from 'react'
import { Button, Modal, Tooltip, IconSparkleRegular, IconRefreshOutlineRegular, IconCopyOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { pointsStyles } from './points-styles.js'
const h = React.createElement

const date = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + '（北京时间）'
const messages: Record<string, string> = { unavailable: '服务暂不可用，请稍后重试。', not_configured: '此功能尚未启用。', not_connected: '请重新登录学校账户。', permission_denied: '当前账户暂时无法使用此功能，请到 ChatECNU 查看或联系管理员。', expired: '邀请链接已过期，请重新获取。' }
const gift = h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true }, h('path', { d: 'M4 10h16v11H4zM3 6h18v4H3zM12 6v15M12 6H8a2.5 2.5 0 1 1 2.5-2.5L12 6Zm0 0h4a2.5 2.5 0 1 0-2.5-2.5L12 6Z' }))

export function PointsFooter({ profile, status, wide, pointsProfileID, readPoints, getInvitation, watchAccount }: any) {
  const enabled = profile.id === pointsProfileID && status?.credentialReady
  const [points, setPoints] = useState<any>(null), [invite, setInvite] = useState<any>(null)
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const [checking, setChecking] = useState(false), [accountReady, setAccountReady] = useState(false)
  const [identityChecking, setIdentityChecking] = useState(false)
  const generation = useRef(0), dialogGeneration = useRef(0), readVersion = useRef(0)
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
  }
  const copy = async () => {
    if (checking || identityChecking || !accountReady) return
    if (!invite?.inviteURL || Date.parse(invite.expiresAt) <= Date.now()) { setInvite({ state: 'expired' }); return }
    try { await navigator.clipboard.writeText(invite.inviteURL); setNotice('邀请链接已复制。') }
    catch { setNotice('无法自动复制，请选中链接手动复制。') }
  }
  if (!enabled) return null
  const balance = points?.state === 'available' ? `${points.currentPoints.toLocaleString()} 积分` : points ? '积分暂不可用' : '积分读取中…'
  const available = points?.state === 'available'
  const hint = [balance, points?.expiryNotice, '点击查看积分与邀请'].filter(Boolean).join(' · ')
  return h(React.Fragment, null,
    h('style', null, pointsStyles),
    h('div', { className: 'ecnu-rewards-footer' + (wide ? '' : ' ecnu-rewards-rail') },
      h(Tooltip, { label: hint, side: 'right', delayMs: 350, portal: true, disabled: open },
        h('button', { type: 'button', className: 'ecnu-rewards-balance', disabled: busy, 'aria-label': `积分与邀请 · ${balance}`, 'aria-haspopup': 'dialog', 'aria-expanded': open, onClick: show },
          h(IconSparkleRegular, { size: 17 })))),
    h(Modal, { open, onClose: close, title: '积分与邀请', closeLabel: '关闭', className: 'ecnu-rewards-dialog', contentClassName: 'ecnu-rewards-content' },
      h('section', { className: 'ecnu-rewards-summary', 'aria-label': '积分余额' },
        h('div', { className: 'ecnu-rewards-summary-heading' }, h('span', null, '当前积分'),
          h(Tooltip, { label: '刷新积分', side: 'left', delayMs: 350 }, h(Button, { variant: 'ghost', size: 'sm', 'aria-label': '刷新积分', disabled: busy || checking || identityChecking, onClick: () => void act('points') }, h(IconRefreshOutlineRegular, { size: 15 })))),
        available ? h('div', { className: 'ecnu-rewards-total' }, points.currentPoints.toLocaleString(), h('span', null, '积分'))
          : h('p', { className: 'ecnu-rewards-unavailable' }, balance),
        points?.expiryNotice && h('p', { className: 'ecnu-rewards-expiry' }, points.expiryNotice),
        !points?.expiryNotice && points?.nextExpiryAt && h('p', { className: 'ecnu-rewards-expiry' }, h('strong', null, `${points.nextExpiryPoints ?? '部分'} 积分`), `将于 ${date(points.nextExpiryAt)}到期`)),
      h('section', { className: 'ecnu-rewards-sharing', 'aria-labelledby': 'ecnu-invite-heading' },
        h('div', { className: 'ecnu-rewards-sharing-heading' }, h('span', { className: 'ecnu-rewards-gift' }, gift), h('div', null, h('h3', { id: 'ecnu-invite-heading' }, '邀请好友'), h('p', null, '分享 ChatECNU，符合条件即可获得积分。'))),
        invite?.state === 'available' ? h(React.Fragment, null,
          h('label', { htmlFor: 'ecnu-invite-link', className: 'ecnu-rewards-link-label' }, '专属邀请链接'),
          h('div', { className: 'ecnu-rewards-link' },
            h('input', { id: 'ecnu-invite-link', readOnly: true, value: invite.inviteURL, onFocus: (event: any) => event.currentTarget.select() }),
            h(Button, { variant: 'ghost', size: 'sm', disabled: checking || identityChecking || !accountReady, onClick: () => void copy() }, h(IconCopyOutlineRegular, { size: 14 }), '复制链接')),
          h('div', { className: 'ecnu-rewards-link-meta' }, h('span', null, '邀请码 ', h('span', { className: 'ecnu-rewards-code' }, invite.referralCode)), h('span', null, `有效期至 ${date(invite.expiresAt)}`)))
          : h(React.Fragment, null,
            invite && h('p', { role: 'status', className: 'ecnu-rewards-error' }, messages[invite.state] || messages.unavailable),
            h(Button, { variant: 'primary', className: 'ecnu-rewards-primary', disabled: busy || checking || identityChecking || !accountReady, onClick: () => void act('invite') }, busy ? '正在处理…' : '获取邀请链接')),
        h('p', { className: 'ecnu-rewards-rule' }, '奖励与邀请资格以 ChatECNU 当前规则为准。')),
      h('p', { role: 'status', 'aria-live': 'polite', className: 'ecnu-rewards-notice' }, notice || (busy || checking || identityChecking ? '正在读取…' : ''))))
}
