import { randomUUID } from 'node:crypto'
import { open, readFile, realpath } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { writeMusicArtifact } from './core.js'

const MAX_ABC = 256 * 1024
const contained = (root, path) => { const rel = relative(root, path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('../') && !rel.startsWith('..\\') }
const escapeHTML = text => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const jsonData = data => JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
let assets
async function rendererAssets() {
  if (!assets) assets = Promise.all(['abcjs.cjs', 'LICENSE.md'].map(name => readFile(new URL(`../vendor/abcjs/${name}`, import.meta.url), 'utf8')))
  return assets
}

async function readABC(root, path, signal) {
  if (typeof path !== 'string' || !path.trim() || path.length > 4096 || extname(path).toLowerCase() !== '.abc') throw Error('abc_path must name a workspace .abc file')
  const project = await realpath(root), source = await realpath(resolve(project, path))
  if (!contained(project, source)) throw Error('ABC must be inside the session workspace')
  const handle = await open(source, 'r')
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.size < 1 || info.size > MAX_ABC) throw Error('ABC must be a regular file of 1–256 KiB')
    const bytes = Buffer.alloc(MAX_ABC + 1)
    let size = 0
    while (size < bytes.length) {
      signal?.throwIfAborted()
      const { bytesRead } = await handle.read(bytes, size, bytes.length - size, null)
      if (!bytesRead) break
      size += bytesRead
    }
    if (size > MAX_ABC) throw Error('ABC exceeds 256 KiB')
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size))
  } finally { await handle.close() }
}

