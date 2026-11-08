import assert from 'node:assert/strict'
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const TEXT_LIMIT = 128 * 1024
const IMAGE_LIMIT = 2 * 1024 * 1024
const TOTAL_LIMIT = 3 * 1024 * 1024
const files = [
  ['gui/result.json', 'json'],
  ['gui/failed-desktop-ui.json', 'json'],
  ['gui/stdout.log', 'log'], ['gui/stderr.log', 'log'],
  ['gui/app.stdout.log', 'log'], ['gui/app.stderr.log', 'log'],
  ['gui/data/logs/desktop-start.json', 'json'],
  ['gui/data/logs/startup-error.log', 'log'],
  ['gui/data/logs/desktop-host.log', 'log'],
  ['gui/failed-desktop.png', 'png'],
]
const sensitive = /token|secret|password|passwd|credential|(?:api|private|ssh|signing)[_-]?key|authorization|cookie|(?:^|_)(?:pin|auth|key)$|access[_-]?key/iu
const privateContent = /^(?:messages|prompt|requestBody|responseBody|body|bootstrap)$/iu

// Resolve only fixed relative names, checking every directory (including junctions).
async function checkedPath(root, name) {
  assert(!isAbsolute(name) && !name.split(/[\\/]/u).some(part => part === '..' || !part), 'Invalid evidence path')
  let current = root
  const parts = name.split('/')
  for (const [index, part] of parts.entries()) {
    current = join(current, part)
    const info = await lstat(current)
    assert(!info.isSymbolicLink(), 'Linked evidence path')
    if (index < parts.length - 1) assert(info.isDirectory(), 'Invalid evidence directory')
  }
  const rel = relative(root, await realpath(current))
  assert(rel && !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep), 'Evidence outside candidate')
  return current
}

function makeRedactor(redactDiagnostic, environment) {
  const values = Object.entries(environment)
    .filter(([key, value]) => sensitive.test(key) && typeof value === 'string' && value.length)
    .flatMap(([, value]) => [value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)])
  const secrets = [...new Set(values)].sort((a, b) => b.length - a.length)
  return text => {
    let result = String(text)
      .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/gu, '[REDACTED PRIVATE KEY]')
      // A bounded log tail may begin inside a PEM block.
      .replace(/^[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/u, '[REDACTED PRIVATE KEY]')
    // Bound individual lines before the shared redactor's pattern matching.
    // Long opaque payloads are not useful first-launch diagnostics.
    result = result.split(/\r?\n/u).map(line => line.length > 4096 ? '[oversized diagnostic line omitted]' : line).join('\n')
    result = redactDiagnostic(result)
      .replace(/((?:secret|pin|private[_-]?key|access[_-]?key[_-]?id)["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'[^']*'|[^\r\n,;}&]+)/giu, '$1[REDACTED]')
    for (const secret of secrets) result = result.split(secret).join('[REDACTED]')
    return result
  }
}

function redactJSON(value, redact) {
  if (typeof value === 'string') return redact(value)
  if (Array.isArray(value)) return value.map(child => redactJSON(child, redact))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    redact(key), sensitive.test(key) || privateContent.test(key) ? '[REDACTED]' : redactJSON(child, redact),
  ]))
  if (typeof value === 'number' && redact(String(value)) !== String(value)) return '[REDACTED]'
  return value
}

async function readEvidence(root, name, kind) {
  const path = await checkedPath(root, name)
  const before = await lstat(path)
  assert(before.isFile() && before.nlink === 1, 'Evidence must be an unlinked regular file')
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const info = await file.stat()
    assert(info.isFile() && info.nlink === 1 && info.dev === before.dev && info.ino === before.ino, 'Evidence changed during collection')
    await checkedPath(root, name)
    const limit = kind === 'png' ? IMAGE_LIMIT : TEXT_LIMIT
    if (kind !== 'log' && info.size > limit) return { status: 'too-large', sourceBytes: info.size }
    const start = kind === 'log' ? Math.max(0, info.size - limit) : 0
    const bytes = Buffer.alloc(Math.min(limit, info.size))
    const { bytesRead } = await file.read(bytes, 0, bytes.length, start)
    let body = bytes.subarray(0, bytesRead)
    if (kind !== 'png') {
      body = body.toString('utf8')
      // Do not publish partial first lines, which can contain partial secrets.
      if (start) body = body.slice(body.indexOf('\n') < 0 ? body.length : body.indexOf('\n') + 1)
    }
    return { status: 'included', sourceBytes: info.size, truncated: start > 0, body }
  } finally { await file.close() }
}

