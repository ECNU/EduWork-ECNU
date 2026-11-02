import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { exportMusicSong } from '../lib/song.js'
import { wave } from './audio-fixture.mjs'
const require = createRequire(join(resolve(process.env.EDUWORK_TEST_RUNTIME), 'package.json'))
const { chromium } = require('playwright-core')
const root = resolve(process.env.MUSIC_SONG_OUTPUT_ROOT || fileURLToPath(new URL('../dist/song-check', import.meta.url)))
await mkdir(root,{recursive:true})
let sourceRoot = root, args
if (process.env.MUSIC_SONG_INPUT) {
  const input = JSON.parse(await readFile(process.env.MUSIC_SONG_INPUT,'utf8')); sourceRoot=input.root; args=input.args
} else {
  await writeFile(join(root,'sample.wav'),wave(3))
  args={title:'晨光与远方',lyrics:'[Verse]\n晨光照进安静的课堂\n微风翻开青春的篇章\n\n[Chorus]\n向着远方 一起歌唱\n让希望乘着风飞翔',abc:'X:1\nM:4/4\nL:1/4\nQ:1/4=86\nK:C\nC E G c | G E C2 |]',audio_path:'sample.wav',style:'Mandarin campus anthem, warm mixed choir, acoustic orchestra.'}
}
const artifact=await exportMusicSong({root:sourceRoot,args})
// Test portability from a new directory, with all original paths inaccessible to the page.
const moved=join(root,'portable',basename(artifact.directory)); await cp(artifact.directory,moved,{recursive:true})
const browser=await chromium.launch({headless:true,channel:process.env.MUSIC_TEST_BROWSER_CHANNEL||'msedge'})
try {
  const page=await browser.newPage({viewport:{width:1440,height:1040}}),errors=[],requests=[]
  page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()))
  await page.goto(pathToFileURL(join(moved,'index.html')).href)
  await page.locator('#score svg').first().waitFor()
  await page.waitForFunction(()=>Number.isFinite(document.querySelector('audio').duration))
  const duration=await page.locator('audio').evaluate(a=>a.duration)
  assert.ok(duration>0);assert.equal(await page.locator('#audio-error').isVisible(),false)
  assert.equal(await page.locator('#status.error').count(),0)
  assert.ok((await page.locator('.abcjs-note').count())>0)
  assert.match(await page.locator('#meter').textContent(),/4\/4/)
  assert.equal(await page.locator('#meter').isVisible(),true)
  await page.locator('audio').evaluate(a=>a.play())
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.25)
  assert.equal(await page.locator('#play-state').textContent(),'正在播放')
  await page.locator('audio').evaluate(a=>a.pause())
  await page.locator('#loop').click();assert.equal(await page.locator('audio').evaluate(a=>a.loop),true)
  await page.locator('#speed').selectOption('1.25');assert.equal(await page.locator('audio').evaluate(a=>a.playbackRate),1.25)
  const opening=page.waitForEvent('popup');await page.locator('a.action[href^="audio"]').click();const audioPage=await opening
  await audioPage.waitForLoadState();assert.ok(audioPage.url().startsWith(pathToFileURL(moved+'/audio').href));await audioPage.close()
  for(const [selector,file] of [['a.action[href="lyrics.txt"]','lyrics.txt'],['a.action[href="score.abc"]','score.abc']]) {
    const waiting=page.waitForEvent('download');await page.locator(selector).click();const download=await waiting
    assert.deepEqual(await readFile(await download.path()),await readFile(join(moved,file)))
  }
  await page.locator('#score-size').selectOption('1.25');await page.waitForTimeout(250)
  await page.locator('#focus-score').click();assert.equal(await page.locator('.lyrics-card').isVisible(),false)
  await page.locator('#focus-score').click();assert.equal(await page.locator('.lyrics-card').isVisible(),true)
  await page.locator('#score-size').selectOption('1');await page.waitForTimeout(250)
  await page.screenshot({path:join(root,'song-wide.png'),fullPage:true})
  for(const width of [768,375]) {
    await page.setViewportSize({width,height:900});await page.waitForTimeout(300)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    await page.screenshot({path:join(root,`song-${width}.png`),fullPage:true})
  }
  await page.emulateMedia({media:'print'});await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')))
  assert.equal(await page.locator('.player').isVisible(),false);assert.equal(await page.locator('.lyrics-card').isVisible(),true)
  await page.pdf({path:join(root,'song-print.pdf'),preferCSSPageSize:true})
  assert.deepEqual(errors,[])
  assert.equal(requests.some(url=>/^https?:/.test(url)),false)
  assert.equal(requests.filter(url=>/^file:/.test(url)).every(url=>url.startsWith(pathToFileURL(moved+'/').href)),true)
  await writeFile(join(root,'security.wav'),wave())
  const attack='</script><img src="https://invalid.example/x" onerror="window.pwned=1">'
  const malicious=await exportMusicSong({root,args:{title:attack,lyrics:attack,style:attack,audio_path:'security.wav',abc:'X:1\nT:'+attack+'\nK:C\nCDEF|'}})
  await page.goto(pathToFileURL(malicious.path).href);await page.locator('#score svg').first().waitFor()
  assert.equal(await page.evaluate(()=>window.pwned),undefined)
  assert.equal(await page.locator('#lyrics').textContent(),attack)
  assert.deepEqual(errors,[]);assert.equal(requests.some(url=>/^https?:/.test(url)),false)
  await page.emulateMedia({media:'screen'})
  await page.goto(pathToFileURL(join(moved,'index.html')).href)
  await page.waitForFunction(()=>Number.isFinite(document.querySelector('audio').duration))
  const audioFile=await page.locator('audio source').getAttribute('src')
  await page.locator('audio').evaluate(a=>{a.querySelector('source').setAttribute('src','missing.wav');a.load()})
  await page.locator('#audio-error').waitFor({state:'visible'})
  assert.match(await page.locator('#audio-error').textContent(),/整个作品目录/)
  await page.locator('audio').evaluate((a,file)=>{a.querySelector('source').setAttribute('src',file);a.load()},audioFile)
  await page.waitForFunction(()=>Number.isFinite(document.querySelector('audio').duration))
  assert.equal(await page.locator('#audio-error').isVisible(),false)
  // Reproduce the isolated Blob document used by HTML previews. This is a browser
  // regression for the fallback message, not acceptance of the desktop renderer.
  const embeddedPage=await browser.newPage({viewport:{width:1000,height:900}})
  await embeddedPage.evaluate(html=>{
    const frame=document.createElement('iframe');frame.sandbox='allow-scripts'
    frame.style.cssText='width:100%;height:850px;border:0'
    frame.src=URL.createObjectURL(new Blob([html],{type:'text/html'}));document.body.append(frame)
  },await readFile(join(moved,'index.html'),'utf8'))
  const embedded=embeddedPage.frameLocator('iframe')
  await embedded.locator('#audio-error').waitFor({state:'visible'})
  assert.match(await embedded.locator('#audio-error').textContent(),/浏览器按钮/)
  assert.match(await embedded.locator('#audio-error').textContent(),/单独打开音频/)
  assert.equal(await embedded.locator('audio').evaluate(a=>a.currentSrc),'')
  await embedded.locator('#score svg').first().waitFor()
  await embedded.locator('.player').screenshot({path:join(root,'song-preview-fallback.png')})
  await embeddedPage.close()
  assert.deepEqual(errors,[])
  const report={artifact,portableDirectory:moved,duration,checks:['relocated directory opens offline','audio plays and pauses','loop and speed controls','original audio opens separately','ABC/lyrics downloads byte-identical','notation zoom and expanded view','375px and 768px layout','lyrics and score print styles','no network or original workspace paths','title/lyrics/style/ABC injection inert','missing local audio reports file recovery','audio recovery clears error','isolated Blob preview offers external browser and standalone audio fallback (not desktop acceptance)'],errors}
  await writeFile(join(root,'checks.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
} finally {await browser.close()}
