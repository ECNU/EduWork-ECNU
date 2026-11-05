import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as NativeToolExecutor from '@deepseek-ai/dsh-tool-executor-native'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { Session, SessionId, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import * as music from '../lib/index.js'

test('conversation calls use native tool policy, session workspace and Host authorization', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'music-conversation-'))
  t.after(() => rm(cwd, { recursive: true, force: true }))
  const ctx = new Context(), calls = [], checks = [], fibers = []
  const id = SessionId('music-conversation-test')
  const session = Session.create(id, undefined, { version: SESSION_FORMAT_VERSION, isSeeded: false, id, createdAt: Date.now(), cwd })
  const agent = { id, session }
  let narrowed = false
  ctx.provide('credentials', { resolve() { throw Error('School tools must not read personal keys') } })
  ctx.provide('permissionPresets', { current: () => 'workspace-write' })
  ctx.provide('sandboxPolicy', { resolve: () => ({ mode: 'workspace-write', ...(narrowed ? { workspaceRoot: join(cwd, 'narrow') } : {}) }) })
  ctx.provide('fs', {
    resolve: async (path, options) => resolve(options.cwd, path), processPath: path => path,
    contains: (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\') },
  })
  ctx.provide('oidcAccounts', {
    modelAuthorization: async () => true,
    async authorizedFetch(profile, url, init) {
      assert.equal(profile, 'school')
      assert.equal(new Headers(init.headers).has('authorization'), false)
      calls.push({ url, method: init.method })
      return Response.json({ id: 'conversation-job', status: 'queued' }, { status: 202 })
    },
  })
  t.after(async () => { for (const fiber of fibers.reverse()) await fiber.dispose() })
  // Match rc.1's official composition: registration and execution are separate
  // services. Exercise the native batch dispatcher rather than bypassing policy.
  for (const plugin of [SystemPrompt, ToolRuntime, NativeToolExecutor]) fibers.push(await ctx.plugin(plugin))
  ctx.on('tools/pre-execute', (exec, next) => { checks.push(exec.name); return next() })
  fibers.push(await ctx.plugin(music, { baseURL: 'https://school.example.org/v1', oidcProfileId: 'school' }))
  const execute = async (action, args) => {
    const callId = randomUUID()
    const batch = await ctx.tools.execute({ agent, signal: new AbortController().signal,
      calls: [{ id: callId, name: `ecnu_music_${action}`, arguments: JSON.stringify(args) }] })
    assert.equal(batch.results.length, 1)
    assert.equal(batch.results[0].callId, callId)
    return batch.results[0].result
  }
  const args = { operation: 'generate', title: '对话创作', lyrics: '希望', style: 'orchestra', request_id: randomUUID() }
  const response = await execute('submit', args)
  assert.equal(response.isError, false, response.error?.message)
  const result = JSON.parse(response.value.reportJSON)
  assert.equal(result.submission, 'accepted')
  assert.deepEqual(checks, ['ecnu_music_submit'])
  assert.equal(calls.filter(c => c.method === 'POST').length, 1)
  assert.ok((await readFile(result.receiptPath, 'utf8')).includes('对话创作'))
  const library = await execute('library', {})
  assert.equal(library.isError, false, library.error?.message)
  assert.equal(JSON.parse(library.value.reportJSON).items.length, 1)
  narrowed = true
  const denied = await execute('submit', { ...args, request_id: randomUUID() })
  assert.equal(denied.isError, true)
  assert.match(denied.error.message, /allowed|denied|permission|Music/i)
  assert.equal(calls.filter(c => c.method === 'POST').length, 1, 'denied request never reaches service')
})
