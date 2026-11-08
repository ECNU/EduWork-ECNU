import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {exportMusicSong} from '../lib/song.js'
import {wave} from './audio-fixture.mjs'
const root=resolve(process.env.MUSIC_SONG_OUTPUT_ROOT);await mkdir(root,{recursive:true});await writeFile(join(root,'test.wav'),wave(2))
const abc='X:1\nM:4/4\nL:1/4\nQ:1/4=120\nV:lead name="旋律"\nV:ins name="器乐"\nK:C\n[V:lead] "C"C4|D4|E4|F4|"G"G4|A4|B4|c4|\n[V:ins] Z4|G,4|A,4|B,4|C4|'
const artifact=await exportMusicSong({root,args:{audio_path:'test.wav',abc,lyrics:'多小节休止符与合奏验证',title:'声部对齐'}})
const {chromium}=createRequire(join(resolve(process.env.EDUWORK_TEST_RUNTIME),'package.json'))('playwright-core'),browser=await chromium.launch({headless:true,channel:'msedge'})
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.goto(pathToFileURL(artifact.path).href);await page.locator('#score-play:enabled').waitFor()
 const alignment=await page.evaluate(abc=>{
  const box=document.createElement('div');document.body.append(box)
  const prepared=prepareScoreNotation(abc,ABCJS)
  const tune=prepared.apply(ABCJS.renderAbc(box,prepared.abc,{staffwidth:600,oneSvgPerLine:true,wrap:{preferredMeasuresPerLine:2}}))[0]
  const offsets=[abc.indexOf('"G"G4'),abc.indexOf('G,4')],nodes=[]
  for(const line of tune.lines)for(const staff of line.staff||[])for(const voice of staff.voices)for(const e of voice)if(offsets.includes(e.startChar))nodes.push({start:e.startChar,x:e.abselem.x,line:[...box.querySelectorAll('svg')].indexOf(e.abselem.elemset.find(n=>n.closest)?.closest('svg'))})
  box.remove();return nodes
 },abc)
 assert.equal(alignment.length,2);assert.equal(alignment[0].line,alignment[1].line);assert.ok(Math.abs(alignment[0].x-alignment[1].x)<2)
 for(const size of ['1','1.5']){
  await page.locator('#score-size').selectOption(size);await page.waitForTimeout(200)
  await page.locator('#score-seek').evaluate(e=>{e.value='8.1';e.dispatchEvent(new Event('input'))});await page.locator('#score-play').click()
  await page.waitForFunction(()=>musicScorePlayer.getState().tracks.filter(t=>t.kind==='voice').every(t=>t.rms>.0001))
  assert.ok(await page.locator('.sheet-playing[data-score-track="0"]').count());assert.ok(await page.locator('.sheet-playing[data-score-track="1"]').count())
  const lineCount=await page.locator('#score .sheet-active').count();assert.equal(lineCount,1,'Both simultaneous voices must highlight the same staff system')
  await page.locator('#score-play').click()
 }
 assert.deepEqual(errors,[])
 const report={artifact,alignment,checks:['multi-bar rest occupies four engraved measures','simultaneous notes align horizontally and in one system','both original voices produce sound together','both highlights retain source offsets after expansion and zoom'],errors}
 await writeFile(join(root,'notation-checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await browser.close()}
