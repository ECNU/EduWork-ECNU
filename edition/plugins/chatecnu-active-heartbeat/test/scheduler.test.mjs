import test from 'node:test'
import assert from 'node:assert/strict'
import { HeartbeatScheduler } from '../lib/scheduler.js'

function fixture(respond = () => ({ state: 'ok', nextHeartbeatIn: 600 })) {
  let now = 100000
  const requests = []
  const scheduler = new HeartbeatScheduler({ now: () => now, random: () => 0, send: async body => { requests.push(body); return respond() } })
  const presence = (id = 'tab-1', active = true) => scheduler.presence({ id, active, locale: 'zh-CN', timezone: 'Asia/Shanghai' })
  return { scheduler, requests, presence, advance: ms => { now += ms } }
}

test('foreground interval, multi-tab deduplication, background pause and resume', async () => {
  const f = fixture()
  await f.presence(); await f.presence('tab-2')
  assert.equal(f.requests.length, 1)
  for (let n = 0; n < 24; n++) { f.advance(25000); await f.presence() }
  assert.equal(f.requests.length, 2)
  await f.presence('tab-1', false)
  assert.deepEqual(f.requests.map(r => r.state), ['active', 'active', 'background'])
  f.advance(3600000); await f.scheduler.tick()
  assert.equal(f.requests.length, 3)
  await f.presence()
  assert.equal(f.requests.at(-1).state, 'active')
})

test('crashed WebView lease expires and plugin disposal stops activity', async () => {
  const f = fixture()
  await f.presence(); f.advance(75001); await f.scheduler.tick()
  assert.equal(f.requests.at(-1).state, 'background')
  f.scheduler.dispose(); await f.presence(); f.advance(999999); await f.scheduler.tick()
  assert.equal(f.requests.length, 2)
})

test('network failure backs off exponentially, online recovery retries once', async () => {
  let fail = true
  const f = fixture(() => ({ state: fail ? 'retry' : 'ok', nextHeartbeatIn: 600 }))
  await f.presence(); f.advance(14999); await f.presence(); assert.equal(f.requests.length, 1)
  f.advance(1); await f.presence(); assert.equal(f.requests.length, 2)
  f.advance(25000); await f.presence(); assert.equal(f.requests.length, 2)
  fail = false
  await f.scheduler.presence({ id: 'tab-1', active: true, recovered: true })
  assert.equal(f.requests.length, 3); assert.equal(f.scheduler.failures, 0)
})

test('login_required/rejected/disabled never spin; account change resumes', async () => {
  for (const state of ['signed_out', 'login_required', 'rejected', 'disabled', 'local_error']) {
    let result = state
    const f = fixture(() => ({ state: result }))
    await f.presence()
    for (let i = 0; i < 40; i++) { f.advance(25000); await f.presence() }
    assert.equal(f.requests.length, 1)
    result = 'ok'; await f.scheduler.accountChanged(); assert.equal(f.requests.length, 2)
  }
})

test('a stale 401 completing after successful login cannot block the new session', async () => {
  let finish
  const f = fixture(() => new Promise(resolve => { finish = resolve }))
  const first = f.presence()
  void f.scheduler.accountChanged()
  finish({ state: 'login_required' }); await first
  assert.equal(f.scheduler.blocked, false)
  const second = f.scheduler.tick()
  assert.equal(f.requests.length, 2)
  finish({ state: 'ok', nextHeartbeatIn: 600 }); await second
  assert.equal(f.scheduler.outcome, 'ok')
})

test('in-flight heartbeats serialize and a foreground change is preserved', async () => {
  let finish
  const f = fixture(() => new Promise(resolve => { finish = resolve }))
  const first = f.presence()
  void f.presence('tab-2')
  void f.presence('tab-1', false); void f.presence('tab-2', false)
  assert.equal(f.requests.length, 1)
  finish({ state: 'ok', nextHeartbeatIn: 600 }); await first
  const next = f.scheduler.tick()
  assert.equal(f.requests.length, 2); assert.equal(f.requests[1].state, 'background')
  finish({ state: 'ok' }); await next
})

test('reauthorization clears the old login failure even while no window is active', async () => {
  const f = fixture(() => ({ state: 'login_required' }))
  await f.presence()
  await f.presence('tab-1', false)
  assert.equal(f.scheduler.outcome, 'login_required')
  await f.scheduler.accountChanged()
  assert.equal(f.scheduler.outcome, 'waiting')
  assert.equal(f.scheduler.blocked, false)
  assert.equal(f.requests.length, 1, 'background reauthorization does not invent foreground activity')
})
