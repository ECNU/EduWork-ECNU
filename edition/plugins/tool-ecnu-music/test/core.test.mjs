import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, readdir, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { resolveMusicConfig, normalizeSubmission, musicRequest, submitMusic, downloadMusic, readBounded } from '../lib/core.js'

const config = resolveMusicConfig({ baseURL: 'https://school.example.org/open/api/v1', oidcProfileId: 'school' })
const args = { operation: 'generate', style: '校园合唱', lyrics: '希望伴着我们生长' }
const auth = fetch => ({ fetch, assertCurrent() {} })
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'eduwork-music-'))
  t.after(() => rm(path, { recursive: true, force: true }))
  return path
}

test('normalization preserves lyrics and random default; validates each operation', () => {
  assert.equal(normalizeSubmission(args).body.seed, undefined)
  assert.equal(normalizeSubmission({ ...args, seed: null }).body.seed, undefined)
  assert.equal(normalizeSubmission({ ...args, seed: 0 }).body.seed, 0)
  assert.equal(normalizeSubmission({ ...args, lyrics: ' 歌词\n' }).body.lyrics, ' 歌词\n')
  assert.equal(normalizeSubmission({ ...args, n: 2, cot: 'off' }).body.n, 2)
  assert.throws(() => normalizeSubmission({ ...args, seed: 2 ** 53 }), /safe integer/)
  assert.throws(() => normalizeSubmission({ ...args, n: 3 }), /n=1 or 2/)
  assert.throws(() => normalizeSubmission({ ...args, operation: 'plan', n: 2 }), /plan/)
  assert.throws(() => normalizeSubmission({ ...args, operation: 'plan', cot: 'off' }), /cot/)
  assert.throws(() => normalizeSubmission({ ...args, operation: 'cover', audio: 'a.wav', n: 1 }), /not supported/)
  assert.throws(() => normalizeSubmission({ operation: 'transcribe', audio: 'a.wav', seed: 1 }), /not supported/)
  assert.throws(() => normalizeSubmission({ ...args, duration: 60 }), /not supported/)
  assert.throws(() => normalizeSubmission({ ...args, lyrics: '字'.repeat(16001) }), /16000/)
  assert.throws(() => normalizeSubmission({ ...args, cfg_scale: NaN }), /cfg_scale/)
  assert.equal(normalizeSubmission({ operation: 'transcribe', audio: 'a.wav' }).body.mode, 'full')
})

test('service configuration does not accept credential URLs or session references', () => {
  for (const baseURL of ['http://school.example.org/v1', 'https://user:secret@example.org/v1', 'https://example.org/v1?key=x', 'https://example.org/v1/music']) assert.throws(() => resolveMusicConfig({ baseURL }))
  assert.throws(() => resolveMusicConfig({ baseURL: config.baseURL, credentialRef: 'DSH_OIDC_SCHOOL' }), /oidcProfileId/)
  assert.throws(() => resolveMusicConfig({ baseURL: config.baseURL, apiKey: 'never-allowed' }), /Unknown/)
  assert.equal(resolveMusicConfig({ baseURL: 'http://127.0.0.1:1234/v1/' }).baseURL, 'http://127.0.0.1:1234/v1')
})

test('submit persists idempotency before network, resumes by GET, rejects changed parameters', async t => {
  const root = await directory(t), id = randomUUID(), calls = []
  const authorization = auth(async (url, init) => {
    calls.push([url, init.method])
    if (init.method === 'POST') {
      const receipt = JSON.parse(await readFile(join(root, '.eduwork/generated/music', `request-${id}.json`)))
      assert.equal(receipt.request_id, id)
      assert.equal(receipt.body, undefined)
      assert.equal(init.headers['Idempotency-Key'], id)
      assert.equal(JSON.parse(init.body).seed, undefined)
      return new Response('{"id":"job-1","status":"queued","seed":9223372036854775806}', { status: 202 })
    }
    return Response.json({ id: 'job-1', status: 'running' })
  })
  const request = { config, authorization, root, args: { ...args, request_id: id } }
  const first = await submitMusic(request)
  assert.equal(first.submission, 'accepted')
  assert.equal(first.job.seed, '9223372036854775806')
  assert.equal((await submitMusic(request)).resumed, true)
  await assert.rejects(submitMusic({ ...request, args: { ...request.args, lyrics: 'different' } }), /different/)
  assert.deepEqual(calls.map(row => row[1]), ['POST', 'GET'])
  assert.equal(calls[1][0], config.baseURL + '/music/jobs/job-1')
})

test('uncertain submission and concurrent identical submissions never replay POST', async t => {
  const root = await directory(t), id = randomUUID()
  let count = 0
  const request = { config, root, args: { ...args, request_id: id }, authorization: auth(async () => { count++; throw Error('Bearer should-never-appear') }) }
  const results = await Promise.all([submitMusic(request), submitMusic(request)])
  assert.equal(count, 1)
  for (const result of results) {
    assert.equal(result.submission, 'unknown')
    assert.doesNotMatch(JSON.stringify(result), /should-never-appear/)
  }
  assert.equal((await submitMusic(request)).submission, 'unknown')
  assert.equal(count, 1)
})

test('error diagnostics are bounded HTTP meanings, not raw upstream token-bearing text', async t => {
  const root = await directory(t)
  const authorization = auth(async () => new Response('secret upstream body', { status: 403 }))
  const result = await submitMusic({ config, root, authorization, args })
  assert.equal(result.httpStatus, 403)
  assert.match(result.diagnostic, /llm:invoke/)
  assert.doesNotMatch(JSON.stringify(result), /secret upstream/)
})

