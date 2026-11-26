import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Menu, MenuItemButton, Tooltip, IconRefreshOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import { quotaSummary, remainingPercent } from '../lib/summary.js'

const h = React.createElement
const amount = (value: any) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '未提供'
const periodName = (type: string) => ({ fixed_168h: '7 天额度', fixed_24h: '24 小时额度', fixed_5h: '5 小时额度' } as Record<string, string>)[type] || type
const date = (value: string) => new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

export function QuotaFooter({ profile, status, profileIDs, readQuota }: any) {
  const enabled = profileIDs.includes(profile.id) && Boolean(profile.provider) && Boolean(status?.credentialReady)
  const [value, setValue] = useState<any>(null), [reading, setReading] = useState(false)
  const [open, setOpen] = useState(false), [expanded, setExpanded] = useState(false)
  const generation = useRef(0), latest = useRef(status), pending = useRef(false), readAt = useRef(0)
  const previousIdentity = useRef('')
  latest.current = status
  const read = useCallback(async (replace = false) => {
    if (!enabled || pending.current && !replace) return
    const current = ++generation.current, snapshot = latest.current
    pending.current = true; setReading(true)
    try {
      const next = await readQuota(profile.id)
      if (current === generation.current && snapshot === latest.current) { setValue(next); readAt.current = Date.now() }
    } catch { if (current === generation.current) { setValue({ state: 'unavailable' }); readAt.current = Date.now() } }
    finally { if (current === generation.current) { pending.current = false; setReading(false) } }
  }, [enabled, profile.id, readQuota])
  useEffect(() => {
    const identity = `${profile.id}\0${status?.userName ?? ''}\0${enabled}`
    if (previousIdentity.current !== identity) { setOpen(false); setExpanded(false) }
    previousIdentity.current = identity
    setValue(null); readAt.current = 0
    if (enabled) void read(true)
    else { pending.current = false; setReading(false) }
    return () => { generation.current++; pending.current = false }
  }, [profile.id, status, enabled, read])
  const readIfStale = useCallback(() => { if (Date.now() - readAt.current > 30000) void read() }, [read])
  useEffect(() => {
    window.addEventListener('focus', readIfStale)
    return () => window.removeEventListener('focus', readIfStale)
  }, [readIfStale])
  if (!enabled) return null
  const quota = value?.state === 'available' ? value : null
  const summary = quotaSummary(quota), percent = summary.windowPercent
  const tooltip = quota ? summary.window
    ? `${periodName(summary.window.type)} · ${percent === null ? '余量比例未提供' : `剩余 ${percent}%`}`
    : summary.poolRemaining !== null ? `资源包余额 · ${amount(summary.poolRemaining)} ${quota.unit || ''}` : '暂无额度数据'
    : reading ? '额度读取中…' : '额度暂不可用，点击重试'
  const rows = quota?.windows ?? [], packs = quota?.resourcePacks ?? []
  const ring = h('svg', { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
    h('circle', { cx: 12, cy: 12, r: 9, stroke: 'currentColor', strokeWidth: 2, opacity: .18 }),
    percent !== null ? h('circle', { cx: 12, cy: 12, r: 9, pathLength: 100, stroke: 'currentColor', strokeWidth: 2, strokeDasharray: `${percent} 100`, transform: 'rotate(-90 12 12)' })
      : h('path', { d: 'M9 12h6', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' }))
  const anchor = h(Tooltip, { label: tooltip, side: 'right', delayMs: 300, disabled: open, portal: true },
    h('button', { type: 'button', className: 'ecnu-quota-trigger' + (percent !== null && percent <= 10 ? ' ecnu-quota-low' : ''),
      'aria-label': `用量与额度 · ${tooltip}`, 'aria-haspopup': 'menu', 'aria-expanded': open,
      onPointerEnter: readIfStale, onFocus: readIfStale,
      onClick: () => { if (!open) { setExpanded(false); void read() }; setOpen(!open) },
      onKeyDown: (event: React.KeyboardEvent) => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); void read() } },
    }, ring))
  const footer = quota?.consoleURL ? [{ id: 'manage', label: '管理用量' }] : undefined
  const details = expanded && h('div', { className: 'ecnu-quota-details' },
    ...rows.map((row: any, index: number) => h('section', { key: `window-${index}` }, h('strong', null, periodName(row.type)),
      h('p', null, `剩余 ${amount(row.remaining)} ${quota.unit || ''}`),
      h('p', null, `已用 ${amount(row.used)} · 总量 ${amount(row.limit)}`),
      h('p', null, `重置于 ${row.resetAt ? new Date(row.resetAt).toLocaleString() : '未提供'}`))),
    ...packs.map((pack: any, index: number) => h('section', { key: `pack-${index}` }, h('strong', null, pack.name || pack.id || '资源包'),
      h('p', null, `剩余 ${amount(pack.remaining)} ${quota.unit || ''}`),
      h('p', null, `已用 ${amount(pack.used)} · 总量 ${amount(pack.total)}`),
      pack.expiresAt && h('p', null, `到期 ${new Date(pack.expiresAt).toLocaleString()}`),
      pack.status && h('p', null, `状态 ${pack.status}`))))
  return h(React.Fragment, null,
    h(Menu, { open, anchor, side: 'top', align: 'start', portal: true, compact: true, autoFocus: true,
      className: 'ecnu-quota-anchor', listClassName: 'ecnu-quota-popover', footer,
      onClose: () => setOpen(false), onSelect: (id: string) => { if (id === 'manage' && quota?.consoleURL) { window.open(quota.consoleURL, '_blank', 'noopener,noreferrer'); setOpen(false) } },
    },
    h('div', { className: 'ecnu-quota-heading' }, h('span', null, `额度来源：${profile.organization || profile.displayName || '学校账户'}`),
      h(Tooltip, { label: '刷新额度', side: 'top', delayMs: 350 }, h(Button, { variant: 'ghost', size: 'sm', role: 'menuitem', 'aria-label': '刷新额度', disabled: reading, onClick: () => void read() }, h(IconRefreshOutlineRegular, { size: 14 })))),
    quota ? h('div', { className: 'ecnu-quota-summary' },
      ...rows.map((row: any, index: number) => {
        const ratio = remainingPercent(row.remaining, row.limit)
        return h('div', { key: index, className: 'ecnu-quota-window' },
          h('div', { className: 'ecnu-quota-line' }, h('span', null, periodName(row.type)), h('strong', null, ratio === null ? `剩余 ${amount(row.remaining)}` : `剩余 ${ratio}%`)),
          ratio !== null && h('progress', { max: 100, value: ratio, 'aria-label': `${periodName(row.type)}剩余` }),
          row.resetAt && h('p', { className: 'ecnu-quota-reset' }, `${date(row.resetAt)} 重置`))
      }),
      packs.length > 0 && h('div', { className: 'ecnu-quota-line ecnu-quota-pool' }, h('span', null, '资源包余额'), h('strong', null, amount(summary.poolRemaining))),
      !rows.length && !packs.length && h('p', { className: 'ecnu-quota-empty' }, '暂无额度数据'))
      : h('p', { role: 'status', className: 'ecnu-quota-empty' }, reading ? '正在读取额度…' : '暂时无法读取额度，可稍后刷新。'),
    details,
    quota && (rows.length > 0 || packs.length > 0) && h(MenuItemButton, { onSelect: () => setExpanded(!expanded) }, expanded ? '收起明细' : '查看明细')))
}
