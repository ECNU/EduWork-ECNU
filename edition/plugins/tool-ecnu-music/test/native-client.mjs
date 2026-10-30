import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { runInNewContext } from 'node:vm'
const require = createRequire(join(resolve(process.env.EDUWORK_TEST_RUNTIME), 'package.json'))
let client, mounted = false, unmounted = false, tab, slot, cleanups = []
const window = { __ModuleLoader__: { load(module) { assert.equal(module.id, '@chatecnu-work/dsh-tool-ecnu-music'); client = module.factory(require) } } }
runInNewContext(await readFile(new URL('../dist/music-studio/client.js', import.meta.url), 'utf8'), { window, console, TextEncoder, TextDecoder, URL, setTimeout, clearTimeout, AbortController })
assert.equal(typeof client.apply, 'function')
const ctx = {
  remote: { async $mount(descriptor) { assert.equal(descriptor.descriptors.length, 2); mounted = true; return () => { unmounted = true } }, ecnuMusicStudio: {} },
  inject(names, callback) { assert.deepEqual(Array.from(names), ['remote.ecnuMusicStudio', 'sidebarRight', 'sidebarRightTabs']); callback(this) },
  sidebarRight: {}, sidebarRightTabs: { register(value) { tab = value; return () => { tab = null } } },
  slots: { inject(name, callback) { assert.equal(name, 'sidebar.right.pane.tab'); return callback() }, register(value, Component) { slot = { value, Component }; return () => { slot = null } } },
  effect(callback) { cleanups.push(callback()) },
}
const dispose = await client.apply(ctx)
assert.ok(mounted); assert.equal(tab.kind, 'ecnu-music-studio'); assert.equal(tab.title(), '音乐工作室')
assert.equal(slot.value.key, '@chatecnu-work/dsh-tool-ecnu-music'); assert.equal(typeof slot.Component, 'function')
assert.equal(slot.value.inject().service, ctx.remote.ecnuMusicStudio)
for (const cleanup of cleanups.reverse()) cleanup()
await dispose()
assert.equal(tab, null); assert.equal(slot, null); assert.ok(unmounted)
console.log('Built native client: module loader, Typert descriptor, independent sidebar registration and disposal passed')
