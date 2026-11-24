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
const menu = page.getByRole('menu', { name: '账户菜单' }), dialog = page.getByRole('dialog', { name: 'AIConsole 查询权限' })
const trigger = menu.getByRole('menuitem', { name: 'AIConsole 查询权限', exact: true })
const authorize = dialog.getByRole('button', { name: '授权所选查询' })
const openMenu = async mode => {
  await page.goto(`http://127.0.0.1:${server.address().port}/${mode ? '?access=' + mode : ''}`)
  await page.getByRole('button', { name: /账户菜单/ }).click()
  await menu.getByRole('menuitem', { name: '配额详情' }).waitFor()
}
const openDialog = async () => { await trigger.click(); await dialog.getByText('已有授权无需重复申请。').waitFor() }
try {
  for (const mode of ['', 'legacy']) {
    await openMenu(mode)
    assert.equal(await trigger.count(), 0)
    assert.equal((await page.evaluate(() => window.fixture.access())).reads, 0)
  }
  checks.push('default and old hosts retain existing quota UI without permission calls')

  await openMenu('enabled'); await openDialog()
  assert.equal(await dialog.getByRole('checkbox').count(), 8)
  assert.equal(await dialog.getByRole('checkbox', { name: /个人资料/ }).isChecked(), true)
  assert.equal(await dialog.getByRole('checkbox', { name: /个人资料/ }).isDisabled(), true)
  assert.equal(await authorize.isDisabled(), true)
  assert.deepEqual((await page.evaluate(() => window.fixture.access())).calls, [])
  const usage = dialog.getByRole('checkbox', { name: /用量与配额/ })
  await usage.check(); await dialog.getByRole('checkbox', { name: /Key 清单/ }).check()
  await usage.focus(); await page.keyboard.press('Home')
  assert.equal(await usage.evaluate(node => node === document.activeElement), true)
  await page.screenshot({ path: fileURLToPath(new URL('aiconsole-query-access.png', output)) })
  await authorize.click(); await dialog.getByText('授权已更新，回到对话重新发起查询即可。').waitFor()
  assert.deepEqual((await page.evaluate(() => window.fixture.access())).calls, [{ id: 'ecnu', scopes: ['usage.read', 'tokens.read'] }])
  assert.equal(await usage.isDisabled(), true)
  assert.equal(await authorize.isDisabled(), true)
  await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' })
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true)
  await page.evaluate(() => window.fixture.switch('third-party'))
  await menu.getByRole('menuitem', { name: '刷新账户' }).waitFor()
  assert.equal(await trigger.count(), 0)
  checks.push('explicit selection uses the shared OAuth client, keeps old grants, restores focus, isolates other profiles')

  await openMenu('cancel'); await openDialog(); await dialog.getByRole('checkbox', { name: /用量与配额/ }).check(); await authorize.click()
  await page.waitForFunction(() => window.fixture.access().calls.length === 1)
  await dialog.getByRole('button', { name: '取消', exact: true }).click(); await dialog.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => window.fixture.access().cancellations === 1)
  assert.deepEqual((await page.evaluate(() => window.fixture.access())).granted, ['account.read'])
  await openDialog(); assert.equal(await dialog.getByRole('checkbox', { name: /用量与配额/ }).isChecked(), false)
  checks.push('cancel aborts the common login attempt and preserves old authorization')

  await openMenu('unsupported'); await trigger.click(); await dialog.getByText('当前学校登录尚未支持按功能授权。').waitFor()
  assert.equal(await dialog.getByRole('checkbox', { disabled: true }).count(), 8)
  assert.equal(await authorize.isDisabled(), true)
  assert.deepEqual((await page.evaluate(() => window.fixture.access())).calls, [])
  await openMenu('enabled'); await openDialog(); await dialog.getByRole('checkbox', { name: /用量与配额/ }).check()
  await page.evaluate(() => window.fixture.available(['account.read']))
  await authorize.click(); await dialog.getByText('权限状态已变化，请重新选择。').waitFor()
  assert.deepEqual((await page.evaluate(() => window.fixture.access())).calls, [])
  checks.push('unsupported or withdrawn capabilities cannot start consent')

  await openMenu('enabled'); await page.evaluate(() => window.fixture.delayAuthorization()); await trigger.click()
  await page.waitForFunction(() => window.fixture.access().reads === 1)
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await page.evaluate(() => window.fixture.releaseAuthorization()); await dialog.waitFor({ state: 'hidden' })
  assert.deepEqual((await page.evaluate(() => window.fixture.access())).calls, [])
  await openMenu('cancel'); await openDialog(); await dialog.getByRole('checkbox', { name: /用量与配额/ }).check(); await authorize.click()
  await page.waitForFunction(() => window.fixture.access().calls.length === 1)
  await page.evaluate(() => window.fixture.changeIdentity()); await dialog.waitFor({ state: 'hidden' })
  await page.waitForFunction(() => window.fixture.access().cancellations === 1)
  assert.deepEqual((await page.evaluate(() => window.fixture.access())).granted, ['account.read'])
  checks.push('closed dialogs discard late metadata; identity changes cancel a pending consent')

  assert.deepEqual(errors, [])
  await writeFile(new URL('query-access-result.json', output), JSON.stringify({ passed: true, checks, errors }, null, 2))
  console.log(`${checks.length} compiled query-consent browser checks passed`)
} catch (error) {
  await writeFile(new URL('query-access-result.json', output), JSON.stringify({ passed: false, checks, errors, failure: error.message }, null, 2)); throw error
} finally { await browser.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections() }) }
