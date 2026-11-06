import test from 'node:test'
import assert from 'node:assert/strict'
import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { collectCandidateFailure } from '../release/collect-candidate-failure.mjs'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8R0AAAAASUVORK5CYII=', 'base64')
// Assemble deliberately fake secret-shaped inputs at runtime so source audits
// keep rejecting actual credential literals without exempting this test file.
const syntheticSecret = name => [name, 'secret', '942'].join('-')
const privateKeyBoundary = kind => ['-----' + kind, 'PRIVATE KEY-----'].join(' ')
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'ecnu-evidence-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const candidate = join(root, 'ew-candidate')
  const gui = join(candidate, 'gui')
  await mkdir(join(gui, 'data/logs'), { recursive: true })
  const output = join(candidate, 'evidence-public/failure-diagnostics')
  const env = {
    GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'ECNU/EduWork-ECNU',
    GITHUB_EVENT_NAME: 'workflow_dispatch', RUNNER_ENVIRONMENT: 'github-hosted',
    ECNU_CI_FIRST_LAUNCH: 'true', RUNNER_TEMP: root,
    EDUWORK_CORE_ROOT: process.env.EDUWORK_CORE_ROOT,
  }
  const put = (name, value) => writeFile(join(gui, name), typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value)
  return { root, candidate, gui, output, env, put }
}

test('keeps missing evidence explicit without copying configuration, credentials or other files', async t => {
  const f = await fixture(t)
  await f.put('eduwork.jsonc', 'private configuration')
  await f.put('data/credentials.json', 'private credential')
  await f.put('data/logs/other.log', 'unapproved file')
  await f.put('stdout.log', 'startup diagnostic\n')
  const report = await collectCandidateFailure(f.env)
  assert.deepEqual((await readdir(f.output)).sort(), ['collection.json', 'stdout.log'])
  assert.equal(report.files.find(row => row.source === 'gui/result.json').status, 'missing')
  assert.equal(report.files.filter(row => row.status === 'included').length, 1)
  assert.equal(await readFile(join(f.output, 'stdout.log'), 'utf8'), 'startup diagnostic\n')
})

test('filters environment values, Bearer headers, structured secrets and PEM blocks while retaining errors', async t => {
  const f = await fixture(t)
  f.env.TEST_TOKEN = 'environment-secret-941'
  f.env.TEST_API_KEY = 'environment / escaped+secret'
  f.env.TEST_PIN = '123123'
  await f.put('result.json', {
    passed: false, scope: 'launch-only', phase: 'renderer-ready',
    error: 'Timeout 20000ms exceeded', client_secret: syntheticSecret('json'),
    nested: { authorization: 'Bearer structured-secret', message: f.env.TEST_TOKEN },
    [f.env.TEST_TOKEN]: 'value', number: 123123,
  })
  await f.put('stderr.log', [
    'Startup failed: configuration download timeout',
    'Authorization: Bearer ' + syntheticSecret('header'),
    'message: ' + f.env.TEST_TOKEN,
    'encoded: ' + encodeURIComponent(f.env.TEST_API_KEY),
    'SECRET=assignment-secret-944', 'PIN=000999',
    privateKeyBoundary('BEGIN'), 'synthetic-private-material', privateKeyBoundary('END'),
    'eyJhbGciOiJub25lIn0.eyJzdWIiOiJleGFtcGxlIn0.signature',
    JSON.stringify({ message: 'Host error', requestBody: { messages: ['private-conversation'] } }),
  ].join('\n'))
  const report = await collectCandidateFailure(f.env)
  assert.equal(report.files.find(row => row.source === 'gui/result.json').status, 'included')
  const json = JSON.parse(await readFile(join(f.output, 'result.json'), 'utf8'))
  assert.equal(json.error, 'Timeout 20000ms exceeded')
  assert.equal(json.client_secret, '[REDACTED]')
  assert.equal(json.nested.message, '[REDACTED]')
  assert.equal(json['[REDACTED]'], '[REDACTED]')
  assert.equal(json.number, '[REDACTED]')
  assert(!JSON.stringify(json).includes(f.env.TEST_TOKEN))
  const log = await readFile(join(f.output, 'stderr.log'), 'utf8')
  for (const value of [syntheticSecret('header'), f.env.TEST_TOKEN, encodeURIComponent(f.env.TEST_API_KEY), 'assignment-secret-944', '000999', 'synthetic-private-material', 'eyJhbGci', 'private-conversation']) assert(!log.includes(value), value)
  assert.match(log, /configuration download timeout/u)
  assert.match(log, /Host error/u)
})

test('rejects unsafe CI contexts before creating output', async t => {
  const f = await fixture(t)
  for (const [key, value] of Object.entries({
    GITHUB_ACTIONS: 'false', GITHUB_REPOSITORY: 'ECNU/EduWork', GITHUB_EVENT_NAME: 'pull_request',
    RUNNER_ENVIRONMENT: 'self-hosted', ECNU_CI_FIRST_LAUNCH: 'false', RUNNER_TEMP: '../outside',
  })) await assert.rejects(collectCandidateFailure({ ...f.env, [key]: value }))
  await assert.rejects(readdir(f.output), { code: 'ENOENT' })
})

