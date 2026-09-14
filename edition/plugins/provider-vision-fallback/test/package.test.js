import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

test('provider plugin keeps fallback routing out of the agent-plane Tool lifecycle', () => {
  const source = fs.readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')
  assert.match(source, /enterpriseTransforms\.register/)
  assert.match(source, /attachments\.readImage/)
  assert.doesNotMatch(source, /tools\.register/)
  assert.match(source, /!inputModalities\.includes\('image'\)/)
  assert.doesNotMatch(source, /fallbackModels/)
  assert.doesNotMatch(source, /session\.append\(['"]user\/message/)
  assert.match(source, /PersistentVisionEvidenceStore/)
})
