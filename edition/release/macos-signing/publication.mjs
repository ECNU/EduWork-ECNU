import assert from 'node:assert/strict'
import {textHash} from './github.mjs'

export function validateSourceRun(run) {
  assert.equal(run.repository.full_name,'ECNU/EduWork-ECNU')
  assert.equal(run.path,'.github/workflows/macos-signing-release.yml')
  assert.equal(run.event,'workflow_dispatch');assert.equal(run.head_branch,'main')
  assert.equal(run.status,'completed');assert.equal(run.conclusion,'success')
  assert.match(run.head_sha,/^[a-f0-9]{40}$/)
}
export function validateQualification(receipt,minimum,signature,plan,policy,run,arch) {
  assert.equal(receipt.edition,'EduWork-ECNU');assert.equal(receipt.version,plan.version)
  assert.equal(receipt.platform,'macos-'+arch);assert.equal(receipt.editionCommit,plan.editionCommit)
  assert.equal(receipt.coreCommit,plan.coreCommit);assert.equal(receipt.passed,true)
  assert.equal(receipt.developerIDSigned,true);assert.equal(receipt.notarized,true)
  assert.equal(receipt.minimumSystemVersion,'15.0');assert.equal(receipt.applicationName,'EduWork-ECNU.app')
  assert.equal(receipt.asset.name,`EduWork-ECNU-${plan.version}-macos-${arch}-electron.zip`)
  assert.equal(receipt.installer.asset.name,receipt.asset.name.replace(/\.zip$/,'.dmg'))
  const signed=receipt.developerIDSigning
  for(const key of ['teamId','identity','certificateSHA256'])assert.equal(signed[key],policy[key])
  assert.equal(signed.runId,String(run.id));assert.equal(signed.signerCommit,run.head_sha)
  assert.equal(signed.nonCodeContentPreserved,true)
  for(const key of ['applicationNotarization','diskImageNotarization'])assert.equal(signed[key].status,'Accepted')
  for(const key of ['desktopLaunch','nativeRuntimes','readOnlyApplication','developerIDSignature','appleNotarization','nonCodeContentPreserved'])assert.equal(receipt.checks[key],'passed')
  const source=plan.assets.find(a=>a.name===receipt.asset.name)
  assert.equal(source.digest,'sha256:'+signed.originalAsset.sha256);assert.equal(source.size,signed.originalAsset.bytes)
  for(const result of [minimum,signature]) {
    assert.equal(result.passed,true);assert.equal(result.arch,arch);assert.deepEqual(result.asset,receipt.asset)
  }
  assert.match(minimum.os,/^15\./);assert.equal(minimum.coreCommit,plan.coreCommit)
  for(const key of ['desktopLaunch','nativeRuntimes','readOnlyApplication'])assert.equal(minimum.checks[key],'passed')
  assert.equal(signature.runId,String(run.id));assert.equal(signature.signerCommit,run.head_sha)
  assert.deepEqual(signature.installer,receipt.installer.asset)
  for(const key of ['developerIDSignature','applicationTicket','diskImageTicket','applicationGatekeeper','diskImageGatekeeper'])assert.equal(signature.checks[key],'passed')
}
export function sameBytes(asset,expected) {return asset?.size===expected.bytes&&asset?.digest==='sha256:'+expected.sha256}
export function validatePublicationState(release,plan,items,runId) {
  assert.equal(release.id,plan.releaseId);assert.equal(release.tag_name,plan.tag)
  assert.equal(release.target_commitish,plan.editionCommit);assert.equal(release.draft,false);assert.equal(release.immutable,false)
  assert.equal(textHash(release.body),plan.bodySHA256)
  const byName=new Map(release.assets.map(a=>[a.name,a]));assert.equal(byName.size,release.assets.length)
  const names=new Set(items.map(item=>item.name));assert.equal(names.size,10)
  for(const old of plan.assets) {
    if(names.has(old.name))continue
    const found=byName.get(old.name);assert(found,'Missing non-Mac asset '+old.name)
    for(const key of ['id','size','digest'])assert.equal(found[key],old[key],'Non-Mac asset changed: '+old.name)
  }
  const allowed=new Set(plan.assets.map(a=>a.name))
  for(const item of items) {
    const old=plan.assets.find(a=>a.name===item.name);assert(old)
    const stage=`macos-signing-stage-${runId}-${item.name}`,backup=`macos-signing-backup-${runId}-${item.name}`
    allowed.add(stage);allowed.add(backup)
    const current=byName.get(item.name),staged=byName.get(stage),saved=byName.get(backup)
    const original=a=>a?.id===old.id&&a.size===old.size&&a.digest===old.digest
    assert(!current||original(current)||sameBytes(current,item.expected),'Unknown canonical asset: '+item.name)
    if(staged)assert(sameBytes(staged,item.expected),'Invalid staged asset')
    if(saved)assert(original(saved),'Invalid rollback asset')
    assert(original(current)||saved||sameBytes(current,item.expected),'Original asset missing before replacement')
    assert(!(!current&&!staged),'Missing replacement for renamed original')
  }
  for(const name of byName.keys())assert(allowed.has(name),'Unexpected release asset '+name)
  return byName
}
// Every upload is verified before the first rename. Interrupted renames can be
// resumed with the same source run; originals are retained until all ten match.
export async function replaceMacAssets(api,plan,items,runId) {
  const refresh=async()=>validatePublicationState(await api.request(`/releases/${plan.releaseId}`),plan,items,runId)
  let state=await refresh()
  for(const item of items) {
    const stage=`macos-signing-stage-${runId}-${item.name}`
    if(!sameBytes(state.get(item.name),item.expected)&&!state.has(stage))await api.upload(plan.releaseId,item.file,stage,item.expected)
  }
  state=await refresh()
  for(const item of items)assert(sameBytes(state.get(item.name),item.expected)||sameBytes(state.get(`macos-signing-stage-${runId}-${item.name}`),item.expected))
  for(const item of items) {
    if(sameBytes(state.get(item.name),item.expected))continue
    const old=state.get(item.name),stage=state.get(`macos-signing-stage-${runId}-${item.name}`)
    if(old)await api.request(`/releases/assets/${old.id}`,'PATCH',{name:`macos-signing-backup-${runId}-${item.name}`})
    await api.request(`/releases/assets/${stage.id}`,'PATCH',{name:item.name})
  }
  state=await refresh()
  for(const item of items)assert(sameBytes(state.get(item.name),item.expected))
  for(const item of items)for(const prefix of ['backup','stage']) {
    const unused=state.get(`macos-signing-${prefix}-${runId}-${item.name}`)
    if(unused)await api.request(`/releases/assets/${unused.id}`,'DELETE')
  }
  const final=await refresh();assert.equal(final.size,plan.assets.length)
  return items.map(item=>final.get(item.name))
}
