// Two request rounds and finalization. The only outputs are Actions artifacts.
import assert from 'node:assert/strict'
import { mkdir, readFile, cp, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { signingGitHub, localSigningPolicy, candidateWorkflow, unpackSafe } from './io.mjs'
import { validateRequest, validateResponse, requestHash, sha256, ownedWindowsFiles } from './protocol.mjs'
import { createSigningRequest, ingestSigningResponse, verifyOwnedFiles, signingTool, fileIdentity } from './operations.mjs'
import { coreRoot, editionRoot, toolsLock, coreModule, verifyInputs, verifyCheckout } from './core.mjs'
import { validateSigningReceipt } from './receipt.mjs'
import { compareManifests,validateSignedFiles,validateOriginalReceipt } from './files.mjs'
import { writeJSON, sha256File, runNode } from './util.mjs'

const env=process.env,sourceWorkflow=candidateWorkflow(env.GITHUB_REPOSITORY)
assert.equal(env.GITHUB_ACTIONS,'true');assert.equal(process.platform,'win32')
assert(['inner-request','outer-request','finalize'].includes(env.SIGNING_STAGE))
for(const key of ['SOURCE_RUN_ID','GITHUB_RUN_ID']) assert.match(env[key],/^[1-9][0-9]*$/)
assert.match(env.GITHUB_SHA,/^[a-f0-9]{40}$/)
assert.equal(env.PUBLISH_RELEASE??'false','false','Signing never publishes')
const lock=await verifyInputs();await verifyCheckout(editionRoot,env.GITHUB_SHA)
const output=resolve(env.RUNNER_TEMP,'windows-signing-'+env.GITHUB_RUN_ID),stateRoot=join(output,'state')
await mkdir(output,{recursive:false})
const github=signingGitHub(env.GITHUB_REPOSITORY,env.GITHUB_TOKEN),policy=await localSigningPolicy(editionRoot)
assert(policy,'Source-pinned signing policy required')
assert.deepEqual(await github.sourceJSON('edition/windows-signing.json',env.GITHUB_SHA),policy)
assert.deepEqual(await github.sourceJSON('edition/release/windows-signing/tools.lock.json',env.GITHUB_SHA),toolsLock)
assert.deepEqual(await github.sourceJSON('core.lock.json',env.GITHUB_SHA),lock)
const source=await github.request(`/actions/runs/${env.SOURCE_RUN_ID}`)
assert.equal(source.repository.full_name.toLowerCase(),env.GITHUB_REPOSITORY.toLowerCase())
assert.equal(source.path,sourceWorkflow);assert.equal(source.event,'workflow_dispatch')
assert.equal(source.head_sha,env.GITHUB_SHA);assert.equal(source.status,'completed');assert.equal(source.conclusion,'success')
const sourceArtifact=await github.artifact(env.SOURCE_RUN_ID,'windows-unsigned')
const common={repository:env.GITHUB_REPOSITORY,editionCommit:env.GITHUB_SHA,coreCommit:lock.commit,toolsCommit:toolsLock.commit,sourceRun:env.SOURCE_RUN_ID,sourceArtifact,policySHA256:sha256(JSON.stringify(policy))}
let state,request
try {
  if(env.SIGNING_STAGE==='inner-request') {
    assert(!env.PARENT_RUN_ID&&!env.SIGNING_RESPONSE,'Initial request must not have a reply')
    await github.download(sourceArtifact,join(output,'source.zip'),join(stateRoot,'source'))
    const receipt=JSON.parse(await readFile(join(stateRoot,'source/release-receipt.json'),'utf8'))
    await validateOriginalReceipt(receipt,{repository:env.GITHUB_REPOSITORY,version:receipt.version,commit:env.GITHUB_SHA})
    assert.equal(receipt.coreCommit,lock.commit);assert.equal(receipt.recipe,'pinned-source')
    for(const check of ['sourceSnapshot','publisherFirstLaunch','mediaTemplate']) assert.equal(receipt.checks[check],'passed',check)
    assert.equal(receipt.edition,'EduWork-ECNU')
    assert.equal(receipt.distribution,'eduwork-chatecnu');assert.equal(receipt.signing,undefined)
    const {validatedReleaseFiles}=await coreModule('scripts/publish-windows-release.mjs')
    await validatedReleaseFiles(join(stateRoot,'source'),{repository:env.GITHUB_REPOSITORY,version:receipt.version,commit:env.GITHUB_SHA})
    await cp(join(stateRoot,'source/RELEASE-NOTES.md'),join(stateRoot,'RELEASE-NOTES.md'))
    await unpackSafe(join(stateRoot,'source',receipt.asset.name),join(stateRoot,'payload'))
    await rm(join(stateRoot,'source'),{recursive:true})
    const payload=join(stateRoot,'payload',receipt.edition)
    await runNode(join(coreRoot(),'scripts/verify-windows-release.mjs'),[payload,'--for-update'])
    const manifestBytes=await readFile(join(payload,'RELEASE-MANIFEST.json')),manifest=JSON.parse(manifestBytes)
    assert.equal(manifest.version,receipt.version)
    const thirdParty=join(output,'third-party-pe.json')
    await signingTool('inventory',{root:payload,exclude:ownedWindowsFiles,output:thirdParty},join(output,'inventory'))
    state={schemaVersion:1,sourceReceipt:receipt,originalManifest:manifest,originalManifestSHA256:sha256(manifestBytes),thirdPartyPE:JSON.parse(await readFile(thirdParty,'utf8'))}
    request=await createSigningRequest({stage:'inner',policy,context:{...common,version:receipt.version,product:receipt.edition,distribution:receipt.distribution,requestRun:env.GITHUB_RUN_ID,parentRun:null},root:payload,work:join(output,'digest')})
  } else {
    assert.match(env.PARENT_RUN_ID,/^[1-9][0-9]*$/);assert.notEqual(env.PARENT_RUN_ID,env.GITHUB_RUN_ID)
    assert(Buffer.byteLength(env.SIGNING_RESPONSE||'','utf8')<=60000)
    await github.signingRun(env.PARENT_RUN_ID,env.GITHUB_SHA)
    const parentArtifact=await github.artifact(env.PARENT_RUN_ID,'windows-signing-state')
    const parentRequestArtifact=await github.artifact(env.PARENT_RUN_ID,'windows-signing-request')
    await github.download(parentArtifact,join(output,'parent.zip'),stateRoot)
    state=JSON.parse(await readFile(join(stateRoot,'state.json'),'utf8'))
    const previous=JSON.parse(await readFile(join(stateRoot,'request.json'),'utf8'))
    validateRequest(previous,{...common,requestRun:env.PARENT_RUN_ID,stage:env.SIGNING_STAGE==='outer-request'?'inner':'outer'})
    assert.deepEqual(previous.policy,policy)
    await github.download(parentRequestArtifact,join(output,'parent-request.zip'),join(output,'parent-request'))
    assert.equal(requestHash(JSON.parse(await readFile(join(output,'parent-request/request.json'),'utf8'))),requestHash(previous))
    const response=JSON.parse(env.SIGNING_RESPONSE);validateResponse(response,previous)
    const record={request:previous,response,stateArtifact:parentArtifact,requestArtifact:parentRequestArtifact}
    const receipt=state.sourceReceipt,payload=join(stateRoot,'payload',receipt.edition)
    await validateOriginalReceipt(receipt,{repository:env.GITHUB_REPOSITORY,version:receipt.version,commit:env.GITHUB_SHA})
    for(const check of ['sourceSnapshot','publisherFirstLaunch','mediaTemplate']) assert.equal(receipt.checks[check],'passed',check)
    assert.equal(receipt.editionCommit,env.GITHUB_SHA);assert.equal(receipt.coreCommit,lock.commit)
    assert.equal(receipt.version,previous.context.version);assert.equal(receipt.edition,previous.context.product)
    const {packSignedInner,buildSetup,recoverArchive,acceptSignedPackage}=await import('./packaging.mjs')
    if(env.SIGNING_STAGE==='outer-request') {
      state.inner=record
      state.innerFiles=await ingestSigningResponse({request:previous,response,root:payload,work:join(output,'ingest')})
      for(const file of state.originalManifest.files) {
        if(!ownedWindowsFiles.includes(file.path)) assert.deepEqual(await fileIdentity(join(payload,file.path)),{bytes:file.bytes,sha256:file.sha256},`Unsigned file changed: ${file.path}`)
      }
      await rm(join(payload,'RELEASE-MANIFEST.json'))
      const signedArchive=join(stateRoot,'signed',receipt.asset.name)
      await packSignedInner(payload,signedArchive)
      const {ZipReader}=await coreModule('scripts/lib/zip.mjs'),archiveReader=await ZipReader.open(signedArchive)
      const deliveredManifest=JSON.parse(archiveReader.read(archiveReader.entries.find(e=>e.name===receipt.edition+'/RELEASE-MANIFEST.json')).toString('utf8'))
      compareManifests(state.originalManifest,deliveredManifest)
      state.prepared=await buildSetup(signedArchive,join(stateRoot,'extractor'))
      request=await createSigningRequest({stage:'outer',policy,context:{...previous.context,requestRun:env.GITHUB_RUN_ID,parentRun:env.PARENT_RUN_ID},root:join(stateRoot,'extractor'),work:join(output,'digest')})
      await rm(join(stateRoot,'payload'),{recursive:true});await rm(join(stateRoot,'signed'),{recursive:true})
      // The Setup now contains the immutable signed archive. Only that EXE and
      // small receipts need to cross to the final run.
      for(const name of [state.prepared.receipt.asset.name,state.prepared.receipt.asset.name+'.sha256']) await rm(join(stateRoot,'extractor',name))
    } else {
      state.outer=record
      const outerFiles=await ingestSigningResponse({request:previous,response,root:join(stateRoot,'extractor'),work:join(output,'ingest')})
      const signedArchive=join(stateRoot,'signed',receipt.asset.name),publish=join(output,'publish')
      await recoverArchive(join(stateRoot,'extractor',`${receipt.edition}-Setup.exe`),state.prepared,signedArchive)
      const checks=await acceptSignedPackage({output,archive:signedArchive,extractorDirectory:join(stateRoot,'extractor'),prepared:state.prepared,receipt})
      const delivered=join(output,'unpacked',receipt.edition)
      const innerFiles=await verifyOwnedFiles(delivered,state.inner.request,join(output,'verify-inner'))
      assert.deepEqual(innerFiles,state.innerFiles)
      compareManifests(state.originalManifest,JSON.parse(await readFile(join(delivered,'RELEASE-MANIFEST.json'),'utf8')))
      const {createWindowsDeltas}=await coreModule('scripts/windows-update-delta.mjs')
      const {deltaBaseArchives}=await coreModule('scripts/update-delta-bases.mjs'),bases=join(output,'delta-bases')
      await runNode(join(coreRoot(),'scripts/update-delta-bases.mjs'),[env.GITHUB_REPOSITORY,receipt.edition,receipt.version,'windows',bases])
      await mkdir(publish,{recursive:true})
      const deltas=await createWindowsDeltas({archive:signedArchive,bases:await deltaBaseArchives(bases,receipt.version),product:receipt.edition,version:receipt.version,output:publish})
      const signing={schemaVersion:1,kind:'eduwork-windows-detached-signing',toolsCommit:toolsLock.commit,policySHA256:common.policySHA256,sourceRun:env.SOURCE_RUN_ID,sourceArtifact,inner:state.inner,outer:state.outer,finalRun:env.GITHUB_RUN_ID,files:[...innerFiles,...outerFiles],originalManifestSHA256:state.originalManifestSHA256,preservedFiles:'passed',thirdPartyPE:state.thirdPartyPE}
      const setupName=`EduWork-ECNU-${receipt.version}-windows-x64-setup.exe`
      const completed={...receipt,passed:true,publication:'signed-and-verified',asset:checks.asset,portableExtractor:checks.portableExtractorAssets,setupExecutable:{name:setupName,bytes:outerFiles[0].bytes,sha256:outerFiles[0].sha256},deltas,checks:{sourceAndDependencies:receipt.checks.sourceAndDependencies,...checks,authenticode:'passed'},signing}
      delete completed.checks.asset;delete completed.checks.portableExtractorAssets
      validateSigningReceipt(completed,policy)
      await cp(signedArchive,join(publish,receipt.asset.name));await cp(signedArchive+'.sha256',join(publish,receipt.asset.name+'.sha256'))
      await cp(join(output,'gui/extractor-publish'),publish,{recursive:true,errorOnExist:true})
      await cp(join(stateRoot,'extractor','EduWork-ECNU-Setup.exe'),join(publish,setupName))
      await writeFile(join(publish,setupName+'.sha256'),`${completed.setupExecutable.sha256}  ${setupName}\n`,{flag:'wx'})
      await cp(join(stateRoot,'RELEASE-NOTES.md'),join(publish,'RELEASE-NOTES.md'))
      await writeJSON(join(publish,'release-receipt.json'),completed)
      const {githubUpdateManifestBytes,updateManifestName}=await coreModule('scripts/github-update-manifest.mjs')
      await writeFile(join(publish,updateManifestName),githubUpdateManifestBytes(completed,env.GITHUB_REPOSITORY),{flag:'wx'})
      await validateSignedFiles(publish,{repository:env.GITHUB_REPOSITORY,version:receipt.version,commit:env.GITHUB_SHA,policy})
    }
  }
  if(request) {
    // Preserve the downloaded parent receipts; do not overwrite their identity.
    for(const name of ['state.json','request.json']) await rm(join(stateRoot,name),{force:true})
    await writeJSON(join(stateRoot,'state.json'),state);await writeJSON(join(stateRoot,'request.json'),request)
    await writeJSON(join(output,'request/request.json'),request)
    const filesRoot=request.stage==='inner'?join(stateRoot,'payload',request.context.product):join(stateRoot,'extractor')
    for(const entry of request.entries) {
      const destination=join(output,'request-files',entry.path)
      await mkdir(resolve(destination,'..'),{recursive:true});await cp(join(filesRoot,entry.path),destination,{errorOnExist:true,force:false})
    }
    console.log(`Request SHA256: ${requestHash(request)}`)
  }
  await verifyInputs();await verifyCheckout(editionRoot,env.GITHUB_SHA)
  await writeJSON(join(output,'evidence-public/signing-result.json'),{passed:true,stage:env.SIGNING_STAGE,...common,run:env.GITHUB_RUN_ID,published:false})
} catch(error) {
  await writeJSON(join(output,'evidence-public/signing-failure.json'),{passed:false,stage:env.SIGNING_STAGE,error:error.message,...common})
  throw error
}
