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

