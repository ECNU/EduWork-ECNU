// Credential qualification only. Never builds or publishes an EduWork release.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes, createHash, X509Certificate } from 'node:crypto'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { validateContext, validateCertificate, validateSignedDetails, validateNotaryResult } from './policy.mjs'

const exec = promisify(execFile)
const policy = JSON.parse(await readFile(new URL('../../macos-signing.json', import.meta.url)))
const env = process.env
const reportRoot = resolve(env.RUNNER_TEMP ?? '.', 'ecnu-macos-signing-report')
const work = resolve(env.RUNNER_TEMP ?? '.', 'ecnu-macos-signing-private')
const keychain = join(work, 'signing.keychain-db')
const report = {schemaVersion: 1, repository: policy.repository, teamId: policy.teamId,
  certificateSHA256: policy.certificateSHA256, runId: env.GITHUB_RUN_ID,
  sourceCommit: env.GITHUB_SHA, arch: process.arch, scope: 'synthetic-probe-only', passed: false, checks: {}}
let originalKeychains, keychainCreated = false, stage = 'context'

// execFile errors contain argv (including passwords). Never log those error objects.
async function command(label, executable, args, options = {}) {
  stage = label
  try { return await exec(executable, args, {maxBuffer: 8 * 1024 * 1024, ...options}) }
  catch (error) {
    if (typeof error.code === 'number') report.commandExitCode = error.code
    const http = String(error.stderr ?? '').match(/HTTP status code:\s*(\d{3})/i)
    if (http) report.httpStatus = Number(http[1])
    throw new Error(`Signing preflight failed at ${label}`)
  }
}
async function json(path, value) { await writeFile(path, JSON.stringify(value, null, 2) + '\n') }

