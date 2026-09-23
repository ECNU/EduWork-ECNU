import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire, registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

test('institution RPC declarations pass the selected official strict loader', async () => {
  assert.ok(process.env.EDUWORK_TEST_RUNTIME, 'Set EDUWORK_TEST_RUNTIME to an assembled Runtime')
  const entry = pathToFileURL(resolve(process.env.EDUWORK_TEST_RUNTIME, 'package.json')).href
  const require = createRequire(entry)
  const hook = registerHooks({ resolve(name, context, next) {
    return next(name, name === 'zod' ? { ...context, parentURL: entry } : context)
  } })
  try {
    const { validateTypertManifest } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-typert-loader')))
    for (const [folder, name] of [
      ['ecnu-account-resources', '@chatecnu-work/dsh-ecnu-account-resources'],
      ['chatecnu-active-heartbeat', '@chatecnu-work/dsh-chatecnu-active-heartbeat'],
    ]) {
      const module = await import(new URL(`../plugins/${folder}/lib/typert.host.js`, import.meta.url))
      validateTypertManifest(name, module.TYPERT)
      for (const invocation of module.TYPERT.invocations) {
        for (const codec of [invocation.result, ...invocation.parameters.map(parameter => parameter.codec)]) {
          // The two Host versions must see the same validation constraints.
          assert.equal(codec.create(), codec.schema)
        }
      }
    }
  } finally { hook.deregister() }
})