test('cover and transcription send actual multipart audio to their own routes', async t => {
  const root = await directory(t)
  await writeFile(join(root, '合唱.wav'), Buffer.from('RIFF-synthetic-audio'))
  const seen = []
  const authorization = auth(async (url, init) => {
    seen.push(url)
    assert.ok(init.body instanceof FormData)
    assert.equal(init.headers['Content-Type'], undefined, 'fetch owns the multipart boundary')
    assert.equal(init.body.get('model'), 'ecnu-music')
    assert.equal(await init.body.get('audio').text(), 'RIFF-synthetic-audio')
    if (url.endsWith('/covers')) { assert.equal(init.body.get('seed'), '0'); assert.equal(init.body.get('lyrics'), args.lyrics) }
    else assert.equal(init.body.get('mode'), 'melody')
    return Response.json({ id: randomUUID(), status: 'queued' }, { status: 202 })
  })
  assert.equal((await submitMusic({ config, root, authorization, args: { ...args, operation: 'cover', audio: '合唱.wav', seed: 0 } })).submission, 'accepted')
  assert.equal((await submitMusic({ config, root, authorization, args: { operation: 'transcribe', audio: '合唱.wav', mode: 'melody' } })).submission, 'accepted')
  assert.deepEqual(seen, [config.baseURL + '/music/covers', config.baseURL + '/music/transcriptions'])
})

test('downloads use listed names, not URLs; preserve ABC and avoid overwriting', async t => {
  const root = await directory(t), calls = []
  const authorization = auth(async (url) => {
    calls.push(url)
    if (url.endsWith('/artifacts')) return Response.json({ artifacts: [{ name: 'score.abc', url: 'https://evil.example/steal' }, { name: 'score.pdf' }] })
    return new Response('X:1\nT:School\nK:C\nCDEF|', { headers: { 'Content-Type': 'text/vnd.abc' } })
  })
  const request = { config, root, authorization, jobID: 'job-1', artifact: 'score.abc' }
  const a = await downloadMusic(request), b = await downloadMusic(request)
  assert.notEqual(a.path, b.path)
  assert.match(a.path, /score\.abc$/)
  assert.equal(a.mime, 'text/vnd.abc')
  assert.match(await readFile(a.path, 'utf8'), /X:1/)
  assert.ok(calls.every(url => url.startsWith(config.baseURL)))
  await assert.rejects(downloadMusic({ ...request, artifact: 'score.pdf' }), /non-PDF/)
  await assert.rejects(downloadMusic({ ...request, artifact: '../secret.json' }), /filename/)
  await assert.rejects(downloadMusic({ ...request, artifact: 'unlisted.json' }), /not in/)
  await assert.rejects(downloadMusic({ ...request, jobID: '../other' }), /job_id/)
})

test('workspace fences reject outside input and linked managed directories', async t => {
  const root = await directory(t), external = await directory(t)
  await writeFile(join(external, 'input.wav'), 'RIFF-synthetic')
  const authorization = auth(() => { throw Error('must not send') })
  await assert.rejects(submitMusic({ config, root, authorization, args: { ...args, operation: 'cover', audio: join(external, 'input.wav') } }), /inside/)
  await symlink(external, join(root, '.eduwork'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(submitMusic({ config, root, authorization, args }), /symlink/)
  assert.deepEqual(await readdir(external), ['input.wav'])
})

test('bounded reads cancel oversized streamed responses', async () => {
  let cancelled = false
  const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(20)) }, cancel() { cancelled = true } }))
  await assert.rejects(readBounded(response, 10), /size limit/)
  assert.equal(cancelled, true)
})

test('real HTTP fixture verifies JSON, multipart, cancel and redirect refusal', async t => {
  const root = await directory(t), received = []
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    received.push({ url: req.url, method: req.method, body: Buffer.concat(chunks).toString(), headers: req.headers })
    if (req.url.endsWith('/capabilities')) { res.writeHead(302, { Location: '/never-follow' }); res.end(); return }
    res.writeHead(req.url.endsWith('/cancel') ? 200 : 202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ id: 'fixture-job', status: req.url.endsWith('/cancel') ? 'cancelled' : 'queued' }))
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)) })
  const local = resolveMusicConfig({ baseURL: `http://127.0.0.1:${server.address().port}/open/api/v1` })
  const authorization = auth(fetch)
  await submitMusic({ config: local, authorization, root, args: { ...args, operation: 'plan' } })
  await writeFile(join(root, 'input.wav'), 'RIFF-synthetic')
  await submitMusic({ config: local, authorization, root, args: { operation: 'transcribe', audio: 'input.wav' } })
  await musicRequest(local, authorization, 'jobs/fixture-job/cancel', { method: 'POST' })
  await assert.rejects(musicRequest(local, authorization, 'capabilities'))
  assert.equal(received.length, 4)
  assert.match(received[1].headers['content-type'], /multipart\/form-data; boundary=/)
  assert.match(received[1].body, /RIFF-synthetic/)
  assert.equal(JSON.parse(received[0].body).model, 'ecnu-music')
  assert.deepEqual(received.map(row => row.url.split('/music/')[1]), ['plans', 'transcriptions', 'jobs/fixture-job/cancel', 'capabilities'])
})
