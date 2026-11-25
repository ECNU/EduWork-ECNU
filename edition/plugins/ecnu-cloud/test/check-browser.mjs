import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { join, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
if (!process.env.EDUWORK_UI_TEST_DEPS || !process.env.EDUWORK_TEST_RUNTIME) throw Error('Select UI test dependencies and the pinned RC3 Runtime')
const dependencies = process.env.EDUWORK_UI_TEST_DEPS.split(delimiter)
const require = createRequire(join(dependencies[0], '../package.json'))
const { build } = createRequire(join(process.env.EDUWORK_TEST_RUNTIME, 'package.json'))('esbuild'), { chromium } = require('playwright-core')
const root = fileURLToPath(new URL('..', import.meta.url))
const primitiveSource = "export {Button} from '@deepseek-ai/dsh-client-ui-primitives/src/Button.tsx'; export {Modal} from '@deepseek-ai/dsh-client-ui-primitives/src/Modal.tsx'; export {IconNewChatOutlineRegular} from '@deepseek-ai/dsh-client-ui-primitives/src/icons/index.tsx'"
const bundle = await build({ entryPoints: [fileURLToPath(new URL('./browser-fixture.tsx', import.meta.url))], bundle: true, write: false, outfile: 'fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic',
  nodePaths: dependencies, plugins: [{ name: 'official-primitives', setup(build) {
    build.onResolve({ filter: /^@deepseek-ai\/dsh-client-ui-primitives$/ }, () => ({ path: 'primitives', namespace: 'official' }))
    build.onLoad({ filter: /.*/, namespace: 'official' }, () => ({ contents: primitiveSource, resolveDir: process.env.EDUWORK_TEST_RUNTIME, loader: 'js' }))
  } }],
})
const assets = new Map(bundle.outputFiles.map(file => ['/' + file.path.split(/[\\/]/).at(-1), file.contents]))
const server = createServer((req, res) => { const name = new URL(req.url, 'http://localhost').pathname; const asset = assets.get(name); res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8'); res.end(asset ?? '<!doctype html><link rel="stylesheet" href="/fixture.css"><div id="root" style="height:750px"></div><script src="/fixture.js"></script>') })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ channel: 'msedge', headless: true }), page = await browser.newPage({ viewport: { width: 1120, height: 800 } })
const errors = [], checks = []; page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(8000)
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.getByRole('button', { name: /云端示例一/ }).click()
  await page.getByText('可见正文 <script>alert(1)</script>', { exact: true }).waitFor()
  assert.equal(await page.locator('article script').count(), 0); checks.push('cloud text is visible and never interpreted as HTML')
  await page.evaluate(() => window.fixture.delayPreview())
  await page.getByRole('button', { name: /云端示例一/ }).click()
  await page.getByRole('button', { name: /云端示例二/ }).click()
  await page.getByRole('heading', { name: '云端示例二' }).waitFor()
  await page.evaluate(() => window.fixture.releasePreview())
  assert.equal(await page.getByRole('heading', { name: '云端示例一' }).count(), 0); checks.push('late previews cannot replace a later selection')
  await page.evaluate(() => window.fixture.renew())
  assert.equal(await page.getByRole('heading', { name: '云端示例二' }).count(), 1); checks.push('ordinary renewal retains the selected preview')
  await page.getByRole('button', { name: '在 EduWork 继续', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '在 EduWork 继续' }); await dialog.waitFor()
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  assert.equal(await page.evaluate(() => window.fixture.imports.length), 0)
  await page.getByRole('button', { name: '在 EduWork 继续', exact: true }).click()
  await dialog.getByRole('button', { name: '选择或新建工作区' }).click()
  await dialog.getByRole('button', { name: '选择合成工作区' }).click()
  await dialog.getByRole('button', { name: '导入并打开' }).click()
  await page.waitForFunction(() => window.fixture.opened.length === 1)
  const submitted = await page.evaluate(() => window.fixture.imports[0])
  assert.equal(submitted.input.workspaceID, 'local-workspace'); assert.equal(submitted.cancellable, true)
  checks.push('official Modal cancels without import and confirms the chosen workspace with a cancellation signal')
  await dialog.getByRole('button', { name: '关闭', exact: true }).click()
  await page.evaluate(() => window.fixture.holdImport())
  await page.getByRole('button', { name: '在 EduWork 继续', exact: true }).click()
  await dialog.getByRole('button', { name: '导入并打开' }).click()
  await page.waitForFunction(() => window.fixture.imports.length === 2)
  await page.evaluate(() => window.fixture.logout())
  await page.getByText('请先在左下角登录学校账号。', { exact: true }).waitFor()
  assert.equal(await page.locator('article').count(), 0); checks.push('sign-out clears cloud content')
  assert.equal(await page.evaluate(() => window.fixture.cancelled()), true)
  assert.equal(await page.evaluate(() => window.fixture.opened.length), 1); checks.push('unmounted import aborts and never navigates after a late result')
  assert.deepEqual(errors, [])
  const output = new URL('../browser-evidence/', import.meta.url); await mkdir(output, { recursive: true }); await writeFile(new URL('checks.json', output), JSON.stringify({ checks, errors }, null, 2)); console.log(JSON.stringify({ checks, errors }))
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
