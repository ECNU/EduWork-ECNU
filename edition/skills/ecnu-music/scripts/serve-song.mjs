// Zero-dependency, loopback-only preview for one exported song. Never serves a workspace root.
import { createServer } from 'node:http'
import { createReadStream, openSync, closeSync } from 'node:fs'
import { readFile, writeFile, realpath, stat, lstat, mkdir, rename, open, unlink } from 'node:fs/promises'
import { join, dirname, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

const types={'index.html':'text/html; charset=utf-8','lyrics.txt':'text/plain; charset=utf-8','score.abc':'text/vnd.abc; charset=utf-8','timeline.json':'application/json','song-timeline.js':'text/javascript; charset=utf-8','audio.flac':'audio/flac','audio.wav':'audio/wav','audio.mp3':'audio/mpeg','audio.ogg':'audio/ogg'}
export async function createSongServer(directory,{token=randomBytes(20).toString('hex'),control=randomBytes(24).toString('hex')}={}) {
  const root=await realpath(directory)
  const manifest=JSON.parse(await readFile(join(root,'timeline.json'),'utf8'))
  if(manifest.schema!=='eduwork.music.timeline.v1')throw Error('Select an exported song directory containing timeline.json')
  for(const file of ['index.html','lyrics.txt','score.abc'])if(!(await stat(join(root,file))).isFile())throw Error('Incomplete song directory')
  const server=createServer(async(req,res)=>{
    try {
      const address=server.address(),host=`127.0.0.1:${address.port}`
      if(req.headers.host!==host || (req.headers.origin && req.headers.origin!==`http://${host}`)){res.writeHead(403).end();return}
      if(req.url===`/__control/${control}`){
        if(req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({pid:process.pid,directory:root}));return}
        if(req.method==='POST'){res.writeHead(200).end('stopping');setTimeout(()=>{server.closeAllConnections();server.close()},20);return}
      }
      if(!['GET','HEAD'].includes(req.method)||!req.url?.startsWith(`/${token}/`)){res.writeHead(404).end();return}
      const name=req.url.slice(token.length+2)||'index.html'
      if(!Object.hasOwn(types,name)){res.writeHead(404).end();return}
      const path=join(root,name),canonical=await realpath(path)
      if(canonical!==path){res.writeHead(403).end();return}
      const info=await stat(canonical)
      if(!info.isFile()||info.size>129*1024*1024){res.writeHead(404).end();return}
      let start=0,end=info.size-1,status=200
      if(req.headers.range){
        const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range)
        if(!match||(!match[1]&&!match[2])){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return}
        if(!match[1])start=Math.max(0,info.size-Number(match[2]))
        else{start=Number(match[1]);if(match[2])end=Math.min(Number(match[2]),end)}
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start<0||start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return}
        status=206
      }
      res.writeHead(status,{'Content-Type':types[name],'Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(status===206?{'Content-Range':`bytes ${start}-${end}/${info.size}`}:{})})
      if(req.method==='HEAD'||!info.size){res.end();return}
      const stream=createReadStream(canonical,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res)
    }catch(error){if(!res.headersSent)res.writeHead(error.code==='ENOENT'?404:500);res.end()}
  })
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)})
  const origin=`http://127.0.0.1:${server.address().port}`
  return {server,record:{pid:process.pid,directory:root,url:`${origin}/${token}/`,controlURL:`${origin}/__control/${control}`,startedAt:new Date().toISOString()}}
}
async function alive(record){try{const url=new URL(record.controlURL);if(url.hostname!=='127.0.0.1'||url.protocol!=='http:')return false;const r=await fetch(url,{signal:AbortSignal.timeout(1000),redirect:'error'});const value=await r.json();return value.pid===record.pid&&value.directory===record.directory}catch{return false}}
async function stateAt(file){try{return JSON.parse(await readFile(file,'utf8'))}catch{return null}}
async function command(){
  const [action,arg,stateArg]=process.argv.slice(2)
  if(action==='--serve'){
    const result=await createSongServer(arg)
    try{await writeFile(stateArg,JSON.stringify({...result.record,stdout:stateArg+'.stdout.log',stderr:stateArg+'.stderr.log'},null,2),{mode:0o600})}catch(error){await new Promise(r=>result.server.close(r));throw error}
    console.log(JSON.stringify({startedAt:result.record.startedAt,pid:process.pid,directory:result.record.directory}))
    return
  }
  if(action==='start'){
    if(!arg)throw Error('Usage: node serve-song.mjs start <exported-song-directory>')
    const directory=await realpath(arg),stateRoot=join(dirname(directory),'.previews')
    await mkdir(stateRoot,{recursive:true});if((await lstat(stateRoot)).isSymbolicLink())throw Error('Preview state directory must not be a symbolic link')
    const state=join(stateRoot,basename(directory)+'.json')
    for(const file of [state,state+'.stdout.log',state+'.stderr.log']){
      const info=await lstat(file).catch(error=>{if(error.code!=='ENOENT')throw error})
      if(info&&!info.isFile())throw Error('Preview metadata must be regular files')
    }
    const lock=await open(state+'.lock','wx').catch(error=>{if(error.code==='EEXIST')throw Error('Another start is in progress; retry shortly. If it crashed, inspect '+state+'.lock');throw error})
    try {
    await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}))
    const old=await stateAt(state)
    if(old&&await alive(old)){console.log(JSON.stringify({url:old.url,pid:old.pid,state,reused:true}));return}
    if(old)await rename(state,state+'.previous-'+Date.now())
    const stdout=openSync(state+'.stdout.log','a',0o600),stderr=openSync(state+'.stderr.log','a',0o600)
    const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'--serve',directory,state],{detached:true,windowsHide:true,stdio:['ignore',stdout,stderr]});let spawnError;child.once('error',error=>{spawnError=error});child.unref();closeSync(stdout);closeSync(stderr)
    for(let attempt=0;attempt<40;attempt++){await new Promise(r=>setTimeout(r,125));if(spawnError)throw spawnError;const record=await stateAt(state);if(record&&await alive(record)){console.log(JSON.stringify({url:record.url,pid:record.pid,state,reused:false}));return}}
    throw Error('Preview did not become ready; inspect '+state+'.stderr.log')
    } finally {await lock.close();await unlink(state+'.lock')}
  }
  if(!['status','stop'].includes(action)||!arg)throw Error('Usage: node serve-song.mjs start <directory> | status <state.json> | stop <state.json>')
  const record=await stateAt(resolve(arg)),running=record&&await alive(record)
  if(action==='stop'&&running){await fetch(record.controlURL,{method:'POST',signal:AbortSignal.timeout(1000),redirect:'error'});console.log(JSON.stringify({stopped:true,pid:record.pid}));return}
  console.log(JSON.stringify({running:!!running,...(running?{url:record.url,pid:record.pid}:{})}))
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))command().catch(error=>{console.error(error.message);process.exitCode=1})
