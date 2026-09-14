import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { HeartbeatScheduler } from './scheduler.js'
import { createWebHeartbeatSender } from './web-backend.js'

export const name = 'chatecnu-active-heartbeat'
const initializers = []

export function parsePresence(request) {
  const input = JSON.parse(request)
  if (!input || !/^[a-zA-Z0-9-]{1,64}$/.test(input.id) || typeof input.active !== 'boolean'
    || (input.locale !== undefined && (typeof input.locale !== 'string' || input.locale.length > 20))
    || (input.timezone !== undefined && (typeof input.timezone !== 'string' || input.timezone.length > 64))
    || (input.recovered !== undefined && typeof input.recovered !== 'boolean')) throw new Error('invalid client presence')
  return input
}

export class ChatECNUActiveHeartbeat extends TypertRemoteService {
  constructor(ctx, config = {}) {
    super(ctx, 'chatecnuActiveHeartbeat')
    for (const init of initializers) init.call(this)
    this.abort = new AbortController()
    const sendNative = async input => {
      const { nativeBridge } = await ctx.desktopBoundary.ready
      const response = await fetch(`${nativeBridge.baseURL}/v1/extensions/chatecnu-active-heartbeat`, {
        method: 'POST', headers: { authorization: `Bearer ${nativeBridge.token}`, 'content-type': 'application/json' },
        body: JSON.stringify(input), redirect: 'error', signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(20000)]),
      })
      const result = response.ok ? await response.json() : { state: response.status >= 500 ? 'retry' : 'rejected', httpStatus: response.status }
      return result
    }
    const send = config.enabled === false ? async () => ({ state: 'disabled' })
      : config.backend === 'web' ? createWebHeartbeatSender(ctx.oidcAccounts, config, { signal: this.abort.signal }) : sendNative
    this.scheduler = new HeartbeatScheduler({ send: async input => {
      const result = await send(input)
      // No response body, user/session identifiers, or credentials in logs.
      if (!['ok', 'disabled', 'signed_out'].includes(result.state)) ctx.logger.info(`ChatECNU heartbeat: ${result.state} (${result.httpStatus ?? 0})`)
      return result
    } })
    const timer = setInterval(() => { void this.scheduler.tick() }, 5000)
    timer.unref?.()
    if (config.backend === 'web') {
      let accountState
      ctx.on('oidc/accounts-changed', event => {
        if (event.profileID !== config.profileID) return
        const changed = accountState !== undefined && accountState !== event.state
        accountState = event.state
        if (changed || this.scheduler.blocked) void this.scheduler.accountChanged()
      })
    } else ctx.on('enterprise-account/changed', () => { void this.scheduler.accountChanged() })
    ctx.effect(() => () => { clearInterval(timer); this.scheduler.dispose(); this.abort.abort() }, 'chatecnu heartbeat lifecycle')
  }

  presence(request) {
    void this.scheduler.presence(parsePresence(request))
    return JSON.stringify({ state: this.scheduler.outcome })
  }
}

Remote('presence')(ChatECNUActiveHeartbeat.prototype.presence, {
  kind: 'method', name: 'presence', static: false, private: false,
  addInitializer(init) { initializers.push(init) },
})

export async function apply(ctx, raw = {}) {
  const backend = raw.backend ?? 'native'
  if (!['native', 'web'].includes(backend)) throw new Error('heartbeat backend must be native or web')
  const config = { ...raw, backend, ...(backend === 'web' ? { enabled: raw.enabled === true } : {}) }
  const disabled = config.enabled === false || (backend === 'web' && config.enabled !== true)
  const dependencies = disabled ? [] : backend === 'web' ? ['oidcAccounts'] : ['desktopBoundary', 'enterpriseAccounts']
  await ctx.inject(dependencies, async scope => { await scope.plugin(ChatECNUActiveHeartbeat, config) })
}

export default apply
