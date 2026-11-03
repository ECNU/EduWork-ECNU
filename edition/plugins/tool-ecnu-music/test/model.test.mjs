import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyForm, submission, fromItem } from '../src/model.ts'
const base = { ...emptyForm(), style: 'choral', lyrics: '希望', audio: 'audio/sample.wav', abc: 'X:1\nK:C\nC4|' }
test('form sends operation-specific parameters, random by omission and explicit seed zero', () => {
  assert.equal(submission(base, 'request').seed, undefined)
  assert.equal(submission({ ...base, seed: '0' }, 'request').seed, 0)
  assert.throws(() => submission({ ...base, seed: '9007199254740992' }, 'r'), /Seed/)
  assert.throws(() => submission({ ...base, cfg: '21' }, 'r'), /引导/)
  const cover = submission({ ...base, operation: 'cover', n: '2' }, 'r')
  for (const key of ['abc', 'cot', 'n', 'mode']) assert.equal(cover[key], undefined)
  const plan = submission({ ...base, operation: 'plan', n: '2', cot: 'off' }, 'r')
  assert.equal(plan.n, 1); assert.equal(plan.cot, 'full')
  assert.deepEqual(submission({ ...base, operation: 'transcribe', seed: '100', cfg: '7' }, 'r'), { operation: 'transcribe', request_id: 'r', audio: 'audio/sample.wav', mode: 'full' })
})
test('new version preserves supplied lyrics and original seed choice while linking its parent', () => {
  const copied = fromItem({ request_id: 'parent', title: '晨光', operation: 'generate', input: { lyrics: '歌词\n不改写', style: 'strings', seed: 0, abc: base.abc } })
  assert.equal(copied.lyrics, '歌词\n不改写'); assert.equal(copied.seed, '0')
  assert.equal(copied.parent_request_id, 'parent'); assert.equal(copied.abc, base.abc)
})