try {
  validateContext(env, policy)
  for (const name of ['ECNU_MACOS_CERTIFICATE_P12', 'ECNU_MACOS_CERTIFICATE_PASSWORD']) assert(env[name], `${name} is not configured`)
  if (env.NOTARIZE_PROBE === 'true') for (const name of ['ECNU_APPLE_ID', 'ECNU_APPLE_APP_PASSWORD']) assert(env[name], `${name} is not configured`)
  await mkdir(reportRoot, {recursive: true})
  await mkdir(work, {recursive: false, mode: 0o700})
  const p12 = join(work, 'identity.p12')
  await writeFile(p12, Buffer.from(env.ECNU_MACOS_CERTIFICATE_P12, 'base64'), {mode: 0o600})
  const {stdout: pem} = await command('certificate inspection', '/usr/bin/openssl', ['pkcs12', '-in', p12, '-clcerts', '-nokeys', '-passin', 'env:ECNU_MACOS_CERTIFICATE_PASSWORD'])
  const identity = validateCertificate(pem, policy)
  report.checks.certificateIdentity = 'passed'
  const list = await command('read keychain list', '/usr/bin/security', ['list-keychains', '-d', 'user'])
  originalKeychains = [...list.stdout.matchAll(/"([^"\n]+)"/g)].map(match => match[1])
  assert(originalKeychains.length, 'Existing keychain search list could not be read')
  const password = randomBytes(48).toString('base64url')
  await command('create temporary keychain', '/usr/bin/security', ['create-keychain', '-p', password, keychain])
  keychainCreated = true
  await command('configure temporary keychain', '/usr/bin/security', ['set-keychain-settings', '-lut', '21600', keychain])
  await command('unlock temporary keychain', '/usr/bin/security', ['unlock-keychain', '-p', password, keychain])
  await command('import signing identity', '/usr/bin/security', ['import', p12, '-k', keychain, '-P', env.ECNU_MACOS_CERTIFICATE_PASSWORD, '-T', '/usr/bin/codesign', '-T', '/usr/bin/security'])
  await command('configure signing access', '/usr/bin/security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', password, keychain])
  await command('set temporary keychain search', '/usr/bin/security', ['list-keychains', '-d', 'user', '-s', keychain, ...originalKeychains])
  await rm(p12)
  delete env.ECNU_MACOS_CERTIFICATE_P12
  delete env.ECNU_MACOS_CERTIFICATE_PASSWORD
  let valid = await command('check trusted signing identity', '/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning', keychain])
  if (!valid.stdout.includes(identity)) {
    // A P12 produced outside macOS may contain only the leaf. Add its actual
    // Apple-issued intermediate without changing system trust or adding a root.
    stage = 'retrieve Apple Developer ID intermediate'
    const response = await fetch('https://www.apple.com/certificateauthority/DeveloperIDG2CA.cer', {redirect: 'error'})
    assert(response.ok, 'Apple intermediate download failed')
    const der = Buffer.from(await response.arrayBuffer())
    assert(der.length < 65536, 'Unexpected intermediate size')
    const intermediate = new X509Certificate(der), leaf = new X509Certificate(pem)
    assert(intermediate.ca && leaf.checkIssued(intermediate) && leaf.verify(intermediate.publicKey), 'Intermediate does not authenticate the pinned certificate')
    const ca = join(work, 'DeveloperIDG2CA.cer')
    await writeFile(ca, der, {mode: 0o600})
    await command('import Apple intermediate', '/usr/bin/security', ['import', ca, '-k', keychain])
    valid = await command('check completed signing chain', '/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning', keychain])
  }
  assert(valid.stdout.includes(identity), 'Identity is not trusted for code signing on macOS')
  report.checks.macOSCodeSigningTrust = 'passed'
  const app = join(work, 'EduWork Signing Probe.app')
  await mkdir(join(app, 'Contents/MacOS'), {recursive: true})
  await writeFile(join(work, 'probe.c'), 'int main(void) { return 0; }\n')
  await command('compile synthetic probe', '/usr/bin/xcrun', ['clang', join(work, 'probe.c'), '-o', join(app, 'Contents/MacOS/probe')])
  await writeFile(join(app, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${policy.probeBundleId}</string><key>CFBundleName</key><string>EduWork Signing Probe</string><key>CFBundleExecutable</key><string>probe</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string></dict></plist>\n`)
  await command('sign synthetic probe', '/usr/bin/codesign', ['--force', '--sign', identity, '--keychain', keychain, '--timestamp', '--options', 'runtime', app])
  await command('verify synthetic probe', '/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app])
  const details = await command('inspect signed probe', '/usr/bin/codesign', ['--display', '--verbose=4', app])
  validateSignedDetails(details.stdout + details.stderr, policy)
  report.checks.developerIDTimestampHardenedRuntime = 'passed'
  await command('execute signed probe', join(app, 'Contents/MacOS/probe'), [])
  report.checks.nativeExecution = 'passed'
  if (env.NOTARIZE_PROBE === 'true') {
    const profile = 'ecnu-preflight'
    await command('validate notarization credentials', '/usr/bin/xcrun', ['notarytool', 'store-credentials', profile, '--apple-id', env.ECNU_APPLE_ID, '--team-id', policy.teamId, '--password', env.ECNU_APPLE_APP_PASSWORD, '--keychain', keychain, '--validate'])
    delete env.ECNU_APPLE_ID
    delete env.ECNU_APPLE_APP_PASSWORD
    report.checks.notarizationCredentials = 'passed'
    const temporaryZip = join(work, 'submission.zip')
    await command('archive probe for notarization', '/usr/bin/ditto', ['-c', '-k', '--keepParent', app, temporaryZip])
    const submitted = await command('notarize synthetic probe', '/usr/bin/xcrun', ['notarytool', 'submit', temporaryZip, '--keychain-profile', profile, '--keychain', keychain, '--wait', '--output-format', 'json'])
    const result = JSON.parse(submitted.stdout)
    report.notarizationSubmissionId = result.id
    validateNotaryResult(result)
    const log = await command('read notarization log', '/usr/bin/xcrun', ['notarytool', 'log', result.id, '--keychain-profile', profile, '--keychain', keychain])
    const parsed = JSON.parse(log.stdout)
    assert.equal(parsed.status, 'Accepted')
    report.notarizationIssues = (parsed.issues ?? []).map(issue => ({severity: issue.severity, code: issue.code, message: issue.message}))
    await command('staple probe ticket', '/usr/bin/xcrun', ['stapler', 'staple', app])
    await command('validate probe ticket', '/usr/bin/xcrun', ['stapler', 'validate', app])
    const archive = join(work, 'final.zip')
    // Match the existing desktop ZIP flags, then test the extracted ticket.
    await command('rebuild stapled ZIP', '/usr/bin/ditto', ['-c', '-k', '--norsrc', '--noextattr', '--noacl', '--keepParent', app, archive])
    const extracted = join(work, 'extracted')
    await command('extract final ZIP', '/usr/bin/ditto', ['-x', '-k', archive, extracted])
    const finalApp = join(extracted, 'EduWork Signing Probe.app')
    await command('verify final app', '/usr/bin/codesign', ['--verify', '--deep', '--strict', finalApp])
    await command('verify extracted ticket', '/usr/bin/xcrun', ['stapler', 'validate', finalApp])
    await command('Gatekeeper assessment', '/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=2', finalApp])
    report.checks.notarization = 'passed'
    report.checks.stapleSurvivesArchive = 'passed'
    report.checks.gatekeeperAssessment = 'passed'
    report.probeArchiveSHA256 = createHash('sha256').update(await readFile(archive)).digest('hex')
  } else report.checks.notarization = 'not-requested'
  report.passed = true
} catch (error) {
  report.failureStage = stage
  // Assertions and subprocess outputs are not copied, since they may include credentials.
  console.error(`macOS signing preflight failed at: ${stage}`)
  process.exitCode = 1
} finally {
  let clean = true
  if (originalKeychains) try { await exec('/usr/bin/security', ['list-keychains', '-d', 'user', '-s', ...originalKeychains]) } catch { clean = false }
  if (keychainCreated) try { await exec('/usr/bin/security', ['delete-keychain', keychain]) } catch { clean = false }
  if (process.platform === 'darwin' && env.RUNNER_TEMP) try { await rm(work, {recursive: true, force: true}) } catch { clean = false }
  report.checks.credentialsCleanup = clean ? 'passed' : 'failed'
  if (!clean) { report.passed = false; process.exitCode = 1 }
  if (env.RUNNER_TEMP && process.platform === 'darwin') { await mkdir(reportRoot, {recursive: true}); await json(join(reportRoot, 'preflight.json'), report) }
}
