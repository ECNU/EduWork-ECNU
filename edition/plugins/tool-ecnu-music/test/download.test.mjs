import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { streamDownload } from '../lib/download.js'

async function target(t) {
  const root = await mkdtemp(join(tmpdir(), 'music-transfer-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return { root, path: join(root, 'audio.flac'), requestTimeoutMs: 250, idleTimeoutMs: 500,
    maximum: 1024 * 1024, assertCurrent() {} }
}
async function endpoint(t, handle) {
  const server = createServer(handle)
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)) })
  return signal => fetch(`http://127.0.0.1:${server.address().port}/audio`, { signal })
}

test('a real streamed HTTP transfer outlives the response deadline and writes exact bytes', async t => {
  const options = await target(t), chunks = Array.from({ length: 10 }, (_, i) => Buffer.alloc(8192, i))
  const fetchResponse = await endpoint(t, (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'audio/flac', 'Content-Length': 81920 }); res.flushHeaders()
    let i = 0
    const timer = setInterval(() => { res.write(chunks[i++]); if (i === chunks.length) { clearInterval(timer); res.end() } }, 100)
    res.on('close', () => clearInterval(timer))
  })
  const result = await streamDownload({ ...options, fetchResponse })
  assert.ok(result.elapsedMs > options.requestTimeoutMs * 3)
  assert.equal(result.bytes, 81920)
  assert.deepEqual(await readFile(options.path), Buffer.concat(chunks))
  assert.equal(result.sha256, createHash('sha256').update(Buffer.concat(chunks)).digest('hex'))
  assert.deepEqual(await readdir(options.root), ['audio.flac'])
})

test('a stream that stalls is aborted and its partial file is removed', async t => {
  const options = await target(t)
  const fetchResponse = await endpoint(t, (_req, res) => { res.writeHead(200); res.write('fLaC-start') })
  await assert.rejects(streamDownload({ ...options, fetchResponse }), e => e.code === 'MUSIC_DOWNLOAD_IDLE_TIMEOUT' && /10 bytes/.test(e.message))
  assert.deepEqual(await readdir(options.root), [])
})

test('waiting for response headers has a separate timeout', async t => {
  const options = await target(t), fetchResponse = await endpoint(t, () => {})
  await assert.rejects(streamDownload({ ...options, fetchResponse }), e => e.code === 'MUSIC_DOWNLOAD_RESPONSE_TIMEOUT')
  assert.deepEqual(await readdir(options.root), [])
})

test('caller cancellation stops a body read promptly and leaves no output', async t => {
  const options = await target(t), controller = new AbortController()
  const fetchResponse = await endpoint(t, (_req, res) => { res.writeHead(200); res.write('fLaC'); setTimeout(() => controller.abort({ reason: 'user-stop' }), 30) })
  await assert.rejects(streamDownload({ ...options, idleTimeoutMs: 5000, signal: controller.signal, fetchResponse }), e => e.name === 'AbortError')
  assert.deepEqual(await readdir(options.root), [])
})

test('pre-cancelled calls never open a network connection', async t => {
  const options = await target(t), controller = new AbortController(); controller.abort()
  await assert.rejects(streamDownload({ ...options, signal: controller.signal, fetchResponse() { throw Error('must not fetch') } }), e => e.name === 'AbortError')
  assert.deepEqual(await readdir(options.root), [])
})

for (const declared of [true, false]) test(`oversize ${declared ? 'declared' : 'streamed'} body never produces a file`, async t => {
  const options = await target(t)
  await assert.rejects(streamDownload({ ...options, maximum: 2, fetchResponse: async () => new Response('abc', { headers: declared ? { 'Content-Length': '3' } : {} }) }), /size limit/)
  assert.deepEqual(await readdir(options.root), [])
})

test('truncated and empty responses are not published', async t => {
  const options = await target(t)
  await assert.rejects(streamDownload({ ...options, fetchResponse: async () => new Response('ab', { headers: { 'Content-Length': '3' } }) }), /Incomplete/)
  await assert.rejects(streamDownload({ ...options, fetchResponse: async () => new Response('') }), /Empty/)
  assert.deepEqual(await readdir(options.root), [])
})

test('an account change during transfer prevents delivery and cleans the partial', async t => {
  const options = await target(t)
  await assert.rejects(streamDownload({ ...options, fetchResponse: async () => new Response('private song'), assertCurrent() { throw Error('Music account changed') } }), /account changed/)
  assert.deepEqual(await readdir(options.root), [])
})

test('publication and temporary-file collisions never overwrite existing files', async t => {
  const options = await target(t), fetchResponse = async () => new Response('new')
  await writeFile(options.path, 'previous')
  await assert.rejects(streamDownload({ ...options, fetchResponse }), { code: 'EEXIST' })
  assert.equal(await readFile(options.path, 'utf8'), 'previous')
  await writeFile(options.path + '.part', 'other transfer')
  await assert.rejects(streamDownload({ ...options, fetchResponse }), { code: 'EEXIST' })
  assert.equal(await readFile(options.path + '.part', 'utf8'), 'other transfer')
})
