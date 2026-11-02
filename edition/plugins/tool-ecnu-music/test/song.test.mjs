import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, readdir, open, symlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { exportMusicSong } from '../lib/song.js'
import { wave } from './audio-fixture.mjs'
const abc = 'X:1\nT:Sample\nM:4/4\nL:1/4\nQ:1/4=86\nK:C\nC E G c | G E C2 |]'
async function workspace(t) { const root = await mkdtemp(join(tmpdir(), 'music-song-')); t.after(() => rm(root, { recursive: true, force: true })); await writeFile(join(root, 'audio.wav'), wave()); return root }

test('song export preserves audio bytes, lyrics and ABC in a portable directory without base64 audio', async t => {
  const root = await workspace(t), lyrics = '[Verse]\r\n晨光\n\n[Chorus]\n飞翔 <script>alert(1)</script>'
  await writeFile(join(root, 'audio.wav'), wave(70)) // Cross the streaming-copy chunk boundary.
  const args = { abc, lyrics, audio_path: 'audio.wav', title: '校园 <歌>', style: 'Acoustic choir' }
  const one = await exportMusicSong({ root, args }), two = await exportMusicSong({ root, args })
  assert.notEqual(one.directory, two.directory)
  assert.deepEqual((await readdir(one.directory)).sort(), ['audio.wav','index.html','lyrics.txt','score.abc','song-timeline.js','timeline.json'])
  assert.deepEqual(await readFile(join(one.directory,'audio.wav')), await readFile(join(root,'audio.wav')))
  assert.equal(one.audioPath, join(one.directory, 'audio.wav'))
  assert.equal(one.audioRelativePath, one.relativePath.replace(/index\.html$/, 'audio.wav'))
  assert.equal(one.audioMime, 'audio/wav')
  assert.deepEqual(await readFile(join(root, one.audioRelativePath)), await readFile(one.audioPath))
  assert.equal(await readFile(join(one.directory,'lyrics.txt'),'utf8'), lyrics)
  assert.equal(await readFile(join(one.directory,'score.abc'),'utf8'), abc)
  const html = await readFile(one.path,'utf8')
  assert.ok(Buffer.byteLength(html) < 600000)
  assert.equal(/(?:src|href)=["']data:audio|https?:\/\/school|audio_path|abc_path/.test(html), false, 'No embedded audio, service URL or source paths in the output')
  assert.match(html, /src="audio.wav"/)
  assert.equal(JSON.parse(html.match(/<script id="song-data"[^>]*>([^]*?)<\/script>/)[1]).lyrics, lyrics)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test('song export rejects invalid inputs, escaped paths and oversized audio; removes only its failed new bundle', async t => {
  const root = await workspace(t), outside = await workspace(t), args = { abc, lyrics: '歌词', audio_path: 'audio.wav' }
  for (const patch of [{lyrics:''},{lyrics:'a'.repeat(16001)},{title:'a'.repeat(121)},{style:'a'.repeat(2001)},{audio_path:'https://example.org/a.wav'},{abc_path:'score.abc'},{unknown:1}]) await assert.rejects(exportMusicSong({root,args:{...args,...patch}}))
  await symlink(join(outside,'audio.wav'),join(root,'linked.wav'))
  await assert.rejects(exportMusicSong({root,args:{...args,audio_path:'linked.wav'}}), /inside/)
  await writeFile(join(root,'fake.wav'),'not a WAVE file')
  await assert.rejects(exportMusicSong({root,args:{...args,audio_path:'fake.wav'}}), /header/)
  const large = await open(join(root,'large.wav'),'w'); await large.truncate(128*1024*1024+1); await large.close()
  await assert.rejects(exportMusicSong({root,args:{...args,audio_path:'large.wav'}}), /regular/)
  const signal = AbortSignal.abort(); await assert.rejects(exportMusicSong({root,args,signal}), /abort/i)
  assert.deepEqual(await readdir(join(root,'.eduwork/generated/music')), [])
  assert.deepEqual(await readFile(join(root,'audio.wav')), wave())
})

test('timeline export binds audio and ABC; stale import cleans up only the new output',async t=>{
  const root=await workspace(t),args={abc,lyrics:'唱一句',audio_path:'audio.wav'}
  const one=await exportMusicSong({root,args}),timeline=JSON.parse(await readFile(join(one.directory,'timeline.json'),'utf8'))
  timeline.durationMs=2000;timeline.lyrics={status:'reviewed',source:'manual',cues:[{text:'唱一句',startMs:200,endMs:1800}]}
  await writeFile(join(root,'timing.json'),JSON.stringify(timeline))
  const two=await exportMusicSong({root,args:{...args,timeline_path:'timing.json'}})
  assert.equal(two.timelineStatus,'reviewed');assert.equal(two.audioSha256,one.audioSha256)
  assert.equal(JSON.parse((await readFile(two.path,'utf8')).match(/<script id="song-data"[^>]*>([^]*?)<\/script>/)[1]).timeline.lyrics.cues[0].text,'唱一句')
  const before=await readdir(join(root,'.eduwork/generated/music'))
  await assert.rejects(exportMusicSong({root,args:{...args,abc:abc+'\n',timeline_path:'timing.json'}}),/同一版本/)
  assert.deepEqual(await readdir(join(root,'.eduwork/generated/music')),before)
})
