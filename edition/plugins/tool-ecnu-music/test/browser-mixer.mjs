import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {exportMusicSong} from '../lib/song.js'
import {wave} from './audio-fixture.mjs'
const root=resolve(process.env.MUSIC_SONG_OUTPUT_ROOT);await mkdir(root,{recursive:true});await writeFile(join(root,'mixer.wav'),wave(2))
const abc='X:1\nM:4/4\nL:1/4\nQ:1/4=120\nV:lead name="主旋律"\nV:ins clef=bass name="器乐声部"\nK:C\n[V:lead] "C"C16 | "G"G16 |]\n[V:ins] C,16 | G,,16 |]'
const artifact=await exportMusicSong({root,args:{audio_path:'mixer.wav',abc,lyrics:'合成测试',title:'分声部试听'}})
const {chromium}=createRequire(join(resolve(process.env.EDUWORK_TEST_RUNTIME),'package.json'))('playwright-core'),b=await chromium.launch({headless:true,channel:'msedge'})
try{
 const p=await b.newPage({viewport:{width:1400,height:1100}}),errors=[],remote=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url())})
 await p.goto(pathToFileURL(artifact.path).href);await p.locator('#score-play:enabled').waitFor()
 let state=await p.evaluate(()=>musicScorePlayer.getState());assert.equal(state.tracks.length,3);assert.deepEqual(state.tracks.map(t=>t.name),['主旋律','器乐声部','和弦伴奏']);assert.equal(state.tracks[2].kind,'chords');assert.equal(state.tracks[2].volume,50)
 assert.ok(state.tracks[0].pan<0&&state.tracks[1].pan>0);assert.notEqual(state.tracks[0].timbre,state.tracks[1].timbre)
 await p.locator('#score-play').click();await p.waitForFunction(()=>musicScorePlayer.getState().tracks.slice(0,2).every(t=>t.rms>.0001))
 const both=await p.evaluate(()=>musicScorePlayer.getState());assert.ok(await p.locator('.sheet-playing[data-score-track="0"]').count());assert.ok(await p.locator('.sheet-playing[data-score-track="1"]').count())
 await p.getByRole('button',{name:'独奏 器乐声部',exact:true}).click();await p.waitForFunction(()=>{const t=musicScorePlayer.getState().tracks;return t[1].rms>.0001&&t[0].rms<.00001&&t[2].rms<.00001})
 assert.equal(await p.locator('.sheet-playing[data-score-track="0"]').count(),0);assert.ok(await p.locator('.sheet-playing[data-score-track="1"]').count())
 await p.getByRole('button',{name:'播放全部声部',exact:true}).click();await p.waitForFunction(()=>musicScorePlayer.getState().tracks.slice(0,2).every(t=>t.rms>.0001))
 await p.locator('[data-track="1"] input[type=checkbox]').uncheck();await p.waitForFunction(()=>musicScorePlayer.getState().tracks[1].rms<.00001);assert.equal(await p.locator('.sheet-playing[data-score-track="1"]').count(),0)
 await p.locator('[data-track="0"] input[type=range]').evaluate(e=>{e.value='0';e.dispatchEvent(new Event('input'))});await p.waitForFunction(()=>musicScorePlayer.getState().tracks[0].rms<.00001)
 await p.locator('[data-track="0"] input[type=range]').evaluate(e=>{e.value='65';e.dispatchEvent(new Event('input'))});await p.getByRole('button',{name:'播放全部声部',exact:true}).click()
 await p.getByLabel('器乐声部 音色',{exact:true}).selectOption('round');await p.locator('#score-play').click();await p.locator('#score-size').selectOption('1.25');await p.waitForTimeout(200)
 state=await p.evaluate(()=>musicScorePlayer.getState());assert.equal(state.tracks[0].volume,65);assert.equal(state.tracks[1].timbre,'round')
 await p.locator('#score-seek').evaluate(e=>{e.value='9';e.dispatchEvent(new Event('input'))});await p.locator('#score-play').click();await p.waitForFunction(()=>musicScorePlayer.getState().tracks.slice(0,2).every(t=>t.rms>.0001))
 await p.locator('audio').evaluate(a=>a.play());assert.equal(await p.evaluate(()=>musicScorePlayer.getState().playing),false);await p.locator('audio').evaluate(a=>a.pause())
 await p.locator('.score-listen').screenshot({path:join(root,'mixer-desktop.png')})
 await p.setViewportSize({width:390,height:844});await p.locator('#mobile-score').click();await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.locator('.score-listen').screenshot({path:join(root,'mixer-mobile.png')})
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[])
 const report={artifact,bothTracksAudio:both.tracks,checks:['original voices remain separate','derived chord accompaniment labelled','both original voices output nonzero audio simultaneously','solo and mute change measured output','only audible voices highlighted','volume zero silences output','mixer settings survive score rerender','seek resumes both voices','song playback stops score','mobile layout and no network'],errors};await writeFile(join(root,'mixer-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await b.close()}
