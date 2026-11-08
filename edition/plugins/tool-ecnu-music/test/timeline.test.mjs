import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyTimeline, validateTimeline, sampleTimeline, parseSubtitles } from '../lib/song-timeline.js'
const identity={audioSha256:'a'.repeat(64),abcSha256:'b'.repeat(64),abcLength:100}
function fixture(){const t=emptyTimeline(identity.audioSha256,identity.abcSha256);t.durationMs=10000;t.lyrics.cues=[{text:'同一句',startMs:1000,endMs:2000},{text:'同一句',startMs:4000,endMs:6000}];t.score.cues=[{startMs:1500,endMs:2500,startChar:10,endChar:15}];return t}
test('timeline samples gaps, boundaries, repeated lyrics and backward seeks without mutable clock state',()=>{
  const t=validateTimeline(fixture(),identity)
  for(const [ms,lyric,score,next]of[[0,-1,-1,0],[1000,0,-1,1],[1500,0,0,1],[2000,-1,0,1],[2500,-1,-1,1],[4000,1,-1,-1],[10000,-1,-1,-1],[1500,0,0,1]]){
    const s=sampleTimeline(t,ms);assert.deepEqual([s.lyricIndex,s.scoreIndex,s.nextIndex],[lyric,score,next]);assert.equal(s.progress,ms/10000)
  }
  assert.equal(sampleTimeline(t,-10).progress,0);assert.equal(sampleTimeline(t,20000).progress,1)
  assert.equal(sampleTimeline(t,1000).enterProgress,0);assert.equal(sampleTimeline(t,1150).enterProgress,.5)
})
test('timeline rejects stale identity, overlapping cues, out-of-range score and invalid review claims',()=>{
  for(const mutate of [t=>t.audioSha256='c'.repeat(64),t=>t.durationMs=20000,t=>t.lyrics.cues[1].startMs=1999,t=>t.lyrics.cues[0].startMs=-1,t=>t.lyrics.cues[1].endMs=10002,t=>t.score.cues[0].endChar=101,t=>t.lyrics.cues[0]=null,t=>{t.lyrics.cues=[];t.lyrics.status='reviewed'}]){
    const t=fixture();mutate(t);assert.throws(()=>validateTimeline(t,{...identity,durationMs:10000}))
  }
  assert.equal(validateTimeline(fixture(),{...identity,durationMs:10000}).lyrics.status,'draft')
})
test('SRT preserves explicit gaps; LRC blank markers end phrases; invalid clocks/duplicates are rejected',()=>{
  const srt='1\r\n00:00:01,000 --> 00:00:02,500\r\n一行\r\n第二行\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,000\r\n再唱'
  assert.deepEqual(parseSubtitles(srt,'srt',10000),[{text:'一行\n第二行',startMs:1000,endMs:2500},{text:'再唱',startMs:4000,endMs:6000}])
  assert.deepEqual(parseSubtitles('[00:01.00][00:04.00]重复\n[00:02.50]\n[00:06.00]','lrc',10000),[{text:'重复',startMs:1000,endMs:2500},{text:'重复',startMs:4000,endMs:6000}])
  assert.throws(()=>parseSubtitles('00:00:99,000 --> 00:02:00,000\n坏时间','srt',200000))
  assert.throws(()=>parseSubtitles('[offset:100]\n[00:01]词','lrc',10000))
  const t=fixture();t.lyrics.cues=parseSubtitles('[00:01]一\n[00:01]二','lrc',10000);assert.throws(()=>validateTimeline(t,identity))
})
