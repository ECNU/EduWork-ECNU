import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateContext, validateCertificate, validateSignedDetails, validateNotaryResult } from '../release/macos-signing/policy.mjs'
const policy = JSON.parse(await readFile(new URL('../macos-signing.json', import.meta.url)))
const env = {GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: policy.repository, GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_RUN_ID: '123', GITHUB_SHA: 'a'.repeat(40), NOTARIZE_PROBE: 'true'}
test('credential access is restricted to manual ECNU main runs', () => {
  validateContext(env, policy, 'darwin')
  for (const [key, value] of [['GITHUB_REPOSITORY', 'ECNU/EduWork'], ['GITHUB_REF', 'refs/pull/1/merge'], ['GITHUB_EVENT_NAME', 'pull_request'], ['GITHUB_ACTIONS', 'false'], ['GITHUB_RUN_ID', '../unsafe']]) {
    assert.throws(() => validateContext({...env, [key]: value}, policy, 'darwin'))
  }
  assert.throws(() => validateContext(env, policy, 'win32'))
})
test('ad-hoc, wrong team, missing runtime and missing timestamp are rejected', () => {
  const good = `Authority=${policy.identity}\nTeamIdentifier=${policy.teamId}\nCodeDirectory flags=0x10000(runtime)\nTimestamp=Nov 13, 2026\n`
  validateSignedDetails(good, policy)
  for (const bad of [good.replace(policy.teamId, 'OTHERTEAM1'), good.replace('TeamIdentifier='+policy.teamId, 'TeamIdentifier=OTHERTEAM1'), good.replace('(runtime)', '(none)'), good.replace('Timestamp=', 'NoTimestamp='), good+'Signature=adhoc\n']) assert.throws(() => validateSignedDetails(bad, policy))
})
test('only an explicit Accepted notarization is successful', () => {
  const id = 'a1234567-1234-1234-1234-123456789abc'
  assert.equal(validateNotaryResult({id, status: 'Accepted'}), id)
  for (const status of ['Invalid', 'In Progress', undefined]) assert.throws(() => validateNotaryResult({id, status}))
  assert.throws(() => validateNotaryResult({id: '../bad', status: 'Accepted'}))
})
test('invalid certificate data fails before keychain import', () => {
  assert.throws(() => validateCertificate('not a certificate', policy))
})
