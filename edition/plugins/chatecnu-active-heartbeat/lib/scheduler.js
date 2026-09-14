// Host-owned timer: multiple tabs share one external heartbeat. Client leases
// expire after a crashed/closed WebView; a background Host alone is not active.
export class HeartbeatScheduler {
  constructor({ send, now = Date.now, random = Math.random }) {
    this.send = send
    this.now = now
    this.random = random
    this.clients = new Map()
    this.next = Infinity
    this.foreground = false
    this.failures = 0
    this.outcome = 'waiting'
    this.blocked = false
    this.disposed = false
    this.revision = 0
  }

  presence(input) {
    if (this.disposed) return
    if (!this.clients.has(input.id) && this.clients.size >= 8) this.clients.delete(this.clients.keys().next().value)
    if (input.active) this.clients.set(input.id, { ...input, expires: this.now() + 75000 })
    else this.clients.delete(input.id)
    if (input.recovered && this.failures && this.now() - (this.lastSent ?? 0) >= 5000) this.next = 0
    return this.tick()
  }

  accountChanged() {
    this.revision++
    this.blocked = false
    this.failures = 0
    this.next = 0
    return this.tick()
  }

  async tick() {
    if (this.disposed || this.running) return this.running
    const now = this.now()
    for (const [id, client] of this.clients) if (client.expires <= now) this.clients.delete(id)
    const active = this.clients.size > 0
    const changed = active !== this.foreground
    this.foreground = active
    if (changed && active) this.next = 0
    if (this.blocked || (!active && !changed) || (active && now < this.next)) return
    const metadata = this.clients.values().next().value ?? {}
    this.lastSent = now
    const revision = this.revision
    this.next = Infinity
    this.running = (async () => {
      let result
      try { result = await this.send({ state: active ? 'active' : 'background', locale: metadata.locale ?? '', timezone: metadata.timezone ?? '' }) }
      catch { result = { state: 'retry' } }
      if (this.disposed || revision !== this.revision) return
      this.outcome = result.state
      if (result.state === 'ok') {
        this.failures = 0
        const seconds = Number.isFinite(result.nextHeartbeatIn) && result.nextHeartbeatIn > 0 ? result.nextHeartbeatIn : 600
        this.next = this.now() + Math.max(60, Math.min(3600, seconds)) * 1000
      } else if (result.state === 'retry') {
        this.failures++
        this.next = this.now() + Math.min(600000, 15000 * 2 ** Math.min(6, this.failures - 1)) * (1 + this.random() * 0.2)
      } else {
        // Auth/parameter/disabled errors need account/configuration changes,
        // not endless periodic requests or an automatic OAuth browser popup.
        this.blocked = true
      }
    })().finally(() => { this.running = undefined })
    return this.running
  }

  dispose() { this.disposed = true; this.clients.clear() }
}
