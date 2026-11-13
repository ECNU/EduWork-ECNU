import assert from 'node:assert/strict'
import { X509Certificate } from 'node:crypto'

export function validateContext(env, policy, platform = process.platform) {
  assert.equal(platform, 'darwin', 'macOS runner required')
  assert.equal(env.GITHUB_ACTIONS, 'true')
  assert.equal(env.GITHUB_REPOSITORY, 'ECNU/EduWork-ECNU')
  assert.equal(policy.repository, env.GITHUB_REPOSITORY)
  assert.equal(env.GITHUB_REF, 'refs/heads/main')
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch')
  assert.match(env.GITHUB_RUN_ID, /^[1-9][0-9]*$/)
  assert.match(env.GITHUB_SHA, /^[a-f0-9]{40}$/)
  assert.equal(policy.schemaVersion, 1)
  assert.equal(policy.environment, 'macos-signing')
  assert.equal(policy.probeBundleId, 'cn.edu.ecnu.eduwork.signing-probe')
  assert.match(policy.teamId, /^[A-Z0-9]{10}$/)
  assert.match(policy.certificateSHA256, /^[a-f0-9]{64}$/)
  assert.equal(policy.identity, `Developer ID Application: East China Normal University (${policy.teamId})`)
  assert(['true', 'false'].includes(env.NOTARIZE_PROBE))
}

export function validateCertificate(pem, policy, now = Date.now()) {
  const certificate = new X509Certificate(pem)
  assert.equal(certificate.fingerprint256.replaceAll(':', '').toLowerCase(), policy.certificateSHA256, 'Unexpected signing certificate')
  const fields = Object.fromEntries(certificate.subject.split('\n').map(line => { const p = line.indexOf('='); return [line.slice(0, p), line.slice(p + 1)] }))
  assert.equal(fields.CN, policy.identity)
  assert.equal(fields.OU, policy.teamId)
  assert(!certificate.ca)
  assert(Date.parse(certificate.validFrom) <= now && now < Date.parse(certificate.validTo), 'Signing certificate outside validity period')
  assert(certificate.keyUsage.includes('1.3.6.1.5.5.7.3.3'), 'Code Signing EKU required')
  return certificate.fingerprint.replaceAll(':', '').toUpperCase()
}

export function validateSignedDetails(details, policy) {
  assert(details.includes(`Authority=${policy.identity}\n`), 'Developer ID authority mismatch')
  assert(details.includes(`TeamIdentifier=${policy.teamId}\n`), 'Team ID mismatch')
  assert(/flags=.*\(.*runtime.*\)/.test(details), 'Hardened Runtime missing')
  assert(/^Timestamp=.+$/m.test(details), 'Secure timestamp missing')
  assert(!details.includes('Signature=adhoc'), 'Ad-hoc signature rejected')
}

export function validateNotaryResult(result) {
  assert.match(result.id ?? '', /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i)
  assert.equal(result.status, 'Accepted', 'Apple notarization was not accepted')
  return result.id
}