/** Only the hosted, isolated, account-free candidate first launch is eligible. */
export async function collectCandidateFailure(environment = process.env) {
  assert.equal(environment.GITHUB_ACTIONS, 'true', 'CI evidence collection only')
  assert.equal(environment.GITHUB_REPOSITORY, 'ECNU/EduWork-ECNU', 'School repository only')
  assert.equal(environment.GITHUB_EVENT_NAME, 'workflow_dispatch', 'Candidate dispatch only')
  assert.equal(environment.RUNNER_ENVIRONMENT, 'github-hosted', 'Hosted runner only')
  assert.equal(environment.ECNU_CI_FIRST_LAUNCH, 'true', 'Isolated first-launch evidence only')
  assert(environment.RUNNER_TEMP && isAbsolute(environment.RUNNER_TEMP), 'Missing runner temporary directory')
  assert(environment.EDUWORK_CORE_ROOT && isAbsolute(environment.EDUWORK_CORE_ROOT), 'Missing pinned core')
  const { redactDiagnostic } = await import(pathToFileURL(join(environment.EDUWORK_CORE_ROOT, 'dsh-host/diagnostics.mjs')).href)
  const redact = makeRedactor(redactDiagnostic, environment)
  const runner = await realpath(environment.RUNNER_TEMP)
  const candidate = await checkedPath(runner, 'ew-candidate')
  assert((await lstat(candidate)).isDirectory(), 'Invalid candidate directory')
  try { await mkdir(join(candidate, 'evidence-public')) }
  catch (error) { if (error.code !== 'EEXIST') throw error }
  const evidence = await checkedPath(candidate, 'evidence-public')
  assert((await lstat(evidence)).isDirectory(), 'Invalid evidence directory')
  const output = join(evidence, 'failure-diagnostics')
  // Never reuse/overwrite a previous collection, or follow an existing output link.
  await mkdir(output)
  const report = { schemaVersion: 1, scope: 'isolated-ci-first-launch-failure', files: [] }
  let total = 0, failedLaunchOnly = false
  for (const [name, kind] of files) {
    const entry = { source: name, status: 'missing' }
    report.files.push(entry)
    if (kind === 'png' && !failedLaunchOnly) { entry.status = 'not-failed-launch-only'; continue }
    try {
      const { body, ...status } = await readEvidence(candidate, name, kind)
      Object.assign(entry, status)
      if (body === undefined) continue
      let result
      if (kind === 'json') {
        let value
        try { value = JSON.parse(body) }
        catch { entry.status = 'invalid-json'; continue }
        if (name === 'gui/result.json') failedLaunchOnly = value?.scope === 'launch-only' && value?.passed === false
        result = Buffer.from(JSON.stringify(redactJSON(value, redact), null, 2) + '\n')
      } else if (kind === 'log') result = Buffer.from(redact(body))
      else {
        if (!body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) { entry.status = 'invalid-png'; continue }
        result = body
      }
      if (result.length > (kind === 'png' ? IMAGE_LIMIT : TEXT_LIMIT)) { entry.status = 'too-large-after-redaction'; continue }
      if (total + result.length > TOTAL_LIMIT) { entry.status = 'budget-exhausted'; continue }
      await writeFile(join(output, basename(name)), result, { flag: 'wx', mode: 0o600 })
      entry.output = basename(name)
      entry.bytes = result.length
      total += result.length
    } catch (error) {
      // Never expose source contents, absolute paths, environment or error messages.
      entry.status = error.code === 'ENOENT' ? 'missing' : 'refused'
    }
  }
  report.totalBytes = total
  await writeFile(join(output, 'collection.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    assert.equal(process.argv.length, 2, 'No arbitrary input/output paths accepted')
    const report = await collectCandidateFailure()
    console.log(JSON.stringify({ collected: report.files.filter(file => file.status === 'included').length, bytes: report.totalBytes }))
  } catch {
    console.error('Candidate failure evidence collection refused or unavailable; original build failure is unchanged.')
    process.exitCode = 1
  }
}
