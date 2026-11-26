import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
if (!process.env.EDUWORK_UI_TEST_DEPS || !process.env.EDUWORK_TEST_RUNTIME) throw Error('Select UI test dependencies and the pinned RC3 Runtime')
const dependencies = process.env.EDUWORK_UI_TEST_DEPS.split(delimiter), runtime = process.env.EDUWORK_TEST_RUNTIME
const require = createRequire(join(dependencies[0], '../package.json')), { chromium } = require('playwright-core')
const { build } = createRequire(join(runtime, 'package.json'))('esbuild')
const primitiveSource = [...['Button', 'Input', 'UserMessageBubble', 'FileTypeIcon', 'Tooltip'].map(n => `export {${n}} from '@deepseek-ai/dsh-client-ui-primitives/src/${n}.tsx'`),
  "export * from '@deepseek-ai/dsh-client-ui-primitives/src/icons/index.tsx'",
  "export {MarkdownText} from '@deepseek-ai/dsh-client-ui-primitives/src/markdown/MarkdownText.tsx'",
  "export {MarkdownDelegateProvider} from '@deepseek-ai/dsh-client-ui-primitives/src/markdown/MarkdownDelegate.tsx'"].join('\n')
const bundle = await build({ entryPoints: [fileURLToPath(new URL('./ux-fixture.tsx', import.meta.url))], bundle: true, write: false, outfile: 'fixture.js', format: 'iife', platform: 'browser', jsx: 'automatic', nodePaths: dependencies,
  loader: { '.woff2': 'dataurl', '.woff': 'dataurl', '.ttf': 'dataurl' },
  plugins: [{ name: 'official-primitives', setup(build) {
    build.onResolve({ filter: /^@deepseek-ai\/dsh-client-ui-primitives$/ }, () => ({ path: 'primitives', namespace: 'official' }))
    build.onLoad({ filter: /.*/, namespace: 'official' }, () => ({ contents: primitiveSource, resolveDir: runtime, loader: 'js' }))
  } }],
})
const themeRoot = join(runtime, 'node_modules/@deepseek-ai/dsh-web-frontend/dist/assets'), styles = join(runtime, 'node_modules/@deepseek-ai/dsh-client-ui-theme/src/styles')
const theme = (await Promise.all([...(await readdir(themeRoot)).filter(n => n.endsWith('.css')).map(n => join(themeRoot, n)), ...['base.css', 'corner-shape.css', 'design-platform.css', 'focus.css', 'scrollbar.css'].map(n => join(styles, n))].map(p => readFile(p, 'utf8')))).join('\n')
const assets = new Map(bundle.outputFiles.map(f => ['/' + f.path.split(/[\\/]/).at(-1), f.contents])); assets.set('/theme.css', theme)
const server = createServer((req, res) => { const path = new URL(req.url, 'http://localhost').pathname, asset = assets.get(path); res.setHeader('Content-Type', path.endsWith('.js') ? 'application/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8'); res.end(asset ?? '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><link rel="stylesheet" href="/theme.css"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;font-family:var(--dsw-font-family);--dsw-alias-button-primary-fill:#a3233e;--dsw-alias-button-primary-hover:#8c1e35;--dsw-alias-label-primary-foreground:#fff;background:var(--dsw-alias-bg-layer-1)}#root{height:100vh}</style><div id="root"></div><script src="/fixture.js"></script></html>') })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ channel: 'msedge', headless: true }), page = await browser.newPage({ viewport: { width: 1000, height: 800 } })
const errors = [], network = [], checks = [], output = new URL('../browser-evidence/', import.meta.url); await mkdir(output, { recursive: true })
page.on('pageerror', error => errors.push(error.message)); page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:')) network.push(req.url()) }); page.setDefaultTimeout(8000)
const snap = async name => page.screenshot({ path: fileURLToPath(new URL(name + '.png', output)), animations: 'disabled' })
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  const { scenarios } = await import('./sidebar-scenarios.mjs')
  const color = await scenarios(page, snap, checks)
  const { listScenarios } = await import('./list-scenarios.mjs')
  await listScenarios(page, snap, checks)
  assert.deepEqual(errors, []); assert.deepEqual(network, [])
  await writeFile(new URL('ux-checks.json', output), JSON.stringify({ checks, errors, network, color }, null, 2))
  console.log(JSON.stringify({ checks, errors, network, color }))
} catch (error) { await snap('failure'); console.log(JSON.stringify({ errors, network })); throw error }
finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
