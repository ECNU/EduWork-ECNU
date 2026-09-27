import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as delay } from 'node:timers/promises'
import { VisionRequestQueue } from '../lib/request-queue.js'
import { understandImage, resolveVisionConfig, retryDelay } from '../lib/vision.js'

const imageBytes = Buffer.from([137,80,78,71,13,10,26,10])
const options = { baseURL: 'https://test.invalid/v1', model: 'vision', imageBytes, prompt: 'observe' }
const ok = () => new Response(JSON.stringify({ choices: [{ message: { content: 'evidence' } }] }))

test('config bounds and compatibility defaults', () => {
  const config = resolveVisionConfig({}, {})
  assert.equal(config.maxConcurrentRequests, 1)
  assert.equal(config.maxRetries, 2)
  for (const value of [0, 65, 1.5, '2']) assert.throws(() => resolveVisionConfig({ maxConcurrentRequests: value }, {}))
  for (const value of [-1, 6, '2']) assert.throws(() => resolveVisionConfig({ maxRetries: value }, {}))
})

test('all conversations share the specialist limit; independent specialists do not block each other', async () => {
  const queue = new VisionRequestQueue(2)
  let active = 0, peak = 0
  const job = () => queue.run(async () => { active++; peak = Math.max(peak, active); await delay(5); active--; return 'ok' })
  assert.deepEqual(await Promise.all(Array.from({ length: 12 }, job)), Array(12).fill('ok'))
  assert.equal(peak, 2)
  const serial = new VisionRequestQueue(1)
  const other = new VisionRequestQueue(1)
  let release
  const occupied = serial.run(() => new Promise(resolve => { release = resolve }))
  await delay(0)
  assert.equal(await other.run(async () => 'independent'), 'independent')
  release(); await occupied
})

test('queued cancellation sends no request; errors release permits; disposal cancels active and queued work', async () => {
  const queue = new VisionRequestQueue(1)
  let release, called = 0
  const first = queue.run(() => new Promise(resolve => { release = resolve }))
  await delay(0)
  const controller = new AbortController()
  const waiting = queue.run(async () => { called++ }, controller.signal)
  const rejected = assert.rejects(waiting, { name: 'AbortError' })
  controller.abort(); await rejected
  release(); await first
  await assert.rejects(queue.run(async () => { throw Error('failure') }), /failure/)
  assert.equal(await queue.run(async () => 'next'), 'next')
  assert.equal(called, 0)
  const active = queue.run(signal => delay(10_000, undefined, { signal }))
  const pending = queue.run(async () => { called++ })
  const results = Promise.all([assert.rejects(active, { name: 'AbortError' }), assert.rejects(pending, { name: 'AbortError' })])
  await delay(0); queue.close(); await results
  await assert.rejects(queue.run(async () => { called++ }), { name: 'AbortError' })
  assert.equal(called, 0)
})

test('429 retries are bounded, cancel response bodies, and preserve evidence on recovery', async () => {
  let calls = 0, cancelled = 0
  const fetchImpl = async () => {
    if (++calls === 3) return ok()
    return new Response(new ReadableStream({ cancel() { cancelled++ } }), { status: 429, headers: { 'retry-after': '0' } })
  }
  assert.equal((await understandImage({ ...options, fetchImpl })).analysis, 'evidence')
  assert.equal(calls, 3); assert.equal(cancelled, 2)
  calls = 0
  await assert.rejects(understandImage({ ...options, fetchImpl: async () => {
    calls++; return new Response('secret error body', { status: 429, headers: { 'retry-after': '0' } })
  } }), error => /429/.test(error.message) && !error.message.includes('secret'))
  assert.equal(calls, 3)
})

test('Retry-After seconds and dates are honored; excessive waits and non-429 errors are not retried', async () => {
  assert.equal(retryDelay('2', 0), 2000)
  assert.equal(retryDelay('Thu, 01 Jan 1970 00:00:05 GMT', 0, 1000), 4000)
  assert.ok(retryDelay('invalid', 1) >= 2000)
  for (const status of [400, 401, 403, 500, 429]) {
    let calls = 0
    await assert.rejects(understandImage({ ...options, fetchImpl: async () => {
      calls++; return new Response('private', { status, headers: { 'retry-after': '120' } })
    } }), new RegExp(String(status)))
    assert.equal(calls, 1)
  }
})

test('cancellation interrupts retry backoff without another HTTP request', async () => {
  const controller = new AbortController()
  let calls = 0
  const result = understandImage({ ...options, signal: controller.signal, fetchImpl: async () => {
    calls++; setTimeout(() => controller.abort(), 10)
    return new Response('', { status: 429, headers: { 'retry-after': '30' } })
  } })
  await assert.rejects(result, { name: 'AbortError' })
  assert.equal(calls, 1)
})

