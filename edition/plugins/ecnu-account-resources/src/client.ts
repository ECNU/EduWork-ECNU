import React, { useEffect, useRef, useState } from 'react'
import remote from '../lib/typert.remote-client.js'
import { quotaSummary } from '../lib/summary.js'
const h = React.createElement
const zh = typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('zh')
const copy = zh ? { quota: '模型额度', loading: '正在读取额度…', unavailable: '暂时无法读取额度，可稍后刷新。', unknown: '未提供', remaining: '剩余', resets: '重置于', refresh: '刷新配额', processing: '正在刷新…', packs: '资源包', details: '配额详情', used: '已用', total: '总量', expires: '到期', status: '状态' }
  : { quota: 'Model allowance', loading: 'Loading allowance…', unavailable: 'Allowance is temporarily unavailable.', unknown: 'Not provided', remaining: 'remaining', resets: 'Resets', refresh: 'Refresh quota', processing: 'Refreshing…', packs: 'Resource packs', details: 'Quota details', used: 'Used', total: 'Total', expires: 'Expires', status: 'Status' }
const secondary = 'var(--dsw-alias-label-secondary, #69717f)'
const amount = (value: any) => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : copy.unknown
const label = (type: string) => ({ fixed_168h: zh ? '7 天额度' : '7-day allowance', fixed_24h: zh ? '24 小时额度' : '24-hour allowance', fixed_5h: zh ? '5 小时额度' : '5-hour allowance' } as any)[type] || type
function QuotaDetails({ profile, status, busy, run, refreshAccount, defaultContent, readQuota, profileIDs }: any) {
  const [expanded, setExpanded] = useState(false)
  const [value, setValue] = useState<any>(null), [reading, setReading] = useState(false)
  const generation = useRef(0), latest = useRef(status)
  latest.current = status
  const enabled = profileIDs.includes(profile.id) && Boolean(profile.provider) && status?.credentialReady
  const read = async () => {
    const current = ++generation.current, snapshot = latest.current
    if (!enabled) { setValue(null); setReading(false); return }
    setReading(true)
    try { const next = await readQuota(profile.id); if (current === generation.current && latest.current === snapshot) setValue(next) }
    catch { if (current === generation.current) setValue({ state: 'unavailable' }) }
    finally { if (current === generation.current) setReading(false) }
  }
  useEffect(() => { setValue(null); void read(); return () => { generation.current++ } }, [profile.id, status, enabled, readQuota])
  if (!enabled) return defaultContent
  const quota = value?.state === 'available' ? value : null
  const summary = quotaSummary(quota)
  const meter = (title, percent, fallback) => h('div', null, h('div', {style:{display:'flex',justifyContent:'space-between',marginBottom:6}}, h('strong',null,title), h('span',null,percent===null?fallback:'剩余 '+percent+'%')), percent!==null&&h('progress',{value:percent,max:100,'aria-label':title+'剩余',style:{width:'100%',height:6,accentColor:'var(--dsw-alias-state-business-primary, #9f2636)'}}))
  return h('div', { style: { borderTop: '1px solid var(--dsw-alias-border-l2, #e1e4eb)', padding: '12px 3px 8px' } },

    reading && h('p', { role: 'status', style: { color: secondary } }, copy.loading),
    !reading && !quota && h('p', { style: { color: secondary } }, copy.unavailable),
    quota && h('div', { style: { display: 'grid', gap: 12, marginTop: 12 } },
      meter(zh ? '使用情况' : 'Usage', summary.windowPercent, copy.unknown),
      summary.window?.resetAt && h('div',{style:{color:secondary,fontSize:11,marginTop:-7}},new Date(summary.window.resetAt).toLocaleString(undefined,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+' '+(zh?'重置':'reset')),
      meter(zh ? '资源池' : 'Resource pool', summary.poolPercent, summary.poolRemaining===null?copy.unknown:amount(summary.poolRemaining)+' '+(quota.unit||'')+' '+copy.remaining),
      h('button',{type:'button',role:'menuitem','aria-expanded':expanded,onClick:()=>setExpanded(!expanded),style:{border:0,background:'transparent',color:'inherit',cursor:'pointer',textAlign:'left',padding:0}},expanded?'收起配额明细':'展开配额明细'),
      expanded && h('div',{style:{maxHeight:220,overflowY:'auto',display:'grid',gap:10}},
      quota.resourcePacks?.length > 0 && h('strong', null, copy.packs),
      ...(quota.resourcePacks ?? []).map((pack: any, index: number) => h('div', { key: `${pack.id}-${index}`, style: { color: secondary } },
        h('div', null, pack.name || pack.id || copy.packs), h('div', null, `${amount(pack.remaining)}${quota.unit ? ` ${quota.unit}` : ''} ${copy.remaining}`),
        (pack.total !== null || pack.used !== null) && h('div', { style: { fontSize: 11 } }, `${copy.used} ${amount(pack.used)} · ${copy.total} ${amount(pack.total)}`),
        pack.expiresAt && h('div', { style: { fontSize: 11 } }, `${copy.expires} ${new Date(pack.expiresAt).toLocaleString()}`),
        pack.status && h('div', { style: { fontSize: 11 } }, `${copy.status} ${pack.status}`))),
      ),
      quota.consoleURL && h('a', { role: 'menuitem', href: quota.consoleURL, target: '_blank', rel: 'noopener noreferrer', style: { color: 'inherit' } }, copy.details)),
    h('button', { type: 'button', role: 'menuitem', disabled: busy || reading, onClick: () => void run(async () => { await refreshAccount(); await read() }),
      style: { width: '100%', textAlign: 'left', border: 0, borderRadius: 7, padding: '9px 10px', marginTop: 10, font: 'inherit', cursor: 'pointer', background: 'var(--dsw-alias-bg-layer-2, #f5f6f8)', color: 'inherit' } }, busy ? copy.processing : copy.refresh))
}
export const inject = ['slots', 'remote']
export async function apply(ctx: any) {
  const unmount = await ctx.remote.$mount(remote)
  ctx.inject(['remote.ecnuAccountResources'], (inner: any) => {
    let disposed = false, unregister = () => {}
    const unwrap = async (value: any) => { const response = await value; if (response.ok) return response.value; throw new Error('ECNU account resource unavailable') }
    const readQuota = (id: string) => unwrap(inner.remote.ecnuAccountResources.quota(id))
    void unwrap(inner.remote.ecnuAccountResources.configuration()).then(configuration => {
      if (disposed) return
      unregister = inner.slots.inject('oidc.account.menu.details', () => inner.slots.register({ name: 'oidc.account.menu.details', id: 'ecnu-account-resources', priority: -100,
        inject: () => ({ readQuota, profileIDs: configuration.profileIDs }) }, QuotaDetails))
    }).catch(() => { /* Keep the public refresh action if extension configuration is unavailable. */ })
    inner.effect(() => () => { disposed = true; unregister() }, 'ecnu-account-resources: account details')
  })
  return () => unmount()
}
