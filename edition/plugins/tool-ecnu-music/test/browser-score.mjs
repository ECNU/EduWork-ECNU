import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderMusicScore } from '../lib/score.js'
const require = createRequire(join(resolve(process.env.EDUWORK_TEST_RUNTIME), 'package.json'))
const { chromium } = require('playwright-core')
const root = resolve(process.env.MUSIC_SCORE_OUTPUT_ROOT || fileURLToPath(new URL('../dist/score-check', import.meta.url)))
await mkdir(root, { recursive: true })
const abc = process.env.MUSIC_SCORE_ABC ? await readFile(process.env.MUSIC_SCORE_ABC, 'utf8') : 'X:1\nT:Morning\nM:4/4\nL:1/4\nK:C\nC E G c | G E C2 |]'
const artifact = await renderMusicScore({ root, args: { abc, title: '晨光与远方 · 五线谱' } })
const browser = await chromium.launch({ headless: true, channel: process.env.MUSIC_TEST_BROWSER_CHANNEL || 'msedge' })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } }), errors = [], requests = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()) })
  await page.goto(pathToFileURL(artifact.path).href)
  await page.locator('#score svg').first().waitFor()
  await page.waitForTimeout(250)
  assert.equal(await page.locator('#source').textContent(), abc)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', {name:'下载 ABC',exact:true}).click()
  const download = await downloadPromise
  assert.equal(await readFile(await download.path(), 'utf8'), abc)
  assert.equal(await page.locator('#status.error').count(), 0)
  const notes = await page.locator('.abcjs-note').count()
  assert.ok(notes > 0)
  await page.screenshot({path:join(root,'score-wide.png'),fullPage:true})
  await page.setViewportSize({width:375,height:812})
  await page.waitForTimeout(250)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({path:join(root,'score-mobile.png'),fullPage:true})
  await page.emulateMedia({media:'print'})
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  assert.equal(await page.locator('nav').isVisible(),false)
  assert.equal(await page.locator('.source').isVisible(),false)
  const svgLines = await page.locator('#score svg').count()
  assert.ok(svgLines > 0)
  const attack = await renderMusicScore({root,args:{title:'</h1><script>window.pwned=1</script>',abc:'X:1\nT:</script><img src="https://invalid.example/x" onerror="window.pwned=1">\nK:C\nCDEF|'}})
  await page.goto(pathToFileURL(attack.path).href)
  await page.locator('#score svg').first().waitFor()
  assert.equal(await page.evaluate(() => window.pwned),undefined)
  assert.deepEqual(errors,[]); assert.deepEqual(requests,[])
  const report = { artifact, notes, svgLines, checks:['file:// offline engraving','ABC download roundtrip','mobile document fits viewport','print hides controls and source','source/title injection inert','zero HTTP requests'],errors,requests }
  await writeFile(join(root,'checks.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report))
} finally { await browser.close() }
