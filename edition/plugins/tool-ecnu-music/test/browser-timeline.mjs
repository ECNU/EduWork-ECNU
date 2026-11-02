import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir,readFile,writeFile } from 'node:fs/promises'
import { join,resolve } from 'node:path'
import { exportMusicSong } from '../lib/song.js'
import { sampleTimeline } from '../lib/song-timeline.js'
import { createSongServer } from '../../../skills/ecnu-music/scripts/serve-song.mjs'
import { wave } from './audio-fixture.mjs'
const require=createRequire(join(resolve(process.env.EDUWORK_TEST_RUNTIME),'package.json')),{chromium}=require('playwright-core')
const root=resolve(process.env.MUSIC_SONG_OUTPUT_ROOT);await mkdir(root,{recursive:true});await writeFile(join(root,'sync.wav'),wave(10))
const abc='X:1\nT:Timeline test\nM:4/4\nL:1/4\nQ:1/4=86\nK:C\nC E G c | G E C2 |]'
const artifact=await exportMusicSong({root,args:{audio_path:'sync.wav',abc,title:'同一首歌，同一条时间轴',lyrics:'[Verse]\n晨光\n同一句\n同一句'}})
const timeline=JSON.parse(await readFile(join(artifact.directory,'timeline.json'),'utf8'))
timeline.durationMs=10000;timeline.lyrics={status:'draft',source:'synthetic fixture',cues:[{text:'晨光',startMs:1000,endMs:2000},{text:'同一句',startMs:3500,endMs:5000},{text:'同一句',startMs:6000,endMs:8000}]}
const note=abc.indexOf('\nC E')+1;timeline.score={status:'draft',source:'synthetic fixture',cues:[{startMs:1000,endMs:2000,startChar:note,endChar:note+1},{startMs:3500,endMs:5000,startChar:note+2,endChar:note+3}]}
const {server,record}=await createSongServer(artifact.directory),browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[]
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message))
  await page.goto(record.url);await page.locator('#score svg').first().waitFor();await page.waitForFunction(()=>Number.isFinite(document.querySelector('audio').duration))
  await page.locator('.advanced-sync > summary').click()
  assert.match(await page.locator('#lyrics-sync-state').textContent(),/待对齐/)
  const upload=async(value,name='timeline.json')=>{await page.locator('#timeline-import').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(typeof value==='string'?value:JSON.stringify(value))});await page.waitForFunction(()=>!document.querySelector('#timeline-warning').hidden)}
  await upload(timeline);assert.match(await page.locator('#lyrics-sync-state').textContent(),/草稿/)
  for(const ms of [0,1000,1500,2000,3500,6500,9000,10000,1500]){
    const actual=await page.evaluate(ms=>window.musicPresentation.renderAt(ms),ms),expected=sampleTimeline(timeline,ms)
    assert.deepEqual([actual.lyricIndex,actual.scoreIndex,actual.progress],[expected.lyricIndex,expected.scoreIndex,expected.progress])
    assert.equal(await page.locator('#lyrics .active-lyric').count(),expected.lyricIndex<0?0:1)
    if(expected.lyricIndex>=0)assert.equal(await page.locator('#lyrics .active-lyric').getAttribute('data-cue'),String(expected.lyricIndex))
    assert.equal((await page.locator('#score .time-active').count())>0,expected.scoreIndex>=0)
    if(ms===10000)assert.equal(await page.locator('#stage-current').textContent(),'播放结束')
  }
  const seek=async(seconds)=>{await page.locator('audio').evaluate((a,s)=>{a.currentTime=s},seconds);await page.waitForFunction(s=>Math.abs(document.querySelector('audio').currentTime-s)<.03,seconds);await page.waitForTimeout(50)}
  await seek(3.7);assert.equal(await page.locator('#stage-current').textContent(),'同一句')
  await page.locator('#score-size').selectOption('1.5');await page.waitForTimeout(250);assert.ok(await page.locator('#score .time-active').count())
  await seek(1.5);assert.equal(await page.locator('#stage-current').textContent(),'晨光')
  await page.locator('#speed').selectOption('1.5');await page.locator('#stage-play').click();await page.waitForFunction(()=>document.querySelector('audio').currentTime>2.2);await page.locator('#stage-play').click()
  const paused=await page.locator('audio').evaluate(a=>a.currentTime);await page.waitForTimeout(120);assert.equal(await page.locator('audio').evaluate(a=>a.currentTime),paused);assert.match(await page.locator('#stage-current').textContent(),/间奏/)
  await page.locator('#lyrics [data-cue="2"]').click();await page.waitForFunction(()=>document.querySelector('#lyrics .active-lyric')?.dataset.cue==='2');assert.equal(await page.locator('audio').evaluate(a=>a.currentTime),6)
  const old=await page.evaluate(()=>window.musicPresentation.getTimeline());await upload({...timeline,audioSha256:'0'.repeat(64)});assert.match(await page.locator('#timeline-warning').textContent(),/同一版本/);assert.deepEqual(await page.evaluate(()=>window.musicPresentation.getTimeline()),old)
  await upload('1\n00:00:01,000 --> 00:00:02,000\n晨光\n\n2\n00:00:03,500 --> 00:00:05,000\n同一句\n\n3\n00:00:06,000 --> 00:00:08,000\n同一句','lyrics.srt')
  assert.equal((await page.evaluate(()=>window.musicPresentation.getTimeline())).lyrics.status,'draft')
  await page.locator('#timing-editor summary').click();await seek(1.2);await page.locator('#timing-rows tr').first().getByRole('button',{name:'记录开始'}).click();await page.locator('#timing-reviewed').check();await page.locator('#timing-apply').click()
  const edited=await page.evaluate(()=>window.musicPresentation.getTimeline());assert.equal(edited.lyrics.status,'reviewed');assert.equal(edited.lyrics.cues[0].startMs,1200)
  const downloaded=page.waitForEvent('download');await page.locator('#timeline-download').click();const download=await downloaded
  const saved=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(saved.lyrics.status,'reviewed');assert.equal(saved.audioSha256,artifact.audioSha256)
  await writeFile(join(root,'timeline-reviewed.json'),JSON.stringify(saved));const reexport=await exportMusicSong({root,args:{audio_path:'sync.wav',abc,lyrics:'晨光\n同一句\n同一句',timeline_path:'timeline-reviewed.json'}});assert.equal(reexport.timelineStatus,'reviewed')
  await page.locator('#timing-editor summary').click();await seek(3.8);await page.locator('#song-stage').scrollIntoViewIfNeeded();await page.screenshot({path:join(root,'timeline-desktop.png'),fullPage:true})
  await page.setViewportSize({width:375,height:900});await page.locator('#portrait').click();await page.waitForTimeout(200)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.locator('#song-stage').screenshot({path:join(root,'timeline-portrait.png')})
  assert.deepEqual(errors,[])
  const report={artifact,checks:['loopback audio decoded and played','timeline import and draft status','same pure sampler and HTML state','boundaries, gaps, end and backward seek','repeated lyric identity','score note mapping after zoom','pause and playback speed','click lyric to seek','stale timeline rejected without replacing state','SRT draft import','manual record/apply/review','download and re-export same timeline','375px portrait no overflow'],errors}
  await writeFile(join(root,'timeline-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await browser.close();await new Promise(r=>{server.closeAllConnections();server.close(r)})}
