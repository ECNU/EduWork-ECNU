// School adapters around the pinned public packer/acceptance stages. No core
// file is edited, no signed PE resource is rewritten, and finalization never
// rebuilds the Setup executable.
import assert from 'node:assert/strict'
import { createReadStream, createWriteStream } from 'node:fs'
import { open, readFile, writeFile, mkdir, copyFile, lstat } from 'node:fs/promises'
import { join, dirname, basename, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'
import { pipeline } from 'node:stream/promises'
import { coreRoot, coreURL, coreModule, toolsRoot, toolsLock, verifyCheckout } from './core.mjs'
import { sha256File, writeJSON, run } from './util.mjs'
import { fileIdentity } from './operations.mjs'

const manifestURL = coreURL('dsh-electron/scripts/set-updater-manifest.mjs')
const manifestAdapter = `
  import assert from 'node:assert/strict';
  import {readPEResources,getResource} from ${JSON.stringify(coreURL('scripts/lib/windows-pe.mjs'))};
  import {sha256File} from ${JSON.stringify(new URL('util.mjs',import.meta.url).href)};
  export {assertInvokerManifest} from ${JSON.stringify(manifestURL+'?original')};
  import {assertInvokerManifest} from ${JSON.stringify(manifestURL+'?original')};
  export async function setUpdaterManifest({executable,verifyOnly}) {
    assert.equal(verifyOnly,true,'Signed PE resource edits are forbidden');
    const before=await sha256File(executable);
    const resources=(await readPEResources(executable,{ignoreCert:true})).resources;
    const entries=getResource(resources.entries,24,1);assert.equal(entries.length,1);
    assertInvokerManifest(entries[0].bin);assert.equal(await sha256File(executable),before);
  }`
const portableURL = coreURL('scripts/portable-extractor.mjs')
const extractorAdapter = `export {prepareSignedExtractor as prepareWindowsPortableExtractor} from ${JSON.stringify(import.meta.url)};`
// Resolve only the two known modules. All other core code executes unchanged.
registerHooks({resolve(specifier,context,next){
  const result=next(specifier,context)
  const source=result.url===manifestURL?manifestAdapter:result.url===portableURL?extractorAdapter:null
  return source?{url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true}:result
}})

export async function packSignedInner(candidate,output) {
  const {packWindowsRelease}=await coreModule('scripts/pack-windows-release.mjs')
  return packWindowsRelease({candidate,output,forUpdate:true})
}
export async function buildSetup(archive,outputDirectory) {
  await verifyCheckout(toolsRoot(),toolsLock.commit)
  const {packPortableExtractor}=await import(pathToFileURL(join(toolsRoot(),'scripts/portable-extractor.mjs')))
  const receipt=await packPortableExtractor({archive,expectedSHA256:await sha256File(archive),outputDirectory})
  assert.equal(receipt.extractor.sourceCommit,toolsLock.commit);assert.equal(receipt.extractor.sourceDirty,false)
  const handle=await open(join(outputDirectory,receipt.extractor.name),'r')
  let footer
  try { footer=Buffer.alloc(32);await handle.read(footer,0,32,(await handle.stat()).size-32) } finally {await handle.close()}
  assert(footer.subarray(0,16).equals(Buffer.from('EDUWORK-SFX-v1\0\0','ascii')))
  const payloadOffset=Number(footer.readBigUInt64LE(16))
  assert.equal(Number(footer.readBigUInt64LE(24)),receipt.payload.bytes)
  assert(Number.isSafeInteger(payloadOffset)&&payloadOffset>0)
  await verifyCheckout(toolsRoot(),toolsLock.commit)
  return {receipt,payloadOffset}
}
export async function recoverArchive(executable,prepared,archive) {
  const {payloadOffset,receipt}=prepared
  assert(Number.isSafeInteger(payloadOffset)&&payloadOffset>0)
  assert(Number.isSafeInteger(receipt.payload.bytes)&&receipt.payload.bytes>0)
  await mkdir(dirname(archive),{recursive:true})
  await pipeline(createReadStream(executable,{start:payloadOffset,end:payloadOffset+receipt.payload.bytes-1}),createWriteStream(archive,{flags:'wx'}))
  assert.deepEqual(await fileIdentity(archive),{bytes:receipt.payload.bytes,sha256:receipt.payload.sha256})
  await writeFile(archive+'.sha256',`${receipt.payload.sha256}  ${basename(archive)}\n`,{flag:'wx'})
}

let signedExtractor
export async function acceptSignedPackage({output,archive,extractorDirectory,prepared,receipt}) {
  assert.equal(signedExtractor,undefined,'One acceptance per process')
  assert.equal(receipt.checks.publisherFirstLaunch,'passed','Original publisher first launch must pass')
  assert.equal(receipt.checks.sourceSnapshot,'passed')
  signedExtractor={directory:extractorDirectory,prepared}
  await writeJSON(join(output,'desktop/package.json'),{output:archive,sha256:await sha256File(archive)})
  const {windowsStages}=await coreModule('scripts/lib/windows-stages.mjs')
  const workspace={resolvePath:path=>join(output,path),parameters:{edition:receipt.edition,development:false,forUpdate:true,verifySnapshot:true,verifyPublisherBootstrap:true}}
  await windowsStages({coreRoot:coreRoot(),receiptBase:receipt}).find(stage=>stage.name==='accept').run(workspace)
  return JSON.parse(await readFile(join(output,'gui/acceptance-checks.json'),'utf8'))
}
export async function prepareSignedExtractor({archive,expectedSHA256,target,publishDirectory}) {
  assert(signedExtractor,'No signed extractor supplied')
  const {directory,prepared}=signedExtractor,receipt=structuredClone(prepared.receipt)
  const executable=join(directory,receipt.extractor.name)
  assert.equal(await sha256File(archive),receipt.payload.sha256);assert.equal(expectedSHA256,receipt.payload.sha256)
  await mkdir(dirname(target),{recursive:true})
  assert.equal(await lstat(target).then(()=>true,e=>{if(e.code!=='ENOENT')throw e;return false}),false)
  const report=join(directory,'signed-extraction.json')
  const before=await fileIdentity(executable)
  await run(executable,['--extract-to',target,'--report',report])
  const extraction=JSON.parse(await readFile(report,'utf8'))
  assert.equal(extraction.success,true);assert.equal(resolve(extraction.target),resolve(target))
  assert.equal(extraction.identity.sha256,expectedSHA256);assert.equal(extraction.identity.bytes,receipt.payload.bytes)
  assert.deepEqual(await fileIdentity(executable),before)
  await mkdir(publishDirectory,{recursive:true})
  const archivePath=join(publishDirectory,receipt.asset.name)
  await run('tar.exe',['-a','-cf',archivePath,'-C',directory,receipt.extractor.name])
  // Verify the actual delivered ZIP and its only entry, not merely its inputs.
  const {ZipReader}=await coreModule('scripts/lib/zip.mjs'),zip=await ZipReader.open(archivePath)
  assert.deepEqual(zip.entries.map(e=>e.name),[receipt.extractor.name])
  const {sha256}=await import('./protocol.mjs')
  const bytes=zip.read(zip.entries[0]);assert.equal(bytes.length,before.bytes);assert.equal(sha256(bytes),before.sha256)
  receipt.extractor={...receipt.extractor,...before}
  receipt.asset={name:receipt.asset.name,...await fileIdentity(archivePath)}
  receipt.checks={...receipt.checks,outerZIP:'passed',extraction:'passed',authenticode:'passed'}
  await writeFile(archivePath+'.sha256',`${receipt.asset.sha256}  ${receipt.asset.name}\n`,{flag:'wx'})
  const receiptPath=archivePath+'.json';await writeJSON(receiptPath,receipt)
  return {asset:receipt.asset,receipt:{name:basename(receiptPath),...await fileIdentity(receiptPath)}}
}
