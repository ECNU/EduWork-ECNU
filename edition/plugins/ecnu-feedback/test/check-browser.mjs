import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url), { chromium } = require('playwright-core')
if (!process.env.DSH_OIDC_PACKAGE_ROOT) throw Error('Select a built public package with shared optional consent')
const assets = new Map([
  ['/react.js', await readFile(join(dirname(require.resolve('react/package.json')), 'umd/react.development.js'))],
  ['/react-dom.js', await readFile(join(dirname(require.resolve('react-dom/package.json')), 'umd/react-dom.development.js'))],
  ['/public.js', await readFile(join(process.env.DSH_OIDC_PACKAGE_ROOT, 'lib/client.js'))],
  ['/feedback.js', await readFile(new URL('../lib/client.js', import.meta.url))], ['/fixture.js', await readFile(new URL('./browser-fixture.js', import.meta.url))],
])
const server = createServer((req, res) => {
  const asset = assets.get(new URL(req.url, 'http://127.0.0.1').pathname)
  if (asset) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(asset); return }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end('<html lang="zh-CN"><head><meta charset="utf-8"></head><body style="font-family:system-ui"><div id="root"></div><script src="/react.js"></script><script src="/react-dom.js"></script><script src="/fixture.js"></script><script src="/public.js"></script><script src="/feedback.js"></script><script>mountFixture()</script></body></html>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ channel: 'msedge', headless: true }), context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 960, height: 800 } }), page = await context.newPage()
const errors = [], checks = [], output = new URL('../browser-evidence/', import.meta.url); await mkdir(output, { recursive: true })
page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(10000)
const school = page.getByRole('region', { name: '学校模型历史回答' }), personal = page.getByRole('region', { name: '个人模型回答' }), dialog = page.getByRole('dialog')
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`); await school.getByRole('button', { name: '点赞', exact: true }).waitFor()
  assert.equal(await personal.getByRole('button').count(), 0)
  assert.equal((await page.evaluate(() => window.fixture.state())).reads, 0)
  await page.evaluate(() => window.fixture.selectPersonal())
  await school.getByRole('button', { name: '点赞', exact: true }).click(); await dialog.waitFor()
  assert.equal((await page.evaluate(() => window.fixture.state())).posts.length, 0)
  await dialog.getByText('用户可见的问题', { exact: true }).waitFor()
  assert.match(await dialog.innerText(), /发送给 ChatECNU/)
  await dialog.getByRole('button', { name: '取消' }).click(); await dialog.waitFor({ state: 'hidden' })
  assert.equal((await page.evaluate(() => window.fixture.state())).posts.length, 0)
  checks.push('only original school-provider answers show controls; model switch preserves them; preview/cancel never submits')
  await school.getByRole('button', { name: '点踩', exact: true }).click(); await dialog.getByRole('textbox').fill('这部分需要核对。')
  await dialog.getByRole('combobox').selectOption('回答不准确')
  await page.screenshot({ path: fileURLToPath(new URL('feedback-preview.png', output)) })
  await dialog.getByRole('button', { name: '提交反馈' }).click(); await dialog.waitFor({ state: 'hidden' })
  await school.getByRole('button', { name: '撤回点踩' }).waitFor()
  const first = (await page.evaluate(() => window.fixture.state())).posts[0]
  assert.equal(first.session, 'local-session'); assert.equal(first.message, 'school-message'); assert.equal(first.action.favorite, -1); assert.equal(first.action.confirmed, true)
  assert.deepEqual(first.action.reason, ['回答不准确']); assert.equal(first.action.desc, '这部分需要核对。')
  await page.evaluate(() => window.fixture.remount())
  await school.getByRole('button', { name: '点赞', exact: true }).focus()
  await school.getByRole('button', { name: '撤回点踩' }).waitFor()
  await school.getByRole('button', { name: '点赞', exact: true }).click(); await dialog.getByRole('button', { name: '提交反馈' }).click()
  await school.getByRole('button', { name: '撤回点赞' }).click()
  await school.getByRole('button', { name: '点赞', exact: true }).waitFor()
  assert.deepEqual((await page.evaluate(() => window.fixture.state())).posts.map(value => value.action.favorite), [-1, 1, 0])
  checks.push('submit, reopening, changing rating and retraction preserve message/conversation identity')
  const readCount = (await page.evaluate(() => window.fixture.state())).reads
  await page.evaluate(() => { window.fixture.delayRead(); window.fixture.remount() })
  await school.getByRole('button', { name: '点赞', exact: true }).focus()
  await page.waitForFunction(count => window.fixture.state().reads > count, readCount)
  await school.getByRole('button', { name: '点赞', exact: true }).click(); await dialog.getByRole('button', { name: '提交反馈' }).click()
  await school.getByRole('button', { name: '撤回点赞' }).waitFor()
  await page.evaluate(() => window.fixture.releaseRead())
  await school.getByRole('button', { name: '撤回点赞' }).click(); await school.getByRole('button', { name: '点赞', exact: true }).waitFor()
  assert.deepEqual((await page.evaluate(() => window.fixture.state())).posts.map(value => value.action.favorite), [-1, 1, 0, 1, 0])
  checks.push('a delayed hover read cannot overwrite a later submitted rating')
  await page.evaluate(() => { window.fixture.setScopes(['feedback.read']); window.fixture.remount() })
  await school.getByRole('button', { name: '点赞', exact: true }).click()
  await dialog.getByRole('button', { name: '授权反馈功能' }).click()
  await dialog.getByRole('button', { name: '提交反馈' }).waitFor()
  assert.deepEqual((await page.evaluate(() => window.fixture.state())).consents, [['feedback.write']])
  assert.equal((await page.evaluate(() => window.fixture.state())).posts.length, 5)
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
  assert.equal(await school.getByRole('button', { name: '点赞', exact: true }).evaluate(node => node === document.activeElement), true)
  checks.push('read-only prior grant requests only missing write scope; consent does not submit; Escape restores focus')
  await page.evaluate(() => window.fixture.delay())
  await school.getByRole('button', { name: '点赞', exact: true }).click(); await dialog.getByRole('button', { name: '提交反馈' }).click()
  await page.waitForFunction(() => window.fixture.state().posts.length === 6)
  await page.evaluate(() => window.fixture.switchAccount()); await page.evaluate(() => window.fixture.release())
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await school.getByRole('button', { name: '撤回点赞' }).count(), 0)
  checks.push('account changes close drafts and ignore late write results')
  assert.deepEqual(errors, [])
  await writeFile(new URL('result.json', output), JSON.stringify({ passed: true, checks, errors }, null, 2)); console.log(`${checks.length} compiled feedback browser checks passed`)
} catch (error) { console.error(JSON.stringify({ errors, checks, text: await page.locator('body').innerText() })); throw error }
finally { await browser.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections() }) }
