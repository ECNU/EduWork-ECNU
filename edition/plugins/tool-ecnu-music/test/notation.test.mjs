import test from 'node:test'
import assert from 'node:assert/strict'
import abcjs from '../vendor/abcjs/abcjs.cjs'
import { prepareScoreNotation } from '../lib/score-notation.js'

const abc = 'X:1\nT:Z4 stays in the title\nM:4/4\nL:1/4\nQ:1/4=120\nV:lead name="Melody"\nV:ins name="Instrument"\nK:C\n[V:lead] "C"C4|D4|E4|F4|"G"G4|A4|B4|c4|\n[V:ins] Z4|G,4|A,4|B,4|C4|\n% Z123 is a comment\n'

test('expands only parsed multi-bar rests, retains source offsets and original voice/chord events', () => {
  const prepared = prepareScoreNotation(abc, abcjs)
  assert.equal(prepared.expandedRests, 1)
  assert.ok(prepared.abc.includes('[V:ins] Z|Z|Z|Z|G,4'))
  assert.ok(prepared.abc.includes('T:Z4 stays in the title'))
  assert.ok(prepared.abc.includes('% Z123 is a comment'))
  const source = abcjs.parseOnly(abc)[0], visual = prepared.apply(abcjs.parseOnly(prepared.abc))[0]
  for (const chordsOff of [true, false]) assert.deepEqual(visual.setUpAudio({ chordsOff }), source.setUpAudio({ chordsOff }))
  const notes = visual.lines.flatMap(l => (l.staff || []).flatMap(s => s.voices.flat().filter(e => e.pitches)))
  const originalNotes = source.lines.flatMap(l => (l.staff || []).flatMap(s => s.voices.flat().filter(e => e.pitches)))
  assert.deepEqual(notes.map(n=>[n.startChar,n.endChar]), originalNotes.map(n=>[n.startChar,n.endChar]))
  const ins = notes.find(n => abc.slice(n.startChar,n.endChar) === 'G,4')
  assert.ok(ins); assert.equal(ins.startChar, abc.indexOf('G,4'))
})

test('guards large expansion and preserves unchanged and multi-tune input', () => {
  assert.throws(() => prepareScoreNotation(abc.replace('[V:ins] Z4','[V:ins] Z99999'), abcjs), /超出排版限制/)
  const plain = abc.replace('[V:ins] Z4','[V:ins] Z')
  assert.equal(prepareScoreNotation(plain, abcjs).abc, plain)
  const two = 'X:1\nK:C\nZ2|C|\n\nX:2\nK:G\nZ4|G|'
  assert.equal(prepareScoreNotation(two, abcjs).abc, two)
})
