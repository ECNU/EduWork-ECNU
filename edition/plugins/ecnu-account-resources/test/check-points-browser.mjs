import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url), { chromium } = require('playwright-core')
if (!process.env.DSH_OIDC_PACKAGE_ROOT) throw Error('Use a built OIDC package with footer slot support')
const assets = new Map([
  ['/react.js', await readFile(join(dirname(require.resolve('react/package.json')), 'umd/react.development.js'))],
  ['/react-dom.js', await readFile(join(dirname(require.resolve('react-dom/package.json')), 'umd/react-dom.development.js'))],
  ['/fixture.js', await readFile(new URL('./browser-fixture.js', import.meta.url))],
  ['/public.js', await readFile(join(process.env.DSH_OIDC_PACKAGE_ROOT, 'lib/client.js'))],
  ['/ecnu.js', await readFile(new URL('../lib/client.js', import.meta.url))],
])
const server = createServer((req, res) => {
  const asset = assets.get(new URL(req.url, 'http://127.0.0.1').pathname)
  if (asset) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(asset); return }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end('<html lang="zh-CN"><head><meta charset="utf-8"></head><body style="font-family:system-ui;background:#f6f7fa"><div id="root"></div><script src="/react.js"></script><script src="/react-dom.js"></script><script src="/fixture.js"></script><script src="/public.js"></script><script src="/ecnu.js"></script><script>mountFixture()</script></body></html>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 900, height: 800 } })
const page = await context.newPage(), errors = [], checks = []
page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(10000)
const output = new URL('../browser-evidence/', import.meta.url); await mkdir(output, { recursive: true })
const url = `http://127.0.0.1:${server.address().port}/?points=1`
const dialog = page.getByRole('dialog', { name: '积分与邀请' })
try {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto(url); await page.getByRole('button', { name: '156 积分' }).waitFor()
  assert.equal((await page.evaluate(() => window.fixture.points())).invitationCalls, 0)
  await page.getByRole('button', { name: '积分与邀请', exact: true }).click(); await dialog.waitFor()
  assert.equal((await page.evaluate(() => window.fixture.points())).invitationCalls, 0)
  await dialog.getByRole('button', { name: '获取邀请链接' }).click()
  await dialog.getByLabel('专属邀请链接').waitFor()
  assert.equal((await page.evaluate(() => window.fixture.points())).invitationCalls, 1)
  await dialog.getByRole('button', { name: '复制链接' }).click()
  await dialog.getByText('邀请链接已复制。').waitFor()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://example.org/html/#/invite/SYNTHETIC')
  await page.screenshot({ path: fileURLToPath(new URL('points-invitation.png', output)) })
  checks.push('balance uses shared account data; dialog mount never creates invitations; explicit click and clipboard work')
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
  assert.equal(await page.getByRole('button', { name: '积分与邀请', exact: true }).evaluate(node => node === document.activeElement), true)
  await page.evaluate(() => window.fixture.collapse())
  assert.equal(await page.getByRole('button', { name: '156 积分' }).count(), 0)
  await page.getByRole('button', { name: '积分与邀请', exact: true }).press('Enter'); await dialog.waitFor()
  assert.equal(await page.evaluate(() => document.querySelector('aside').scrollWidth - document.querySelector('aside').clientWidth), 0)
  checks.push('native modal Escape and focus return; collapsed sidebar keeps a keyboard-accessible entry')
  await page.keyboard.press('Escape')
  const before = await page.evaluate(() => window.fixture.points())
  await page.evaluate(() => window.fixture.switch('third-party'))
  await page.getByRole('button', { name: '积分与邀请', exact: true }).waitFor({ state: 'hidden' })
  assert.deepEqual(await page.evaluate(() => window.fixture.points()), before)
  checks.push('other providers do not display points or call school services')
  await page.goto(url)
  await page.getByRole('button', { name: '156 积分' }).waitFor()
  await page.evaluate(() => window.fixture.delayInvite())
  await page.getByRole('button', { name: '积分与邀请', exact: true }).click()
  await dialog.getByRole('button', { name: '获取邀请链接' }).click()
  await page.waitForFunction(() => window.fixture.points().invitationCalls === 1)
  await page.evaluate(() => window.fixture.switch('third-party'))
  await page.evaluate(() => window.fixture.releaseInvite())
  await dialog.waitFor({ state: 'hidden' })
  assert.equal(await page.getByText('SYNTHETIC', { exact: true }).count(), 0)
  checks.push('existing login is sufficient; changed identity drops late invitation results')
  await page.goto(url); await page.getByRole('button', { name: '156 积分' }).waitFor()
  await page.evaluate(() => window.fixture.deny())
  await page.getByRole('button', { name: '积分与邀请', exact: true }).click()
  await dialog.getByRole('button', { name: '刷新积分' }).click()
  await dialog.getByText('积分暂不可用', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: '获取邀请链接' }).click()
  await dialog.getByText('当前账户暂时无法使用此功能，请到 ChatECNU 查看或联系管理员。').waitFor()
  assert.equal(await dialog.getByRole('button', { name: /授权|申请/ }).count(), 0)
  assert.equal((await page.evaluate(() => window.fixture.points())).invitationCalls, 1)
  checks.push('server denial remains a service error without permission prompts or automatic retries')
  assert.deepEqual(errors, [])
  await writeFile(new URL('points-result.json', output), JSON.stringify({ passed: true, checks, errors }, null, 2))
  console.log(`${checks.length} compiled points/invitation browser checks passed`)
} catch (error) {
  await page.screenshot({ path: fileURLToPath(new URL('points-failure.png', output)) })
  console.error(JSON.stringify({ errors, checks, text: await page.locator('body').innerText() }))
  throw error
} finally { await browser.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections() }) }
