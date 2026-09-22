import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

test('official 0.1.5 module loader loads the presence client and its focus lifecycle', async () => {
  const repository = fileURLToPath(new URL('../../../', import.meta.url))
  const runtime = resolve(process.env.EDUWORK_TEST_RUNTIME || resolve(repository, 'dist/dsh-cache/runtime-npm-0.1.5-rc.2'))
  const requireRuntime = createRequire(resolve(runtime, 'package.json'))
  assert.equal(JSON.parse(await readFile(requireRuntime.resolve('@deepseek-ai/dsh-client-modules/package.json'), 'utf8')).version, '0.1.5-rc.2')
  const window = new EventTarget()
  const document = new EventTarget()
  let focused = true, timer, bootstrap
  document.visibilityState = 'visible'
  document.hasFocus = () => focused
  document.querySelectorAll = () => []
  window.__ModuleLoader__ = { load: value => { bootstrap = value.factory() } }
  const requests = []
  const globals = {
    window, document, crypto: { randomUUID: () => 'abc-123' }, navigator: { language: 'zh-CN' }, Intl, AbortSignal, queueMicrotask,
    setInterval: callback => { timer = callback; return 1 }, clearInterval: () => { timer = undefined },
    fetch: async (path, options) => { requests.push({ path, body: JSON.parse(options.body) }); return { json: async () => ({ result: { ok: true, value: '{"state":"ok"}' } }) } },
  }
  vm.runInNewContext(await readFile(requireRuntime.resolve('@deepseek-ai/dsh-client-modules/client'), 'utf8'), globals)
  const target = { mode: 'queue', pendingQueue: [] }
  target.load = registration => { target.pendingQueue.push(registration) }
  window.__ModuleLoader__ = target
  const id = '@chatecnu-work/dsh-chatecnu-active-heartbeat'
  const loader = new bootstrap.ClientModuleSystem({
    manifest: { rev: 'fixture', modules: [{ id, url: '/presence.js?rev=fixture', initialUrl: '/presence.js?rev=fixture', rev: 'fixture', inject: [], external: [] }], plugins: [{ id, inject: [], immediately: false }] },
    staticModules: {}, registrationTarget: target,
    bootstrapModule: { id: '@deepseek-ai/dsh-client-modules', exports: bootstrap },
    loadBundle: async () => vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), globals),
  })
  const plugin = await loader.import(id)
  assert.equal(target.mode, 'live')
  const flush = () => new Promise(resolve => setImmediate(resolve))
  const dispose = plugin.apply({ on() {} })
  await flush()
  assert.equal(requests[0].path, '/api/chatecnuActiveHeartbeat/presence')
  assert.equal(JSON.parse(requests[0].body.payload.args.request).active, true)
  focused = false; window.dispatchEvent(new Event('blur')); await flush()
  assert.equal(JSON.parse(requests.at(-1).body.payload.args.request).active, false)
  focused = true; window.dispatchEvent(new Event('focus')); await flush()
  assert.equal(JSON.parse(requests.at(-1).body.payload.args.request).active, true)
  document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); await flush()
  assert.equal(JSON.parse(requests.at(-1).body.payload.args.request).active, false)
  window.dispatchEvent(new Event('online')); await flush()
  assert.equal(JSON.parse(requests.at(-1).body.payload.args.request).recovered, true)
  const count = requests.length
  dispose(); assert.equal(timer, undefined)
  window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); await flush()
  assert.equal(requests.length, count)
})

test('reauthorization waiting clears a stale login notice before the next heartbeat succeeds', async () => {
  const window = new EventTarget(), document = new EventTarget(), notices = new Set()
  document.visibilityState = 'visible'; document.hasFocus = () => true
  document.body = { append: notice => notices.add(notice) }
  document.createElement = () => {
    const notice = { style: {}, setAttribute() {}, remove() { notices.delete(notice) } }
    return notice
  }
  let client, timer, state = 'login_required'
  window.__ModuleLoader__ = { load: value => { client = value.factory() } }
  vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window, document, crypto: { randomUUID: () => 'abc-123' }, navigator: { language: 'zh-CN' }, Intl, AbortSignal, queueMicrotask,
    setInterval: callback => { timer = callback; return 1 }, clearInterval() {},
    fetch: async () => ({ json: async () => ({ result: { ok: true, value: JSON.stringify({ state }) } }) }),
  })
  const flush = () => new Promise(resolve => setImmediate(resolve))
  const dispose = client.apply({ on() {} })
  try {
    await flush(); assert.equal(notices.size, 1)
    for (const next of ['waiting', 'retry', 'rejected', 'local_error', 'signed_out', 'disabled', 'ok']) {
      state = next; timer(); await flush(); assert.equal(notices.size, 0)
      state = 'login_required'; timer(); await flush(); assert.equal(notices.size, 1)
    }
  } finally { dispose() }
  assert.equal(notices.size, 0)
})

test('online recovery arriving during an in-flight presence survives into the next report', async () => {
  const window = new EventTarget(), document = new EventTarget()
  document.visibilityState = 'visible'; document.hasFocus = () => true
  let client, finish
  const requests = []
  window.__ModuleLoader__ = { load: value => { client = value.factory() } }
  const ok = { json: async () => ({ result: { ok: true, value: '{"state":"ok"}' } }) }
  vm.runInNewContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), {
    window, document, crypto: { randomUUID: () => 'abc-123' }, navigator: { language: 'zh-CN' }, Intl, AbortSignal, queueMicrotask,
    setInterval: () => 1, clearInterval: () => {}, fetch: async (_path, init) => {
      requests.push(JSON.parse(JSON.parse(init.body).payload.args.request))
      if (requests.length === 1) return new Promise(resolve => { finish = () => resolve(ok) })
      return ok
    },
  })
  const dispose = client.apply({ on() {} })
  try {
    window.dispatchEvent(new Event('online'))
    assert.equal(requests.length, 1)
    finish(); await new Promise(resolve => setImmediate(resolve))
    assert.equal(requests.length, 2)
    assert.equal(requests[0].recovered, false)
    assert.equal(requests[1].recovered, true)
  } finally { dispose() }
})
