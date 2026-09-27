// One queue per configured specialist, shared by every conversation using the
// plugin. Never acquire the parent LLM queue here: its permit is already held.
export class VisionRequestQueue {
  constructor(limit) {
    this.limit = limit
    this.active = 0
    this.waiting = []
    this.lifetime = new AbortController()
  }

  async run(task, callerSignal) {
    const signal = callerSignal
      ? AbortSignal.any([callerSignal, this.lifetime.signal]) : this.lifetime.signal
    signal.throwIfAborted()
    await new Promise((resolve, reject) => {
      const waiter = { resolve, reject, signal }
      waiter.abort = () => {
        this.waiting = this.waiting.filter(item => item !== waiter)
        reject(signal.reason)
      }
      signal.addEventListener('abort', waiter.abort, { once: true })
      this.waiting.push(waiter)
      this.drain()
    })
    try {
      signal.throwIfAborted()
      return await task(signal)
    } finally {
      this.active--
      this.drain()
    }
  }

  drain() {
    while (this.active < this.limit && this.waiting.length) {
      const waiter = this.waiting.shift()
      waiter.signal.removeEventListener('abort', waiter.abort)
      this.active++
      waiter.resolve()
    }
  }

  close() {
    this.lifetime.abort(new DOMException('Vision plugin stopped', 'AbortError'))
  }
}
