import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolve, join } from 'node:path'
import { mkdir, writeFile, readFile } from 'node:fs/promises'

const runtime = process.env.EDUWORK_TEST_RUNTIME
if (!runtime) throw Error('Set EDUWORK_TEST_RUNTIME to the pinned assembled product/d directory')
const require = createRequire(join(resolve(runtime), 'package.json')), { build } = require('esbuild')
const root = fileURLToPath(new URL('..', import.meta.url)), out = resolve(root, 'dist/music-studio')
await mkdir(out, { recursive: true })
await build({ absWorkingDir: root, entryPoints: ['src/client.ts'], outfile: join(out, 'client.js'), bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', minify: true,
  nodePaths: [join(resolve(runtime), 'node_modules')], external: ['react', 'react/*', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-store'],
  banner: { js: 'window.__ModuleLoader__.load({id:"@chatecnu-work/dsh-tool-ecnu-music",factory:(require)=>{var module={exports:{}};var exports=module.exports;' }, footer: { js: 'return module.exports;}});' } })
await build({ absWorkingDir: root, entryPoints: ['test/preview.tsx'], outfile: join(out, 'preview.js'), bundle: true, platform: 'browser', format: 'iife', target: 'es2022', minify: true, nodePaths: [join(resolve(runtime), 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' } })
const script = (await readFile(join(out, 'preview.js'), 'utf8')).replace(/<\/script/gi, '<\\/script')
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Music Studio · EduWork ECNU · 交互预览</title><style>
*{box-sizing:border-box}body{margin:0;background:#ebece7;font-family:'Segoe UI','Microsoft YaHei',sans-serif;color:#303b35}.preview-bar{height:48px;display:flex;align-items:center;gap:12px;padding:0 22px;border-bottom:1px solid #d5d9d2;font-size:12px}.preview-bar strong{margin-right:auto}.preview-bar button{font:inherit;border:1px solid #bfc8bf;background:#fff;color:#2f493a;padding:5px 10px;border-radius:6px;cursor:pointer}#app{height:calc(100dvh - 48px);max-width:1600px;margin:auto;box-shadow:0 0 0 1px #d2d6d0}body.narrow #app{width:min(100%,390px)}body.dark #app{--dsw-alias-bg-base:#1d2522;--dsw-alias-bg-layer-1:#252e2a;--dsw-alias-bg-layer-2:#303c35;--dsw-alias-label-primary:#eff3ef;--dsw-alias-label-secondary:#b8c6bd;--dsw-alias-border-l2:#52665a;--dsw-alias-state-business-primary:#a9ceb3;--dsw-alias-label-primary-inverted:#1c3022;color-scheme:dark}@media(max-width:500px){.preview-bar{padding:0 12px;gap:7px}.preview-bar strong{font-size:11px}.preview-bar button{font-size:11px}}
</style><div class="preview-bar"><strong>EduWork ECNU / 本地交互预览</strong><button id="width" aria-pressed="false">侧栏宽度</button><button id="theme" aria-pressed="false">深色</button></div><div id="app"></div><script>document.getElementById('width').onclick=function(){this.setAttribute('aria-pressed',document.body.classList.toggle('narrow'))};document.getElementById('theme').onclick=function(){this.setAttribute('aria-pressed',document.body.classList.toggle('dark'))};</script><script>${script}</script></html>`
await writeFile(join(out, 'index.html'), html)
console.log(JSON.stringify({ nativeClient: join(out, 'client.js'), preview: join(out, 'index.html') }))
