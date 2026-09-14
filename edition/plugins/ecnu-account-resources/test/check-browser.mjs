import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
const require = createRequire(import.meta.url), { chromium } = require('playwright-core')
const publicRoot = resolve(process.env.DSH_OIDC_PACKAGE_ROOT || dirname(require.resolve('@eduwork/dsh-oidc/package.json')))
const assets = new Map([
  ['/react.js', await readFile(join(dirname(require.resolve('react/package.json')), 'umd/react.development.js'))],
  ['/react-dom.js', await readFile(join(dirname(require.resolve('react-dom/package.json')), 'umd/react-dom.development.js'))],
  ['/fixture.js', await readFile(new URL('./browser-fixture.js', import.meta.url))],
  ['/public.js', await readFile(join(publicRoot, 'lib/client.js'))],
  ['/ecnu.js', await readFile(new URL('../lib/client.js', import.meta.url))],
])
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://127.0.0.1').pathname
  if (assets.has(path)) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(assets.get(path)); return }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body style="font-family:system-ui;background:#f6f7fa"><div id="root"></div><script src="/react.js"></script><script src="/react-dom.js"></script><script src="/fixture.js"></script><script src="/public.js"></script><script src="/ecnu.js"></script><script>mountFixture()</script></body></html>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const output = new URL('../browser-evidence/', import.meta.url)
await mkdir(output, { recursive: true })
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 900, height: 800 } })
const page = await context.newPage(), errors = [], checks = []
page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(10000)
const menu = page.getByRole('menu', { name: '账户菜单' })
const trigger = page.getByRole('button', { name: /账户菜单/ })
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await trigger.click(); await menu.getByRole('menuitem', { name: '配额详情' }).waitFor()
  assert.deepEqual(await page.evaluate(() => window.fixture.declarations()), { 'oidc.account.menu.details': { kind: 'single', scope: 'root' } })
  assert.equal(await menu.getByRole('progressbar').count(), 1)
  assert.equal(await menu.getByRole('progressbar').getAttribute('value'), '90')
  assert.ok((await menu.innerText()).includes('使用情况'))
  assert.ok((await menu.innerText()).includes('资源池'))
  assert.ok(!(await menu.innerText()).includes('科研资源包'))
  await menu.getByRole('menuitem', { name: '展开配额明细' }).click()
  const content = await menu.innerText()
  for (const text of ['使用情况', '重置', '科研资源包', '930 credits 剩余', '已用 70 · 总量 1,000', '到期', '状态 active', '补充资源包', '55 credits 剩余']) assert.ok(content.includes(text), text)
  assert.equal(await menu.getByRole('menuitem', { name: '配额详情' }).getAttribute('href'), 'https://example.org/allowance')
  await page.screenshot({ path: fileURLToPath(new URL('ecnu-quota-menu.png', output)) })
  checks.push('compiled public child slot + ECNU quota windows/reset/complete packs and safe detail link')
  await page.keyboard.press('End'); assert.equal(await page.evaluate(() => document.activeElement.textContent), '退出登录')
  await page.keyboard.press('Home'); assert.equal(await page.evaluate(() => document.activeElement.textContent), '收起配额明细')
  await menu.press('Escape'); await menu.waitFor({ state: 'hidden' })
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true)
  checks.push('extension participates in public menu keyboard and focus contract')
  await trigger.click(); await menu.getByRole('menuitem', { name: '刷新配额' }).waitFor()
  await page.evaluate(() => window.fixture.setRemaining(77))
  await menu.getByRole('menuitem', { name: '刷新配额' }).click()
  await page.waitForFunction(() => document.querySelector('progress')?.value === 77)
  checks.push('explicit refresh updates actual allowance')
  const beforeOther = await page.evaluate(() => window.fixture.reads())
  await page.evaluate(() => window.fixture.switch('third-party'))
  await menu.getByRole('menuitem', { name: '刷新账户' }).waitFor()
  assert.doesNotMatch(await menu.innerText(), /额度|资源包|ECNU synthetic/)
  await menu.getByRole('menuitem', { name: '刷新账户' }).click()
  assert.equal(await page.evaluate(() => window.fixture.reads()), beforeOther)
  checks.push('non-allowlisted enterprise receives public refresh without any quota request')
  await page.evaluate(() => window.fixture.switch('ecnu'))
  await menu.getByRole('menuitem', { name: '配额详情' }).waitFor()
  const beforeDelay = await page.evaluate(() => window.fixture.reads())
  await page.evaluate(() => window.fixture.delay())
  // A new menu mount starts an independently pending quota read.
  await menu.press('Escape'); await menu.waitFor({ state: 'hidden' }); await trigger.click()
  await page.waitForFunction(count => window.fixture.reads() > count, beforeDelay)
  await page.evaluate(() => window.fixture.switch('third-party'))
  await menu.getByRole('menuitem', { name: '刷新账户' }).waitFor()
  await page.evaluate(() => window.fixture.release())
  await page.waitForFunction(() => !document.querySelector('[role="menu"]').textContent.includes('资源包'))
  assert.doesNotMatch(await menu.innerText(), /科研资源包|77 credits/)
  checks.push('late quota response cannot cross account switch')
  await page.evaluate(() => window.fixture.switch('ecnu'))
  await menu.getByRole('menuitem', { name: '配额详情' }).waitFor()
  await menu.press('Escape'); await menu.waitFor({ state: 'hidden' })
  await page.evaluate(() => window.fixture.delay())
  await trigger.click(); await menu.getByText('正在读取额度…').waitFor()
  await menu.getByRole('menuitem', { name: '退出登录' }).click()
  await menu.waitFor({ state: 'hidden' }); await page.evaluate(() => window.fixture.release())
  await trigger.click(); await menu.getByRole('menuitem', { name: '登录账户' }).waitFor()
  assert.doesNotMatch(await menu.innerText(), /资源包|额度|synthetic user/)
  assert.deepEqual([...new Set(await page.evaluate(() => window.fixture.calls()))], ['ecnu'])
  checks.push('logout hides extension and discards pending reads; no third-party request')
  assert.deepEqual(errors, [])
  await writeFile(new URL('result.json', output), JSON.stringify({ passed: true, checks, errors }, null, 2))
  console.log(`${checks.length} compiled public/ECNU browser checks passed`)
} catch (error) {
  await writeFile(new URL('result.json', output), JSON.stringify({ passed: false, checks, errors, failure: error.message }, null, 2)); throw error
} finally { await browser.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections() }) }
