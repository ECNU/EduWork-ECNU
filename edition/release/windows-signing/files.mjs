import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { coreModule, toolsLock } from './core.mjs'
import { fileIdentity } from './operations.mjs'
import { validateSigningReceipt } from './receipt.mjs'
import { ownedWindowsFiles } from './protocol.mjs'

export function compareManifests(original,delivered) {
  const baseline=new Map(original.files.map(f=>[f.path,f]))
  assert.equal(baseline.size,original.files.length)
  assert.equal(delivered.files.length,baseline.size,'Extra or missing delivered files')
  const seen=new Set()
  for(const file of delivered.files) {
    assert(!seen.has(file.path));seen.add(file.path)
    const before=baseline.get(file.path);assert(before,'Unexpected delivered file')
    if(!ownedWindowsFiles.includes(file.path)) assert.deepEqual(file,before,`Unsigned file changed: ${file.path}`)
  }
  for(const name of ownedWindowsFiles) assert(seen.has(name),'Missing signed file')
}
export async function validateOriginalReceipt(receipt,context) {
  const {validateReceipt}=await coreModule('scripts/publish-windows-release.mjs')
  validateReceipt(receipt,context)
  assert.equal(receipt.edition,'EduWork-ECNU');assert.equal(receipt.distribution,'eduwork-chatecnu')
  assert.equal(receipt.recipe,'pinned-source');assert.equal(receipt.signing,undefined)
  for(const check of ['sourceSnapshot','publisherFirstLaunch','mediaTemplate']) assert.equal(receipt.checks[check],'passed',check)
}
export async function validateSignedFiles(directory,{repository,version,commit,policy}) {
  assert.equal(repository.toLowerCase(),'ecnu/eduwork-ecnu')
  const receipt=JSON.parse(await readFile(join(directory,'release-receipt.json'),'utf8'))
  const {validateReceipt,validateExtractorReceipt}=await coreModule('scripts/publish-windows-release.mjs')
  validateReceipt(receipt,{repository,version,commit})
  validateSigningReceipt(receipt,policy)
  assert.equal(receipt.signing.toolsCommit,toolsLock.commit)
  assert.equal(receipt.distribution,'eduwork-chatecnu')
  const {githubUpdateManifestBytes,updateManifestName}=await coreModule('scripts/github-update-manifest.mjs')
  const {windowsDeltaName}=await coreModule('scripts/windows-update-delta.mjs')
  const exeName=`EduWork-ECNU-${version}-windows-x64-setup.exe`
  assert.equal(receipt.setupExecutable.name,exeName)
  const signedSetup=receipt.signing.files.find(f=>f.path==='EduWork-ECNU-Setup.exe')
  assert.deepEqual(receipt.setupExecutable,{name:exeName,bytes:signedSetup.bytes,sha256:signedSetup.sha256})
  const descriptors=[receipt.asset,receipt.portableExtractor.asset,receipt.setupExecutable,...(receipt.deltas??[])]
  const names=descriptors.flatMap(x=>[x.name,x.name+'.sha256'])
  names.push('release-receipt.json','RELEASE-NOTES.md',updateManifestName,receipt.portableExtractor.receipt.name)
  assert.equal(new Set(names).size,names.length)
  assert.deepEqual((await readdir(directory)).sort(),[...names].sort(),'Unexpected final artifacts')
  for(const delta of receipt.deltas??[]) assert.equal(delta.name,windowsDeltaName('EduWork-ECNU',version,delta.from))
  const files=[]
  for(const name of names) files.push({name,path:join(directory,name),...await fileIdentity(join(directory,name))})
  for(const descriptor of [...descriptors,receipt.portableExtractor.receipt]) {
    const actual=files.find(f=>f.name===descriptor.name)
    assert.equal(actual.bytes,descriptor.bytes);assert.equal(actual.sha256,descriptor.sha256,descriptor.name)
  }
  for(const d of descriptors) assert.equal((await readFile(join(directory,d.name+'.sha256'),'utf8')).trim(),`${d.sha256}  ${d.name}`)
  assert.equal(files.find(f=>f.name==='RELEASE-NOTES.md').sha256,receipt.releaseNotes.sha256)
  assert.equal(await readFile(join(directory,updateManifestName),'utf8'),githubUpdateManifestBytes(receipt,repository))
  const extractor=JSON.parse(await readFile(join(directory,receipt.portableExtractor.receipt.name),'utf8'))
  // The receipt keeps business coreCommit unchanged. Only the separately pinned
  // Setup source is supplied to the core's extractor-source assertion.
  validateExtractorReceipt(extractor,{...receipt,coreCommit:toolsLock.commit})
  assert.equal(extractor.extractor.sha256,signedSetup.sha256);assert.equal(extractor.extractor.bytes,signedSetup.bytes)
  return {files,receipt}
}
