import test from 'node:test'
import assert from 'node:assert/strict'
import { Context, Service } from '@deepseek-ai/cordis'
import * as Registry from '@deepseek-ai/dsh-typert-registry/client'
import * as Gateway from '@deepseek-ai/dsh-api-gateway/client'
import contribution from '../lib/typert.remote-client.js'
test('official Gateway accepts import cancellation without serializing signals as business input', async t => {
  const ctx = new Context(), fibers = [], calls = []
  t.after(async () => { for (const fiber of fibers.toReversed()) await fiber.dispose() })
  fibers.push(await ctx.plugin(Registry))
  fibers.push(await ctx.plugin(class extends Service {
    constructor(ctx) {
      super(ctx, 'connection'); this.interactions = 'none'; this.isLoopback = true; this.generation = { getSnapshot: () => undefined }
      this.rpc = { open: async function* () {}, call: async (path, endpoint, payload, signal) => { calls.push({ path, endpoint, payload, signal }); return { ok: true, value: { state: 'available', sessionID: 'session-synthetic', workspaceID: 'workspace', reused: false } } } }
    }
  }))
  fibers.push(await ctx.plugin(Gateway))
  const unmount = await ctx.remote.$mount(contribution); t.after(unmount)
  const controller = new AbortController(), input = { lease: '11111111-1111-4111-8111-111111111111', conversationID: 'cloud-one', workspaceID: 'workspace', snapshot: 'a'.repeat(64) }
  assert.equal((await ctx.remote.ecnuCloud.cloudImport(input, controller.signal)).ok, true)
  assert.equal(calls.length, 1); assert.equal(calls[0].endpoint, 'ecnuCloud/cloudImport')
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].payload)), { args: { input } })
  controller.abort(); assert.equal(calls[0].signal.aborted, true)
})
