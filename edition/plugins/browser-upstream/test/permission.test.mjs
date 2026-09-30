import test from 'node:test'
import assert from 'node:assert/strict'
import { apply, browserConfig } from '../lib/index.js'

test('official browser host code observes the current session sandbox without gating page interactions', () => {
  let mode = 'workspace-write', listener
  const session = {}
  const ctx = { on(event, handler) { assert.equal(event, 'tools/pre-execute'); listener = handler },
    sandboxPolicy: { resolve(request) { assert.equal(request.session, session); return { mode } } },
    plugin() { return 'mounted' },
  }
  assert.equal(apply(ctx, { executablePath: process.execPath }), 'mounted')
  const exec = { agent: { session }, name: 'mcp__playwright-mcp__browser_run_code_unsafe' }
  const next = () => ({ kind: 'allow' })
  for (mode of ['read-only', 'workspace-write']) assert.equal(listener(exec, next).kind, 'deny')
  mode = 'danger-full-access'
  assert.equal(listener(exec, next).kind, 'allow')
  assert.equal(listener({ ...exec, agent: undefined }, next).kind, 'deny')
  mode = 'read-only'
  for (const name of ['browser_navigate', 'browser_click', 'browser_evaluate']) {
    assert.equal(listener({ ...exec, name: 'mcp__playwright-mcp__' + name }, next).kind, 'allow')
  }
})

test('browser configuration binds a relocatable existing executable and validates explicit options', () => {
  assert.deepEqual(browserConfig({}, { DSH_MEDIA_BROWSER: process.execPath }), {
    mode: 'launch', headless: true, executablePath: process.execPath, toolCallTimeoutMs: 120000,
  })
  assert.equal(browserConfig({ headless: false, executablePath: process.execPath }).headless, false)
  for (const value of [999, 300001, '120000']) assert.throws(() => browserConfig({ executablePath: process.execPath, toolCallTimeoutMs: value }))
  assert.throws(() => browserConfig({ executablePath: process.execPath, headless: 'true' }), /boolean/)
  assert.throws(() => browserConfig({}, {}), /bundled Chromium/)
  assert.throws(() => browserConfig({ executablePath: process.execPath + '.missing' }), /bundled Chromium/)
})
