import test from 'node:test'
import assert from 'node:assert/strict'
import {sampleReading} from '../lib/song-timeline.js'
import {scoreAudioEvents} from '../lib/score-audio.js'
test('automatic reading has start/end holds and deterministic seek positions without inventing lyric cues',()=>{
  for(const [ms,expected]of [[0,0],[5000,0],[50000,.5],[95000,1],[100000,1],[25000,2/9],[-100,0]])assert.equal(sampleReading(ms,100000).progress,expected)
  assert.equal(sampleReading(100,NaN).progress,0);assert.equal(sampleReading(500,1000).progress,.5)
})
test('ABC audio sequence keeps polyphony, ignores program events and uses whole-note timing',()=>{
  const input={tempo:120,totalDuration:2,tracks:[[{cmd:'program'}, {cmd:'note',start:0,duration:.25,pitch:60,volume:100,startChar:20}],[{cmd:'note',start:0,duration:.5,pitch:48,volume:90,startChar:40}]]}
  const s=scoreAudioEvents(input);assert.equal(s.duration,4);assert.equal(s.notes.length,2);assert.deepEqual(s.notes.map(n=>n.end),[.5,1])
  assert.deepEqual(s.notes.map(n=>n.track),[0,1]);assert.deepEqual(s.tracks.map(t=>t.noteCount),[1,1])
  assert.throws(()=>scoreAudioEvents({...input,tempo:0}));assert.throws(()=>scoreAudioEvents({...input,tracks:[]}))
})
test('score tracks retain stable IDs across empty voices and distinguish generated harmony',()=>{
  const value=scoreAudioEvents({tempo:120,totalDuration:1,tracks:[[],[{cmd:'note',start:0,duration:1,pitch:60,volume:80,startChar:12}],[{cmd:'note',start:0,duration:1,pitch:48,volume:70}]]},[{}, {name:'器乐',kind:'voice'}, {name:'和弦伴奏',kind:'chords'}])
  assert.deepEqual(value.notes.map(n=>n.track),[1,2]);assert.deepEqual(value.tracks.map(t=>[t.id,t.name,t.kind]),[[1,'器乐','voice'],[2,'和弦伴奏','chords']])
})
