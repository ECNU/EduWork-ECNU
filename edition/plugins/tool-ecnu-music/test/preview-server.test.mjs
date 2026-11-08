import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp,mkdir,writeFile,readFile,rm,symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createSongServer } from '../../../skills/ecnu-music/scripts/serve-song.mjs'
const exec=promisify(execFile),script=fileURLToPath(new URL('../../../skills/ecnu-music/scripts/serve-song.mjs',import.meta.url))
async function directory(){const parent=await mkdtemp(join(tmpdir(),'song-http-')),root=join(parent,'song');await mkdir(root);for(const [file,value]of Object.entries({'index.html':'<h1>Song</h1>','lyrics.txt':'Lyrics','score.abc':'K:C\nCDEF|','timeline.json':'{"schema":"eduwork.music.timeline.v1"}','audio.wav':'0123456789'}))await writeFile(join(root,file),value);return {root,parent}}
test('loopback server only serves bundle allowlist and supports byte ranges for seeking',async t=>{
  const {root,parent}=await directory(),{server,record}=await createSongServer(root)
  t.after(async()=>{await new Promise(r=>{server.closeAllConnections();server.close(r)});await rm(parent,{recursive:true,force:true})})
  const get=(suffix='',options)=>fetch(record.url+suffix,options)
  assert.match(await (await get()).text(),/Song/)
  const head=await get('audio.wav',{method:'HEAD'});assert.equal(head.headers.get('content-length'),'10');assert.equal(await head.text(),'')
  for(const [range,body,header]of[['bytes=2-4','234','bytes 2-4/10'],['bytes=-3','789','bytes 7-9/10'],['bytes=8-99','89','bytes 8-9/10']]){const r=await get('audio.wav',{headers:{Range:range}});assert.equal(r.status,206);assert.equal(r.headers.get('content-range'),header);assert.equal(await r.text(),body)}
  for(const range of ['bytes=99-','bytes=5-3','bytes=-0','bytes=1-2,4-5','invalid'])assert.equal((await get('audio.wav',{headers:{Range:range}})).status,416)
  for(const suffix of ['secret.txt','%2e%2e/secret','index.html?path=../','audio.wav/anything'])assert.equal((await get(suffix)).status,404)
  assert.equal((await get('',{headers:{Origin:'https://example.com'}})).status,403)
  assert.equal((await get('',{method:'POST'})).status,404)
  assert.equal((await fetch(new URL('/',record.url))).status,404)
  await symlink(join(root,'audio.wav'),join(root,'audio.mp3'));assert.equal((await get('audio.mp3')).status,403)
})
test('preview CLI starts hidden, reuses same service, records logs and stops only that service',async t=>{
  const {root,parent}=await directory(),run=async(action,arg)=>JSON.parse((await exec(process.execPath,[script,action,arg],{windowsHide:true})).stdout)
  t.after(async()=>{await run('stop',join(parent,'.previews','song.json'));await new Promise(r=>setTimeout(r,100));await rm(parent,{recursive:true,force:true})})
  const started=await run('start',root)
  assert.equal(started.reused,false);assert.ok(started.url.startsWith('http://127.0.0.1:'))
  const again=await run('start',root);assert.equal(again.reused,true);assert.equal(again.pid,started.pid)
  assert.equal((await run('status',started.state)).running,true)
  const state=JSON.parse(await readFile(started.state,'utf8'));assert.ok(state.startedAt);await readFile(state.stdout);assert.equal(await readFile(state.stderr,'utf8'),'')
  assert.equal((await run('stop',started.state)).stopped,true)
  await new Promise(r=>setTimeout(r,100));assert.equal((await run('status',started.state)).running,false)
})