export async function renderMusicScore({ root, args, signal }) {
  signal?.throwIfAborted()
  for (const key of Object.keys(args)) if (!['abc', 'abc_path', 'title'].includes(key)) throw Error(`Unsupported score parameter: ${key}`)
  if ((args.abc !== undefined) === (args.abc_path !== undefined)) throw Error('Provide exactly one of abc or abc_path')
  const abc = args.abc_path !== undefined ? await readABC(root, args.abc_path, signal) : args.abc
  if (typeof abc !== 'string' || !abc.trim() || Buffer.byteLength(abc) > MAX_ABC) throw Error('ABC must contain 1–256 KiB of UTF-8 text')
  if (!/^K\s*:/m.test(abc)) throw Error('ABC requires a K: key field')
  const title = args.title ?? '音乐乐谱'
  if (typeof title !== 'string' || !title.trim() || [...title].length > 120) throw Error('title must contain 1–120 characters')
  const [renderer, license] = await rendererAssets(), nonce = randomUUID().replaceAll('-', '')
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>${escapeHTML(title)}</title><style>
*{box-sizing:border-box}body{margin:0;background:#f3f2ed;color:#222923;font:16px/1.65 system-ui,'Segoe UI','Microsoft YaHei',sans-serif}main{max-width:1120px;margin:32px auto;padding:32px;background:white;border:1px solid #dddeda;border-radius:12px}header{display:flex;gap:24px;align-items:start;justify-content:space-between;flex-wrap:wrap}h1{font:600 clamp(24px,4vw,34px)/1.3 Georgia,'SimSun',serif;margin:8px 0 12px;overflow-wrap:anywhere}.eyebrow{color:#49604f;font-size:12px;letter-spacing:.12em}.subtitle{color:#536056;margin:0;max-width:640px}nav{display:flex;gap:10px;flex-wrap:wrap}button,summary{cursor:pointer}button{font:inherit;min-height:44px;padding:8px 16px;background:white;color:#263e2d;border:1px solid #9bac9d;border-radius:7px}button:hover{background:#edf3ed}button:focus-visible,summary:focus-visible{outline:3px solid #356b45;outline-offset:3px}.status{margin:24px 0 8px;color:#536056}.status.error{color:#9b3028}.score{overflow:auto;padding:12px 0}.score svg{display:block;min-width:640px;break-inside:avoid;page-break-inside:avoid}.warnings{white-space:pre-wrap;color:#8a3528;overflow-wrap:anywhere}details{margin-top:28px;border-top:1px solid #dddeda;padding-top:16px}summary{font-weight:600;min-height:44px}pre{font:13px/1.7 ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f6f7f4;padding:18px;border-radius:6px}footer{margin-top:32px;font-size:12px;color:#536056}footer details{font-weight:400}noscript{display:block;padding:20px;color:#9b3028}@media(max-width:700px){main{margin:0;border:0;border-radius:0;padding:20px}nav{width:100%}nav button{flex:1}}@media print{@page{size:A4;margin:14mm}body{background:white;font-size:12px}main{margin:0;padding:0;border:0;max-width:none}nav,.source,footer{display:none}.score{overflow:visible}.score svg{min-width:0;max-width:100%}.status{margin-top:12px}h1{font-size:24px}}
</style></head><body><main><header><div><div class="eyebrow">MUSIC SCORE · ABC</div><h1>${escapeHTML(title)}</h1><p class="subtitle">由 ABC 排版为五线谱。音符与音频仍需核对；不代表完整配器总谱。</p></div><nav aria-label="乐谱操作"><button id="print" type="button">打印 / 另存 PDF</button><button id="download" type="button">下载 ABC</button></nav></header>
<p id="status" class="status" role="status">正在排版乐谱…</p><div id="warnings" class="warnings" role="status"></div><div id="score" class="score" role="region" aria-label="五线谱"></div>
<details class="source"><summary>查看 ABC 源码</summary><pre id="source"></pre></details><noscript>请在支持 JavaScript 的浏览器中打开本地文件以查看五线谱。</noscript>
<footer>离线乐谱文件 · 排版使用 abcjs 6.7.2<details><summary>开源许可</summary><pre>${escapeHTML(license)}</pre></details></footer></main>
<script id="score-data" type="application/json" nonce="${nonce}">${jsonData({ abc })}</script>
<script nonce="${nonce}">${renderer.replace(/<\/script/gi, '<\\/script')}</script>
<script nonce="${nonce}">
const abc = JSON.parse(document.getElementById('score-data').textContent).abc;
const score = document.getElementById('score'), status = document.getElementById('status');
document.getElementById('source').textContent = abc;
document.getElementById('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([abc], {type:'text/vnd.abc;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url; link.download = 'score.abc'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.getElementById('print').addEventListener('click', () => window.print());
function render(width) {
  try {
    score.replaceChildren();
    const tunes = ABCJS.renderAbc(score, abc, { staffwidth:Math.max(600,width-40), responsive:'resize', oneSvgPerLine:true, add_classes:true, wrap:{minSpacing:1.8,maxSpacing:2.7,preferredMeasuresPerLine:4} });
    if (!score.querySelector('svg')) throw Error('没有可排版的乐谱，请检查 ABC。');
    const warnings = tunes.flatMap(tune => tune.warnings || []);
    document.getElementById('warnings').textContent = warnings.length ? warnings.join('\\n') : '';
    status.className = 'status'; status.textContent = warnings.length ? '已排版，发现 ' + warnings.length + ' 处解析提示，请核对。' : '乐谱已排版 · 可查看源码、下载 ABC 或打印';
  } catch (error) { score.replaceChildren(); status.className = 'status error'; status.textContent = '排版失败：' + error.message; }
}
let lastWidth = 0, timer;
function layout() { const width = Math.max(640,Math.floor(score.clientWidth)); if(width === lastWidth)return; lastWidth=width; render(width); }
new ResizeObserver(() => { clearTimeout(timer); timer=setTimeout(layout,150); }).observe(score);
layout();
window.addEventListener('beforeprint', () => { clearTimeout(timer); render(700); });
window.addEventListener('afterprint', () => { lastWidth=0; layout(); });
</script></body></html>`
  signal?.throwIfAborted()
  const name = `score-${randomUUID()}.html`, path = await writeMusicArtifact(root, name, html)
  return { path, relativePath: `.eduwork/generated/music/${name}`, mime: 'text/html', title, bytes: Buffer.byteLength(html),
    renderer: 'abcjs 6.7.2', offline: true, message: 'HTML created with embedded ABC and renderer. Open it in a browser to inspect notation and parsing warnings; this does not verify musical accuracy.' }
}
