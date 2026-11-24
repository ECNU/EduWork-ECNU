import test from 'node:test'
import assert from 'node:assert/strict'
import { QUERY_ACCESS, selectQueryScopes } from '../lib/query-access.js'
import { READ_OPERATIONS } from '../../ecnu-aiconsole/lib/operations.js'

test('query consent covers all registered reads and never presents write scopes', () => {
  const scopes = QUERY_ACCESS.map(item => item.scope)
  assert.deepEqual([...new Set(Object.values(READ_OPERATIONS).map(item => item.scope))].sort(), [...scopes].sort())
  assert.ok(scopes.every(scope => scope.endsWith('.read')))
  assert.equal(new Set(scopes).size, scopes.length)
})

test('selection requires availability and explicit intent, excludes old grants and injected write scopes', () => {
  const grant = { supported: true, available: ['account.read', 'usage.read', 'tokens.read', 'tokens.write', 'requests.cancel'], granted: ['account.read'] }
  assert.deepEqual(selectQueryScopes([], grant), [])
  assert.deepEqual(selectQueryScopes(['tokens.write', 'requests.cancel', 'account.read', 'usage.read', 'usage.read', 'orders.read', 'tokens.read'], grant), ['usage.read', 'tokens.read'])
  assert.deepEqual(selectQueryScopes(['usage.read'], { ...grant, supported: false }), [])
  for (const value of [undefined, null, {}, { supported: true }, { ...grant, granted: null }]) assert.deepEqual(selectQueryScopes(['usage.read'], value), [])
})
