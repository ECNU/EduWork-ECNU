import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,createHash} from 'node:crypto'
import {mkdtemp,mkdir,rm,readFile,writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {coreModules,releasePlan,prepareDeltas,windowsManifest,macSigningReceipt,repository,product} from '../release/oss-deltas.mjs'
import {prepareFeedInputs} from '../release/oss-feed-inputs.mjs'
const core=resolve(process.env.EDUWORK_CORE_ROOT),m=await coreModules(core)
const from='0.4.5-dev.20261016.1',version='0.4.6-dev.20261017.1',hash=b=>createHash('sha256').update(b).digest('hex')
function release(v,bytes=Buffer.from(v),platform='windows'){
 const name=`${product}-${v}-${platform==='windows'?'windows-x64':'macos-arm64'}-electron.zip`
 return {tag_name:'v'+v,draft:false,prerelease:v.includes('-'),published_at:'2026-10-17T00:00:00Z',html_url:`https://github.com/${repository}/releases/tag/v${v}`,assets:[{name,size:bytes.length,digest:'sha256:'+hash(bytes),browser_download_url:`https://github.com/${repository}/releases/download/v${v}/${name}`}]}
}
const plan=releases=>releasePlan(releases,{version,platform:'windows',...m})
test('OSS selects older published releases including dev; target channel remains independent',()=>{
 const list=[release('0.4.2'),release(from),release(version),release('0.4.3'),release('0.4.6')]
 const p=plan(list);assert.equal(p.channel,'development');assert.deepEqual(p.bases.map(x=>x.version),[from,'0.4.3','0.4.2'])
 const stable=releasePlan(list,{version:'0.4.6',platform:'windows',...m});assert.equal(stable.channel,'stable');assert.equal(stable.bases[0].version,version)
 assert.equal(plan([...list,{...release('0.4.5'),draft:true}]).bases.length,3)
 assert.throws(()=>plan([{...release(version),prerelease:false}]))
})
test('foreign or unhashed archive cannot become a trusted OSS delta input',()=>{
 const target=release(version);target.assets[0].browser_download_url=target.assets[0].browser_download_url.replace('EduWork-ECNU/releases','EduWork/releases')
 assert.throws(()=>plan([target]),/same edition/)
 const base=release(from);delete base.assets[0].digest;assert.throws(()=>plan([release(version),base]),/digest/)
})
async function fixture(t,targetVersion=version){
 const root=await mkdtemp(join(tmpdir(),'ecnu-oss-delta-'));t.after(()=>rm(root,{recursive:true,force:true}))
 const cache=join(root,'cache');await mkdir(cache);const runtime=randomBytes(128*1024),releases=[]
 for(const [v,text]of [[from,'old'],[targetVersion,'new']]){
  const files={'EduWork-Electron.exe':runtime,'resources/app.js':Buffer.from(text),'config/eduwork.jsonc':Buffer.from('{}')}
  const manifest=Buffer.from(JSON.stringify({schemaVersion:1,version:v,launcherVersion:v,flavor:'offline',files:Object.entries(files).map(([path,b])=>({path,bytes:b.length,sha256:hash(b)}))}))
  const name=release(v).assets[0].name,zip=await m.ZipWriter.create(join(cache,name));await zip.addEntry(product+'/RELEASE-MANIFEST.json',manifest)
  for(const [path,b]of Object.entries(files))await zip.addEntry(product+'/'+path,b)
  await zip.close();releases.push(release(v,await readFile(join(cache,name))))
 }
 return {root,cache,releases}
}
test('actual public delta builder supports dev-to-dev and manifest keeps full fallback',async t=>{
 const f=await fixture(t),output=join(f.root,'delta')
 const result=await prepareDeltas({core,...f,version,platform:'windows',output})
 assert.equal(result.website,undefined,'Development delivery never prepares a stable website pointer')
 await assert.rejects(readFile(join(output,'latest-windows-amd64.json')),{code:'ENOENT'})
 assert.equal(result.deltas.length,1);assert.equal(result.deltas[0].from,from)
 const full={version,channel:'development',distribution:'eduwork-chatecnu',target:'windows-amd64',artifacts:[{shell:'electron',flavor:'offline',fileName:result.target.archive.name,bytes:result.target.archive.bytes,sha256:result.target.archive.sha256,url:result.target.archive.url}]}
 const before=structuredClone(full),updated=windowsManifest(full,result,'https://example.org/development/'+version+'/')
 assert.deepEqual(full,before,'Never rewrite the GitHub manifest')
 assert.equal(updated.artifacts[0].bytes,full.artifacts[0].bytes);assert.equal(updated.artifacts[0].deltas[0].fromVersion,from)
 assert.match(updated.artifacts[0].deltas[0].url,/\/development\/0\.4\.6-dev\.20261017\.1\//)
 const patch=await m.ZipReader.open(join(output,result.deltas[0].name))
 assert.ok(!patch.entries.some(e=>e.name.endsWith('/EduWork-Electron.exe')))
 assert.ok(patch.entries.some(e=>e.name.endsWith('/resources/app.js')))
 assert.throws(()=>windowsManifest({...full,channel:'stable'},result,'https://example.org/stable/'))
 assert.throws(()=>windowsManifest(full,result,'http://example.org/'))
 const fullReceipt=join(f.root,'full-receipt.json'),fullManifest=join(f.root,'full-manifest.json')
 await writeFile(fullReceipt,JSON.stringify({passed:true,edition:product,coreCommit:m.coreCommit,version,asset:result.target.archive}))
 await writeFile(fullManifest,JSON.stringify(full))
 const inputs={core,deltaDirectory:output,archiveDirectory:f.cache,fullReceipt,fullManifest,baseURL:'https://example.org/development/'+version+'/'}
 const ready=await prepareFeedInputs({...inputs,output:join(f.root,'feed')})
 assert.equal(ready.verified,true)
 await assert.rejects(prepareFeedInputs({...inputs,baseURL:'https://example.org/stable/'+version+'/',output:join(f.root,'bad-channel')}),/namespaces/)
 const wrong=structuredClone(result);wrong.deltas[0].sha256='f'.repeat(64)
 await writeFile(join(output,'delta-receipt.json'),JSON.stringify(wrong))
 await assert.rejects(prepareFeedInputs({...inputs,output:join(f.root,'wrong-descriptor')}))
 await writeFile(join(output,'delta-receipt.json'),JSON.stringify(result))
 await writeFile(join(output,result.deltas[0].name),'corrupt')
 await assert.rejects(prepareFeedInputs({...inputs,output:join(f.root,'corrupt-patch')}))
 await writeFile(join(f.cache,result.target.archive.name),'corrupt')
 await assert.rejects(prepareDeltas({core,...f,version,platform:'windows',output:join(f.root,'corrupt-output')}))
})
test('stable delta preparation includes an installer pointer and records its hash',async t=>{
 const stable='0.4.6',f=await fixture(t,stable),target=f.releases.find(r=>r.tag_name==='v'+stable)
 const name=`${product}-${stable}-windows-x64-setup.zip`
 target.assets.push({name,size:123,digest:'sha256:'+hash('synthetic installer'),browser_download_url:`https://github.com/${repository}/releases/download/v${stable}/${name}`})
 const output=join(f.root,'stable-delta')
 const result=await prepareDeltas({core,...f,version:stable,platform:'windows',output})
 const bytes=await readFile(join(output,'latest-windows-amd64.json')),pointer=JSON.parse(bytes)
 assert.equal(pointer.version,stable);assert.equal(pointer.artifacts[0].fileName,name)
 assert.deepEqual(result.website,{name:'latest-windows-amd64.json',bytes:bytes.length,sha256:hash(bytes)})
})

test('Mac signing uses a separate derived receipt and preserves CI provenance',()=>{
 const archive={name:'app.zip',bytes:100,sha256:'a'.repeat(64)},full={passed:true,version,edition:product,asset:archive,editionCommit:'b'.repeat(40),deltas:[]}
 const receipt={kind:'eduwork-ecnu-oss-deltas',verified:true,platform:'macos',version,target:{archive},bases:[{version:from}],deltas:[{from,name:`${product}-${version}-macos-arm64-electron-from-${from}.delta`,bytes:20,sha256:'c'.repeat(64)}]}
 const next=macSigningReceipt(full,receipt);assert.equal(next.ossDerived,true);assert.equal(full.deltas.length,0);assert.equal(next.editionCommit,full.editionCommit);assert.equal(next.deltas.length,1)
 assert.throws(()=>macSigningReceipt({...full,asset:{...archive,sha256:'d'.repeat(64)}},receipt))
})