test('refuses hard-linked files and linked source directories even when the target is readable', async t => {
  const f = await fixture(t)
  const outside = join(f.root, 'private')
  await mkdir(outside)
  await writeFile(join(outside, 'startup-error.log'), 'outside-private-value')
  await link(join(outside, 'startup-error.log'), join(f.gui, 'stdout.log'))
  await rm(join(f.gui, 'data/logs'), { recursive: true })
  await symlink(outside, join(f.gui, 'data/logs'), process.platform === 'win32' ? 'junction' : 'dir')
  const report = await collectCandidateFailure(f.env)
  assert.equal(report.files.find(row => row.source === 'gui/stdout.log').status, 'refused')
  assert.equal(report.files.find(row => row.source === 'gui/data/logs/startup-error.log').status, 'refused')
  assert.deepEqual(await readdir(f.output), ['collection.json'])
})

test('refuses linked candidate and output roots without writing outside the candidate', async t => {
  for (const location of ['ew-candidate', 'ew-candidate/evidence-public']) {
    const f = await fixture(t)
    const outside = join(f.root, 'private')
    await mkdir(outside)
    const destination = join(f.root, location)
    await rm(destination, { recursive: true, force: true })
    await symlink(outside, destination, process.platform === 'win32' ? 'junction' : 'dir')
    await assert.rejects(collectCandidateFailure(f.env))
    assert.deepEqual(await readdir(outside), [])
  }
})

test('only preserves screenshots for a failed launch-only receipt', async t => {
  for (const [receipt, expected] of [
    [{ passed: false, scope: 'launch-only' }, true],
    [{ passed: true, scope: 'launch-only' }, false],
    [{ passed: false, scope: 'full-desktop' }, false],
    ['invalid-json', false],
  ]) {
    const f = await fixture(t)
    await f.put('result.json', receipt)
    await f.put('failed-desktop.png', png)
    await collectCandidateFailure(f.env)
    assert.equal((await readdir(f.output)).includes('failed-desktop.png'), expected)
  }
})

test('bounds input/output, skips oversized JSON/images and drops partial log lines/PEM tails', async t => {
  const f = await fixture(t)
  await f.put('result.json', { passed: false, scope: 'launch-only' })
  await f.put('failed-desktop-ui.json', { text: 'x'.repeat(128 * 1024) })
  await f.put('failed-desktop.png', Buffer.alloc(2 * 1024 * 1024 + 1))
  await f.put('stdout.log', 'x'.repeat(256 * 1024) + '\npartial-private-key\n-----END PRIVATE KEY-----\nHost startup failed\n')
  await f.put('stderr.log', 'x'.repeat(128 * 1024))
  const report = await collectCandidateFailure(f.env)
  assert.equal(report.files.find(row => row.source === 'gui/failed-desktop-ui.json').status, 'too-large')
  assert.equal(report.files.find(row => row.source === 'gui/failed-desktop.png').status, 'too-large')
  assert.equal(report.files.find(row => row.source === 'gui/stdout.log').truncated, true)
  const log = await readFile(join(f.output, 'stdout.log'), 'utf8')
  assert(!log.includes('partial-private-key'))
  assert(!log.includes('xxx'))
  assert.match(log, /Host startup failed/u)
  assert.equal(await readFile(join(f.output, 'stderr.log'), 'utf8'), '[oversized diagnostic line omitted]')
  assert(report.totalBytes <= 3 * 1024 * 1024)
})

test('will not overwrite an earlier evidence collection', async t => {
  const f = await fixture(t)
  await collectCandidateFailure(f.env)
  const original = await readFile(join(f.output, 'collection.json'))
  await f.put('stdout.log', 'new content')
  await assert.rejects(collectCandidateFailure(f.env), { code: 'EEXIST' })
  assert.deepEqual(await readFile(join(f.output, 'collection.json')), original)
  assert.deepEqual(await readdir(f.output), ['collection.json'])
})

test('enforces the combined budget and the post-redaction text limit', async t => {
  const f = await fixture(t)
  await f.put('result.json', { passed: false, scope: 'launch-only' })
  for (const name of ['stdout.log', 'stderr.log', 'app.stdout.log', 'app.stderr.log', 'data/logs/startup-error.log', 'data/logs/desktop-host.log']) {
    await f.put(name, ('x'.repeat(63) + '\n').repeat(2048))
  }
  let text = ('x'.repeat(1024) + '\n').repeat(127)
  text += 'x'.repeat(128 * 1024 - Buffer.byteLength(JSON.stringify({ text }, null, 2) + '\n'))
  for (const name of ['failed-desktop-ui.json', 'data/logs/desktop-start.json']) await f.put(name, { text })
  const largePNG = Buffer.alloc(2 * 1024 * 1024)
  png.copy(largePNG)
  await f.put('failed-desktop.png', largePNG)
  const report = await collectCandidateFailure(f.env)
  assert.equal(report.files.find(row => row.source === 'gui/failed-desktop.png').status, 'budget-exhausted')
  assert(report.totalBytes <= 3 * 1024 * 1024)

  const expansion = await fixture(t)
  expansion.env.TEST_TOKEN = 'x'
  await expansion.put('stdout.log', ('x'.repeat(63) + '\n').repeat(2048))
  const expanded = await collectCandidateFailure(expansion.env)
  assert.equal(expanded.files.find(row => row.source === 'gui/stdout.log').status, 'too-large-after-redaction')
  assert.deepEqual(await readdir(expansion.output), ['collection.json'])
})
