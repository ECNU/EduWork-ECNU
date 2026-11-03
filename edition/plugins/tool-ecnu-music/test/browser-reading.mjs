import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {exportMusicSong} from '../lib/song.js'
import {wave} from './audio-fixture.mjs'
const root=resolve(process.env.MUSIC_SONG_OUTPUT_ROOT);await mkdir(root,{recursive:true});await writeFile(join(root,'reading.wav'),wave(12))
const lyrics=Array.from({length:8},(_,i)=>'[Verse '+(i+1)+']\n'+Array.from({length:6},(_,j)=>`第${i*6+j+1}句：把歌声留在每一个清晨`).join('\n')).join('\n\n')
const abc='X:1\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\nC E G c | G E C2 |]'
const artifact=await exportMusicSong({root,args:{audio_path:'reading.wav',abc,lyrics,title:'清晨的歌 · 完整歌词与乐谱'}})
const {chromium}=createRequire(join(resolve(process.env.EDUWORK_TEST_RUNTIME),'package.json'))('playwright-core'),b=await chromium.launch({headless:true,channel:'msedge'})
try{
  const p=await b.newPage({viewport:{width:1400,height:1000}}),errors=[],remote=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())})
  await p.goto(pathToFileURL(artifact.path).href);await p.waitForFunction(()=>Number.isFinite(document.querySelector('audio').duration));await p.locator('#score-play:enabled').waitFor()
  assert.equal(await p.locator('#lyrics p').count(),48);assert.equal(await p.locator('.advanced-sync').getAttribute('open'),null)
  await p.locator('#reading-auto').click();await p.evaluate(()=>musicPresentation.renderAt(6000))
  const half=await p.locator('#lyrics-scroll').evaluate(e=>e.scrollTop/(e.scrollHeight-e.clientHeight));assert.ok(Math.abs(half-.5)<.02)
  await p.evaluate(()=>musicPresentation.renderAt(12000));assert.equal(await p.locator('#lyrics-scroll').evaluate(e=>e.scrollTop+e.clientHeight>=e.scrollHeight-1),true)
  await p.evaluate(()=>musicPresentation.renderAt(0));assert.equal(await p.locator('#lyrics-scroll').evaluate(e=>e.scrollTop),0)
  await p.locator('#lyrics-scroll').dispatchEvent('wheel');assert.equal(await p.locator('#reading-auto').getAttribute('aria-pressed'),'false')
  await p.locator('audio').evaluate(a=>a.play());await p.locator('#score-play').click();await p.waitForFunction(()=>musicScorePlayer.getState().time>.15)
  assert.equal(await p.locator('audio').evaluate(a=>a.paused),true);assert.ok(await p.locator('#score .sheet-playing').count())
  const sounding=await p.evaluate(()=>musicScorePlayer.getState());assert.equal(sounding.contextState,'running');assert.ok(sounding.voices>0)
  await p.locator('#score-play').click();const paused=await p.evaluate(()=>musicScorePlayer.getState().time);await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>musicScorePlayer.getState().time),paused)
  await p.locator('#score-seek').evaluate(e=>{e.value='2.5';e.dispatchEvent(new Event('input'))});assert.equal(await p.evaluate(()=>musicScorePlayer.getState().time),2.5)
  await p.locator('#score-play').click();await p.locator('audio').evaluate(a=>a.play());assert.equal(await p.evaluate(()=>musicScorePlayer.getState().playing),false);assert.equal(await p.locator('#score .sheet-playing').count(),0);await p.locator('audio').evaluate(a=>a.pause())
  await p.locator('#score-stop').click();await p.locator('#score-size').selectOption('1.25');await p.waitForTimeout(200);await p.locator('#score-play').click();await p.waitForFunction(()=>musicScorePlayer.getState().time>.1);assert.ok(await p.locator('#score .sheet-playing').count());await p.locator('#score-play').click()
  await p.screenshot({path:join(root,'reading-desktop.png')})
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200)
  assert.equal(await p.locator('.score-card').isVisible(),false);assert.equal(await p.locator('.lyrics-card').isVisible(),true)
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  const player=await p.locator('.player').boundingBox();assert.ok(player.y>=0&&player.y+player.height<=844)
  await p.screenshot({path:join(root,'reading-mobile.png')})
  await p.locator('#mobile-score').click();assert.equal(await p.locator('.score-card').isVisible(),true);await p.locator('#score-play:enabled').waitFor();await p.locator('#mobile-score').click()
  await p.locator('#lyrics-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);assert.match(await p.locator('#lyrics p').last().textContent(),/第48句/)
  await p.emulateMedia({media:'print'});assert.equal(await p.locator('.score-card').isVisible(),true);assert.equal(await p.locator('#lyrics-scroll').evaluate(e=>getComputedStyle(e).overflowY),'visible')
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[])
  const report={artifact,checks:['all lyrics present without timestamps','bounded mobile lyric scroll and visible player','desktop score alongside lyrics','automatic reading start/middle/end/backseek','manual gesture stops auto reading','offline score has running audio context and scheduled voices','score highlight pause seek resize','song/score playback mutually exclusive','mobile score toggle','print includes full lyrics and score','no network requests'],errors};await writeFile(join(root,'reading-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await b.close()}
