// Prepare local OSS feed inputs. Uploading or promoting a channel is separate.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir,stat,link,copyFile} from 'node:fs/promises'
import {constants} from 'node:fs'
import {join,resolve,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import {coreModules,fileHash,windowsManifest,macSigningReceipt} from './oss-deltas.mjs'
const json=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''))
export async function prepareFeedInputs({core,deltaDirectory,archiveDirectory,fullReceipt,fullManifest,baseURL,output}){
 const m=await coreModules(core),receipt=await json(join(deltaDirectory,'delta-receipt.json')),full=await json(fullReceipt)
 assert.equal(receipt.verified,true);assert.equal(receipt.coreCommit,m.coreCommit);assert.equal(full.passed,true)
 assert.equal(full.coreCommit,m.coreCommit);assert.equal(full.edition,'EduWork-ECNU')
 assert.equal(basename(full.asset.name),full.asset.name);assert.ok(!full.asset.name.includes('\\'))
 assert.equal(receipt.version,full.version);assert.equal(receipt.target.archive.name,full.asset.name)
 assert.equal(receipt.target.archive.sha256,full.asset.sha256);assert.equal(receipt.target.archive.bytes,full.asset.bytes)
 const archive=join(archiveDirectory,full.asset.name)
 assert.equal(await fileHash(archive),full.asset.sha256);assert.equal((await stat(archive)).size,full.asset.bytes)
 const expectedNames=receipt.deltas.flatMap(d=>[d.name,d.name+'.sha256']).sort()
 assert.equal(new Set(expectedNames).size,expectedNames.length,'Duplicate delta names')
 assert.deepEqual(receipt.files.map(f=>f.name).sort(),expectedNames)
 for(const file of receipt.files){
  assert.equal(basename(file.name),file.name);assert.ok(!file.name.includes('\\'))
  assert.equal(await fileHash(join(deltaDirectory,file.name)),file.sha256);assert.equal((await stat(join(deltaDirectory,file.name))).size,file.bytes)
 }
 for(const delta of receipt.deltas){
  const file=receipt.files.find(f=>f.name===delta.name)
  assert.equal(file.sha256,delta.sha256);assert.equal(file.bytes,delta.bytes)
  assert.equal(await readFile(join(deltaDirectory,delta.name+'.sha256'),'utf8'),`${delta.sha256}  ${delta.name}\n`)
 }
 const url=new URL(baseURL);assert.equal(url.protocol,'https:');assert.ok(!url.username&&!url.password&&!url.search&&!url.hash)
 assert.ok(url.pathname.endsWith(`/${receipt.channel}/${receipt.version}/`),'Keep OSS version and channel namespaces')
 await mkdir(output,{recursive:false})
 const save=(name,value)=>writeFile(join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'})
 if(receipt.platform==='windows'){
  assert.ok(fullManifest);await save('update-windows-amd64.json',windowsManifest(await json(fullManifest),receipt,baseURL))
 }else{
  assert.equal(receipt.platform,'macos');assert.ok(full.softwareAutoUpdate??full.sparkleEnabled)
  await save('macos-signing-receipt.json',macSigningReceipt(full,receipt))
  // The public signing command expects each patch beside the unchanged ZIP.
  for(const file of [full.asset,...receipt.files]){
   const source=file.name===full.asset.name?archive:join(deltaDirectory,file.name),target=join(output,file.name)
   try{await link(source,target)}catch(e){if(e.code!=='EXDEV')throw e;await copyFile(source,target,constants.COPYFILE_EXCL)}
  }
 }
 const result={version:receipt.version,channel:receipt.channel,platform:receipt.platform,coreCommit:m.coreCommit,deltaReceiptSHA256:await fileHash(join(deltaDirectory,'delta-receipt.json')),fullReceiptSHA256:await fileHash(fullReceipt),fullArchive:receipt.target.archive,files:receipt.files,verified:true}
 await save('feed-inputs.json',result);return result
}
async function main(){
 const args=process.argv.slice(2),o={};for(let i=0;i<args.length;i+=2){assert.match(args[i],/^--[a-z-]+$/);assert.ok(args[i+1]);o[args[i].slice(2)]=args[i+1]}
 for(const k of ['core','delta-directory','archive-directory','full-receipt','base-url','output'])assert.ok(o[k],`Missing --${k}`)
 const result=await prepareFeedInputs({core:resolve(o.core),deltaDirectory:resolve(o['delta-directory']),archiveDirectory:resolve(o['archive-directory']),fullReceipt:resolve(o['full-receipt']),fullManifest:o['full-manifest'],baseURL:o['base-url'],output:resolve(o.output)})
 console.log(JSON.stringify({version:result.version,platform:result.platform,files:result.files.length,verified:result.verified}))
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main()
