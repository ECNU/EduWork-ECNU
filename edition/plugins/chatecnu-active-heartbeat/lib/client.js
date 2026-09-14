// Maintained source, not generated. This uses DSH's public same-origin Typert
// HTTP transport. Only foreground presence crosses it; no OAuth token does.
window.__ModuleLoader__.load({
  id: '@chatecnu-work/dsh-chatecnu-active-heartbeat',
  factory: () => ({
    inject: [],
    apply(ctx) {
      const id = crypto.randomUUID()
      let disposed = false, running = false, again = false, recovered = false, hiding = false
      let notice
      const active = () => !hiding && document.visibilityState === 'visible' && document.hasFocus()
      const report = async () => {
        if (disposed) return
        if (running) { again = true; return }
        running = true
        try {
          const response = await fetch('/api/chatecnuActiveHeartbeat/presence', {
            method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({ type: 'client-request', rpcId: crypto.randomUUID(), method: 'chatecnuActiveHeartbeat/presence', payload: { args: {
              request: JSON.stringify({ id, active: active(), recovered, locale: navigator.language.slice(0, 20), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
            } } }),
          })
          recovered = false
          const envelope = await response.json()
          if (disposed) return
          const state = envelope.result?.ok ? JSON.parse(envelope.result.value).state : ''
          if (state === 'login_required' && !notice) {
            notice = document.createElement('div')
            notice.setAttribute('role', 'status')
            notice.textContent = '学校登录已失效，请在左下角账号菜单重新登录。'
            notice.style.cssText = 'position:fixed;bottom:16px;left:16px;z-index:1000;max-width:300px;padding:10px 14px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,#fff);box-shadow:0 2px 12px #0002;font-size:12px;'
            document.body.append(notice)
          } else if (state === 'ok' || state === 'disabled' || state === 'signed_out') { notice?.remove(); notice = undefined }
        } catch { /* Host reconnects and network outages must not disrupt chat. */ }
        finally { running = false; if (again) { again = false; void report() } }
      }
      const change = () => { void report() }
      const online = () => { recovered = true; void report() }
      const blur = () => queueMicrotask(change)
      const hide = () => { hiding = true; change() }
      const show = () => { hiding = false; change() }
      document.addEventListener('visibilitychange', change)
      window.addEventListener('focus', change)
      window.addEventListener('blur', blur)
      window.addEventListener('online', online)
      window.addEventListener('pagehide', hide)
      window.addEventListener('pageshow', show)
      ctx.on('connection/reset', online)
      const timer = setInterval(change, 25000)
      void report()
      return () => {
        disposed = true; clearInterval(timer); notice?.remove()
        document.removeEventListener('visibilitychange', change)
        window.removeEventListener('focus', change)
        window.removeEventListener('blur', blur)
        window.removeEventListener('online', online)
        window.removeEventListener('pagehide', hide)
        window.removeEventListener('pageshow', show)
      }
    },
  }),
})
