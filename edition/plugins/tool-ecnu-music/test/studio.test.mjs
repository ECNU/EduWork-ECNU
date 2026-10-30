import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile, readFile, symlink, mkdir } from 'node:fs/promises'
import { join, resolve, relative, isAbsolute } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { Session, SessionId, SESSION_FORMAT_VERSION } from '@deepseek-ai/dsh-session'
import * as music from '../lib/index.js'
import { musicLibrary, previewMusic } from '../lib/library.js'
import { resolveMusicConfig, submitMusic } from '../lib/core.js'
import { TYPERT } from '../lib/typert.host.js'

const config = resolveMusicConfig({ baseURL: 'https://school.example.org/v1', oidcProfileId: 'school' })
async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'music-studio-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('creative history preserves input and parent, excludes local metadata upstream and isolates service config', async t => {
  const root = await workspace(t), request_id = randomUUID(), parent = randomUUID()
  let sent
  const authorization = { assertCurrent() {}, async fetch(url, init) { sent = JSON.parse(init.body); return Response.json({ id: 'job-one', status: 'queued' }, { status: 202 }) } }
  await submitMusic({ root, config, authorization, args: { request_id, title: '合唱草稿', parent_request_id: parent, operation: 'generate', lyrics: '晨光和希望', style: 'choral', seed: 0 } })
  assert.equal(sent.title, undefined); assert.equal(sent.parent_request_id, undefined)
  const library = await musicLibrary(root, config)
  assert.equal(library.items[0].title, '合唱草稿')
  assert.equal(library.items[0].parent_request_id, parent)
  assert.equal(library.items[0].input.lyrics, '晨光和希望')
  assert.equal(library.items[0].input.seed, 0)
  assert.equal(library.items[0].job_id, 'job-one')
  assert.equal(library.items[0].status, 'pending_refresh')
  assert.equal((await musicLibrary(root, { ...config, oidcProfileId: 'another' })).items.length, 0)
  await writeFile(join(root, '.eduwork/generated/music', `request-${randomUUID()}.json`), 'invalid-json')
  assert.equal((await musicLibrary(root, config)).skipped, 1)
  assert.doesNotMatch(JSON.stringify(library), /credential|Bearer|fingerprint|binding/)
})

test('preview is bounded to regular managed audio and ABC files, with no receipt or symlink reads', async t => {
  const root = await workspace(t), dir = join(root, '.eduwork/generated/music')
  assert.deepEqual(await musicLibrary(root, config), { items: [], skipped: 0, truncated: false })
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'score.abc'), 'X:1\nK:C\nCDEF|')
  assert.equal((await previewMusic(root, '.eduwork/generated/music/score.abc')).encoding, 'utf8')
  await assert.rejects(previewMusic(root, '../score.abc'))
  await assert.rejects(previewMusic(root, '.eduwork/generated/music/request-secret.json'))
  await writeFile(join(root, 'outside.abc'), 'private workspace document')
  await symlink(join(root, 'outside.abc'), join(dir, 'linked.abc'))
  await assert.rejects(previewMusic(root, '.eduwork/generated/music/linked.abc'), /Invalid/)
  await writeFile(join(dir, 'large.abc'), Buffer.alloc(256 * 1024 + 1))
  await assert.rejects(previewMusic(root, '.eduwork/generated/music/large.abc'), /oversized/)
})

test('real Cordis Studio service dispatches through native tool policy, session workspace and Host authorization', async t => {
  const cwd = await workspace(t), ctx = new Context(), calls = [], checks = [], fibers = []
  const session = Session.create(SessionId('music-studio-test'), undefined, { version: SESSION_FORMAT_VERSION, isSeeded: false, id: SessionId('music-studio-test'), createdAt: Date.now(), cwd })
  const agent = { id: session.id, session }
  let narrowed = false
  ctx.provide('agents', { get: id => id === 'music-studio-test' ? agent : undefined })
  ctx.provide('credentials', { resolve() { throw Error('Renderer must not request key material') } })
  ctx.provide('permissionPresets', { current: () => 'workspace-write' })
  ctx.provide('sandboxPolicy', { resolve: () => ({ mode: 'workspace-write', ...(narrowed ? { workspaceRoot: join(cwd, 'narrow') } : {}) }) })
  ctx.provide('fs', { resolve: async (path, options) => resolve(options.cwd, path), processPath: path => path, contains: (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\') } })
  ctx.provide('oidcAccounts', { modelAuthorization: async () => true, async authorizedFetch(profile, url, init) {
    assert.equal(profile, 'school'); assert.equal(new Headers(init.headers).has('authorization'), false)
    calls.push({ url, method: init.method })
    return url.endsWith('/generations') ? Response.json({ id: 'studio-job', status: 'queued' }, { status: 202 }) : Response.json({ id: 'studio-job', status: 'succeeded' })
  } })
  t.after(async () => { for (const fiber of fibers.reverse()) await fiber.dispose() })
  for (const plugin of [SystemPrompt, ToolRuntime]) fibers.push(await ctx.plugin(plugin))
  ctx.on('tools/pre-execute', (exec, next) => { checks.push(exec.name); return next() })
  fibers.push(await ctx.plugin(music, config))
  assert.ok(ctx.ecnuMusicStudio, 'Studio remote service mounted')
  const args = { operation: 'generate', title: '接口创作', lyrics: '希望', style: 'orchestra', request_id: randomUUID() }
  const result = JSON.parse(await ctx.ecnuMusicStudio.execute('music-studio-test', 'submit', JSON.stringify(args)))
  assert.equal(result.submission, 'accepted')
  assert.deepEqual(checks, ['ecnu_music_submit'])
  assert.equal(calls.filter(c => c.method === 'POST').length, 1)
  assert.ok((await readFile(result.receiptPath, 'utf8')).includes('接口创作'))
  assert.equal(JSON.parse(await ctx.ecnuMusicStudio.execute('music-studio-test', 'library', '{}')).items.length, 1)
  await assert.rejects(ctx.ecnuMusicStudio.execute('other-session', 'submit', JSON.stringify(args)), /工作区/)
  await assert.rejects(ctx.ecnuMusicStudio.execute('music-studio-test', 'exec_command', '{}'), /Unsupported/)
  narrowed = true
  await assert.rejects(ctx.ecnuMusicStudio.execute('music-studio-test', 'submit', JSON.stringify({ ...args, request_id: randomUUID() })), /allowed|denied|permission|Music/i)
  assert.equal(calls.filter(c => c.method === 'POST').length, 1, 'denied request never reaches service')
  assert.deepEqual(TYPERT.invocations.map(x => x.method), ['execute', 'preview'])
})
