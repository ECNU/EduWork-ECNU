import React, { useEffect, useRef, useState } from 'react'
import { QUERY_ACCESS, selectQueryScopes } from '../lib/query-access.js'
const h = React.createElement
const button = { border: '1px solid var(--dsw-alias-border-l2, #dedee8)', borderRadius: 8, padding: '8px 12px', background: 'var(--dsw-alias-bg-layer-2, #f5f5fa)', color: 'inherit', font: 'inherit', cursor: 'pointer' }
export function QueryAccess({ profile, status, accounts }: any) {
  const [open, setOpen] = useState(false), [grant, setGrant] = useState<any>(null), [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null), version = useRef(0), controller = useRef<AbortController | null>(null), pending = useRef(false)
  useEffect(() => {
    version.current++; pending.current = false; controller.current?.abort(); setOpen(false); setGrant(null); setSelected([]); setBusy(false); setNotice('')
    return () => { version.current++; controller.current?.abort() }
  // Renewed expiry/capability metadata is expected after consent; an identity or login-state change closes the dialog.
  }, [profile.id, status?.profileID, status?.userName, status?.affiliation, status?.credentialRef, status?.state, status?.credentialReady])
  useEffect(() => { if (open && dialog.current && !dialog.current.open) dialog.current.showModal(); else if (!open && dialog.current?.open) dialog.current.close() }, [open])
  const close = () => { version.current++; controller.current?.abort(); pending.current = false; setBusy(false); setOpen(false); trigger.current?.focus() }
  const load = async () => {
    const stamp = ++version.current; setGrant(null); setSelected([]); setNotice(''); setOpen(true); setBusy(true)
    try {
      const value = await accounts.authorization(profile.id)
      if (stamp === version.current) { setGrant(value); if (!value.supported) setNotice('当前学校登录尚未支持按功能授权。') }
    } catch { if (stamp === version.current) setNotice('暂时无法读取授权状态，请关闭后重试。') }
    finally { if (stamp === version.current) setBusy(false) }
  }
  const authorize = async () => {
    if (pending.current) return
    const stamp = version.current; pending.current = true; setBusy(true); setNotice('')
    const abort = new AbortController(); controller.current = abort
    try {
      const fresh = await accounts.authorization(profile.id)
      if (stamp !== version.current) return
      const scopes = selectQueryScopes(selected, fresh)
      if (scopes.length !== selected.length || scopes.length === 0) { setGrant(fresh); setSelected([]); setNotice('权限状态已变化，请重新选择。'); return }
      await accounts.requestAuthorization(profile.id, scopes, { signal: abort.signal })
      if (stamp !== version.current || abort.signal.aborted) return
      const result = await accounts.authorization(profile.id)
      if (stamp !== version.current) return
      setGrant(result); setSelected([])
      setNotice(scopes.every(scope => result.granted.includes(scope)) ? '授权已更新，回到对话重新发起查询即可。' : '未完成所选授权，原有登录继续可用。')
    } catch { if (stamp === version.current) setNotice('授权未完成，原有登录继续可用。可以稍后重试。') }
    finally { if (stamp === version.current) { pending.current = false; setBusy(false) } }
  }
  return h(React.Fragment, null,
    h('button', { ref: trigger, type: 'button', role: 'menuitem', style: { ...button, width: '100%', textAlign: 'left', marginTop: 8 }, onClick: () => void load() }, 'AIConsole 查询权限'),
    h('dialog', { ref: dialog, 'aria-labelledby': 'ecnu-query-access-title', onKeyDown: (event: any) => event.stopPropagation(), onCancel: (event: any) => { event.preventDefault(); close() }, onClose: () => setOpen(false), style: { width: 'min(560px, calc(100vw - 32px))', maxHeight: '85vh', padding: 24, boxSizing: 'border-box', border: '1px solid var(--dsw-alias-border-l2, #dedee8)', borderRadius: 16, background: 'var(--dsw-alias-bg-layer-1, #fff)', color: 'var(--dsw-alias-label-primary, #20232c)', font: 'inherit', fontSize: 14, lineHeight: 1.6 } },
      h('h2', { id: 'ecnu-query-access-title', style: { marginTop: 0, fontSize: 18 } }, 'AIConsole 查询权限'),
      h('p', null, '选择你希望 AI 在对话中查询的信息。点击授权后，将前往学校授权页面确认。'),
      h('p', null, '这里仅提供查询权限。创建或修改 Key、停止请求等操作，请自行前往 AIConsole 办理。'),
      h('div', { style: { display: 'grid', gap: 10 } }, ...QUERY_ACCESS.map(item => {
        const granted = grant?.granted?.includes(item.scope), available = grant?.supported && grant.available?.includes(item.scope)
        return h('label', { key: item.scope, style: { display: 'flex', alignItems: 'flex-start', gap: 10 } },
          h('input', { type: 'checkbox', checked: Boolean(granted || selected.includes(item.scope)), disabled: busy || granted || !available, onChange: (event: any) => setSelected(values => event.target.checked ? [...values, item.scope] : values.filter(value => value !== item.scope)), style: { marginTop: 6 } }),
          h('span', null, h('strong', null, item.title), granted ? ' · 已授权' : grant && !available ? ' · 暂未开放' : '', h('span', { style: { display: 'block', color: 'var(--dsw-alias-label-secondary, #69717f)', fontSize: 12 } }, item.description)))
      })),
      h('p', { role: 'status', 'aria-live': 'polite' }, notice || (busy ? '正在读取状态或等待学校授权…' : '已有授权无需重复申请。')),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8 } }, h('button', { type: 'button', style: button, onClick: close }, busy ? '取消' : '关闭'), h('button', { type: 'button', style: button, disabled: busy || selected.length === 0, onClick: () => void authorize() }, '授权所选查询'))))
}
