import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { renderMusicScore } from '../lib/score.js'
const abc = 'X:1\nT:校园旋律\nM:4/4\nL:1/4\nK:C\nC E G c | G E C2 |]'
async function workspace(t) { const root = await mkdtemp(join(tmpdir(), 'music-score-')); t.after(() => rm(root, { recursive: true, force: true })); return root }
test('offline score preserves ABC and produces independent files without changing source', async t => {
  const root = await workspace(t), source = join(root, 'source.abc')
  await writeFile(source, abc)
  const one = await renderMusicScore({ root, args: { abc_path: source, title: '<校园> & 乐谱' } })
  const two = await renderMusicScore({ root, args: { abc } })
  assert.notEqual(one.path, two.path)
  assert.equal(await readFile(source, 'utf8'), abc)
  assert.equal(one.mime, 'text/html')
  const html = await readFile(one.path, 'utf8')
  assert.equal(JSON.parse(html.match(/<script id="score-data"[^>]*>([^]*?)<\/script>/)[1]).abc, abc)
  assert.match(html, /&lt;校园&gt; &amp; 乐谱/)
  assert.match(html, /Permission is hereby granted/)
})
test('score inputs reject ambiguous, malformed, oversized, out-of-workspace and invalid UTF-8 sources', async t => {
  const root = await workspace(t), outside = await workspace(t)
  for (const args of [{}, {abc,abc_path:'x.abc'}, {abc:'not ABC'}, {abc:'K:C\n'+'a'.repeat(256*1024)}, {abc,title:'x'.repeat(121)}]) await assert.rejects(renderMusicScore({root,args}))
  await writeFile(join(root, 'broken.abc'), Buffer.from([0xff,0xfe,0xff]))
  await assert.rejects(renderMusicScore({root,args:{abc_path:'broken.abc'}}))
  await writeFile(join(outside, 'private.abc'), abc)
  await symlink(join(outside, 'private.abc'), join(root, 'escape.abc'))
  await assert.rejects(renderMusicScore({root,args:{abc_path:'escape.abc'}}), /inside/)
  await assert.rejects(renderMusicScore({root,args:{abc_path:join(outside,'private.abc')}}), /inside/)
  await mkdir(join(root, '.eduwork'))
  await symlink(outside, join(root, '.eduwork/generated'), 'junction')
  await assert.rejects(renderMusicScore({root,args:{abc}}), /symlink/)
})
