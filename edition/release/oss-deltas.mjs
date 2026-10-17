// OSS delivery consumes published archives; it never builds or edits a GitHub release.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createReadStream,createWriteStream} from 'node:fs'
import {mkdir,readFile,writeFile,stat,rename} from 'node:fs/promises'
import {execFileSync} from 'node:child_process'
import {Readable} from 'node:stream'
import {pipeline} from 'node:stream/promises'
import {join,resolve,dirname} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'

export const repository='ECNU/EduWork-ECNU',product='EduWork-ECNU'
const edition=resolve(dirname(fileURLToPath(import.meta.url)),'../..')
const platforms={windows:'windows-x64',macos:'macos-arm64'}
const digestPattern=/^[a-f0-9]{64}$/
const json=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''))
export async function fileHash(path){const h=createHash('sha256');for await(const b of createReadStream(path))h.update(b);return h.digest('hex')}
const save=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
const command=(file,args)=>execFileSync(file,args,{windowsHide:true,stdio:'inherit'})

export async function coreModules(core){
 const lock=await json(join(edition,'core.lock.json'))
 const head=execFileSync('git',['-C',core,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim()
 assert.equal(head,lock.commit,'Use the exact public core pinned by this edition')
 assert.equal(execFileSync('git',['-C',core,'status','--porcelain'],{encoding:'utf8',windowsHide:true}).trim(),'','Public core must be clean')
 const load=path=>import(pathToFileURL(join(core,path)))
 return {...await load('scripts/desktop-build-plan.mjs'),...await load('dsh-host/content-update-protocol.mjs'),...await load('scripts/windows-update-delta.mjs'),...await load('scripts/macos-update-delta.mjs'),...await load('scripts/lib/zip.mjs'),coreCommit:head}
}

export function archiveFor(release,platform,version){
 assert.ok(platforms[platform],'Unsupported platform')
 const name=`${product}-${version}-${platforms[platform]}-electron.zip`
 const matches=release.assets.filter(a=>a.name===name)
 assert.equal(matches.length,1,`Missing or ambiguous original archive: ${name}`)
 const a=matches[0],expected=`https://github.com/${repository}/releases/download/v${version}/${name}`
 assert.equal(a.browser_download_url,expected,'Archive must belong to the same edition and release')
 assert.match(a.digest??'',/^sha256:[a-f0-9]{64}$/,'GitHub asset digest is required')
 assert.ok(Number.isSafeInteger(a.size)&&a.size>0)
 return {name,bytes:a.size,sha256:a.digest.slice(7),url:expected}
}

// Include approved prereleases as bases. Stable and development clients select
// their own channels; a delta source does not change the target's channel.
export function releasePlan(releases,{version,platform,desktopVersion,compareVersions,limit=3}){
 assert.ok(Number.isInteger(limit)&&limit>=1&&limit<=3)
 const published=releases.filter(r=>!r.draft&&r.published_at&&/^v\d+\.\d+\.\d+(?:-(?:dev|alpha|beta|rc)\.[\d.]+)?$/.test(r.tag_name))
 const valid=published.filter(r=>{try{desktopVersion(r.tag_name.slice(1));return true}catch{return false}})
 if(version==='latest')version=valid.map(r=>r.tag_name.slice(1)).sort((a,b)=>compareVersions(b,a))[0]
 const parsed=desktopVersion(version),targets=valid.filter(r=>r.tag_name==='v'+version)
 assert.equal(targets.length,1,'Target must be an already published release')
 const target=targets[0];assert.equal(target.prerelease,parsed.prerelease)
 const bases=valid.filter(r=>compareVersions(r.tag_name.slice(1),version)<0)
  .sort((a,b)=>compareVersions(b.tag_name.slice(1),a.tag_name.slice(1)))
  .filter(r=>r.assets.some(a=>a.name===`${product}-${r.tag_name.slice(1)}-${platforms[platform]}-electron.zip`)).slice(0,limit)
 return {schemaVersion:1,kind:'eduwork-ecnu-oss-delta-plan',repository,product,platform,version,channel:parsed.prerelease?'development':'stable',
  target:{version,releaseURL:target.html_url,archive:archiveFor(target,platform,version)},
  bases:bases.map(r=>({version:r.tag_name.slice(1),releaseURL:r.html_url,archive:archiveFor(r,platform,r.tag_name.slice(1))}))}
}

async function cachedArchive(asset,cache){
 await mkdir(cache,{recursive:true});const path=join(cache,asset.name)
 try{const s=await stat(path);assert.equal(s.size,asset.bytes);assert.equal(await fileHash(path),asset.sha256);return path}catch(e){if(e.code!=='ENOENT')throw e}
 const partial=path+'.partial'
 const r=await fetch(asset.url)
 assert.ok(r.ok,`Archive download failed: HTTP ${r.status}`)
 await pipeline(Readable.fromWeb(r.body),createWriteStream(partial,{flags:'wx'}))
 assert.equal((await stat(partial)).size,asset.bytes);assert.equal(await fileHash(partial),asset.sha256,'Downloaded archive differs from GitHub digest')
 await rename(partial,path);return path
}

export async function prepareDeltas({core,releases,version,platform,cache,output,limit=3}){
 const m=await coreModules(core),plan=releasePlan(releases,{version,platform,...m,limit})
 if(platform==='macos')assert.equal(process.platform,'darwin','Generate Sparkle deltas on native macOS')
 await mkdir(output,{recursive:false});await save(join(output,'plan.json'),plan)
 const archive=await cachedArchive(plan.target.archive,cache),bases=[]
 for(const base of plan.bases)bases.push(await cachedArchive(base.archive,cache))
 const inputs=[plan.target,...plan.bases]
 if(platform==='windows'){
  for(let i=0;i<inputs.length;i++){
   const zip=await m.ZipReader.open(i===0?archive:bases[i-1])
   const entries=zip.entries.filter(e=>e.name===product+'/RELEASE-MANIFEST.json');assert.equal(entries.length,1)
   assert.equal(JSON.parse(zip.read(entries[0])).version,inputs[i].version,'Archive identity differs from its release')
  }
 }
 let deltas
 if(platform==='windows')deltas=await m.createWindowsDeltas({archive,bases,product,version:plan.version,output})
 else{
  const work=join(output,'native-work'),sparkle=join(work,'sparkle'),unpacked=join(work,'target')
  await mkdir(unpacked,{recursive:true})
  command(process.execPath,[join(core,'scripts/macos-update-feed.mjs'),'prepare',join(edition,'edition/desktop/mac-updates.json'),sparkle])
  command('ditto',['-x','-k',archive,unpacked])
  const app=join(unpacked,'EduWork-ECNU.app')
  const identity=await json(join(app,'Contents/Resources/release.json'));assert.equal(identity.version,plan.version)
  command('codesign',['--verify','--deep','--strict',app])
  deltas=await m.createMacDeltas({binaryDelta:join(sparkle,'bin/BinaryDelta'),app,archiveBytes:plan.target.archive.bytes,bases,product,version:plan.version,output,work:join(work,'bases')})
 }
 const files=[]
 for(const d of deltas){
  assert.ok(plan.bases.some(b=>b.version===d.from));assert.equal(await fileHash(join(output,d.name)),d.sha256)
  assert.equal((await stat(join(output,d.name))).size,d.bytes)
  files.push({name:d.name,bytes:d.bytes,sha256:d.sha256})
  // Windows already produces this sidecar; give native Mac patches the same
  // immutable-object delivery/checksum contract without changing Sparkle.
  const side=join(output,d.name+'.sha256'),text=`${d.sha256}  ${d.name}\n`
  if(platform==='macos')await writeFile(side,text,{flag:'wx'});else assert.equal(await readFile(side,'utf8'),text)
  files.push({name:d.name+'.sha256',bytes:Buffer.byteLength(text),sha256:await fileHash(side)})
 }
 const result={...plan,kind:'eduwork-ecnu-oss-deltas',coreCommit:m.coreCommit,verified:true,nativeReconstruction:platform==='macos'?'BinaryDelta apply and full tree diff':'file manifest matching; installed updater acceptance required',deltas,files,
  skippedBases:plan.bases.filter(b=>!deltas.some(d=>d.from===b.version)).map(b=>({version:b.version,reason:'delta-larger-than-half-full-archive'}))}
 await save(join(output,'delta-receipt.json'),result)
 console.log(JSON.stringify({version:plan.version,platform,deltas:deltas.map(({from,bytes})=>({from,bytes})),skipped:result.skippedBases}))
 return result
}

export function windowsManifest(full,receipt,baseURL){
 assert.equal(receipt.kind,'eduwork-ecnu-oss-deltas');assert.equal(receipt.verified,true);assert.equal(receipt.platform,'windows')
 assert.equal(full.version,receipt.version);assert.equal(full.channel,receipt.channel);assert.equal(full.distribution,'eduwork-chatecnu');assert.equal(full.target,'windows-amd64')
 const origin=new URL(baseURL);assert.equal(origin.protocol,'https:');assert.ok(!origin.search&&!origin.hash&&!origin.username&&!origin.password);assert.ok(origin.pathname.endsWith('/'))
 const result=structuredClone(full),matches=result.artifacts.filter(a=>a.fileName===receipt.target.archive.name)
 assert.equal(matches.length,1);const artifact=matches[0]
 assert.equal(artifact.sha256,receipt.target.archive.sha256);assert.equal(artifact.bytes,receipt.target.archive.bytes);assert.equal(artifact.shell,'electron')
 artifact.url=new URL(artifact.fileName,origin).href;artifact.sha256Url=artifact.url+'.sha256'
 artifact.deltas=receipt.deltas.map(d=>{
  assert.match(d.sha256,digestPattern);assert.match(d.fromManifestSha256,digestPattern)
  assert.equal(d.name,`${product}-${receipt.version}-windows-x64-electron-from-${d.from}.zip`)
  assert.ok(receipt.bases.some(b=>b.version===d.from));assert.ok(d.bytes>0&&d.bytes<=artifact.bytes/2)
  return {fromVersion:d.from,fromManifestSha256:d.fromManifestSha256,fileName:d.name,bytes:d.bytes,sha256:d.sha256,url:new URL(d.name,origin).href,sha256Url:new URL(d.name+'.sha256',origin).href}
 })
 return result
}

export function macSigningReceipt(full,receipt){
 assert.equal(receipt.kind,'eduwork-ecnu-oss-deltas');assert.equal(receipt.verified,true);assert.equal(receipt.platform,'macos')
 assert.equal(full.passed,true);assert.equal(full.version,receipt.version);assert.equal(full.edition,product);assert.equal(full.asset.name,receipt.target.archive.name)
 assert.equal(full.asset.sha256,receipt.target.archive.sha256);assert.equal(full.asset.bytes,receipt.target.archive.bytes)
 for(const d of receipt.deltas){
  assert.match(d.sha256,digestPattern)
  assert.equal(d.name,`${product}-${receipt.version}-macos-arm64-electron-from-${d.from}.delta`)
  assert.ok(receipt.bases.some(b=>b.version===d.from));assert.ok(Number.isSafeInteger(d.bytes)&&d.bytes>0&&d.bytes<=full.asset.bytes/2)
 }
 // Keep the original CI receipt immutable. This derived input only supplies
 // the independently generated OSS patches to the public signing helper.
 return {...full,ossDerived:true,deltas:receipt.deltas}
}

async function main(){
 const args=process.argv.slice(2),options={}
 for(let i=0;i<args.length;i+=2){assert.match(args[i],/^--[a-z-]+$/);assert.ok(args[i+1]);assert.ok(!Object.hasOwn(options,args[i].slice(2)));options[args[i].slice(2)]=args[i+1]}
 for(const name of ['core','version','platform','cache','output'])assert.ok(options[name],`Missing --${name}`)
 let releases
 if(options['releases-file'])releases=await json(options['releases-file'])
 else{
  const r=await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100`,{headers:{Accept:'application/vnd.github+json',...(process.env.GITHUB_TOKEN?{Authorization:'Bearer '+process.env.GITHUB_TOKEN}:{})}})
  assert.ok(r.ok,`Release listing: HTTP ${r.status}`);releases=await r.json()
 }
 await prepareDeltas({...options,core:resolve(options.core),cache:resolve(options.cache),output:resolve(options.output),releases,limit:options.limit?Number(options.limit):3})
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main()
