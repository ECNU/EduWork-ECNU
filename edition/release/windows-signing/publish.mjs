// School release orchestration: original macOS artifacts and the final signed
// Windows artifact stay on GitHub runners. No local file input is accepted.
import assert from 'node:assert/strict'
import { createReadStream } from 'node:fs'
import { readFile, mkdir, copyFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { coreModule, coreRoot, editionRoot, toolsLock, verifyCheckout } from './core.mjs'
import { signingGitHub, candidateWorkflow, localSigningPolicy } from './io.mjs'
import { verifySigningChain } from './receipt.mjs'
import { validateSignedFiles } from './files.mjs'
import { fileIdentity } from './operations.mjs'
import { writeJSON, sha256File } from './util.mjs'

export async function preparePublication(env=process.env) {
  const repository=env.GITHUB_REPOSITORY,workflow=candidateWorkflow(repository)
  assert.equal(env.GITHUB_ACTIONS,'true')
  assert(['true','false'].includes(env.PUBLISH_RELEASE));assert.equal(env.RELEASE_NOTES_APPROVED,'true')
  for(const key of ['SOURCE_RUN_ID','WINDOWS_SIGNING_RUN_ID','GITHUB_RUN_ID']) assert.match(env[key],/^[1-9][0-9]*$/)
  if(env.PUBLISH_RELEASE==='true') assert.equal(env.GITHUB_REF,'refs/heads/main')
  const version=env.RELEASE_VERSION,product='EduWork-ECNU',platforms=['windows','macos','macos-x64']
  assert.equal(env.RELEASE_NOTES,`docs/releases/${version}.md`)
  const notesPath=join(editionRoot,env.RELEASE_NOTES),notes=await readFile(notesPath,'utf8'),title=notes.split(/\r?\n/)[0]
  assert(notes.trim()&&title.includes(version))
  const github=signingGitHub(repository,env.GITHUB_TOKEN),source=await github.request(`/actions/runs/${env.SOURCE_RUN_ID}`)
  const jobs=await github.request(`/actions/runs/${env.SOURCE_RUN_ID}/jobs?per_page=100`)
  assert(jobs.total_count<=100,'Ambiguous job pagination')
  const {validateRun,validatedNodeNpmFiles}=await coreModule('scripts/publish-desktop-candidate.mjs')
  validateRun(source,{repository,workflow,currentRun:env.GITHUB_RUN_ID,platforms,requireMacos15:true},jobs.jobs)
  assert.equal(source.status,'completed');assert.equal(source.conclusion,'success')
  if(env.PUBLISH_RELEASE==='true') {
    const ancestry=await github.request(`/compare/${source.head_sha}...main`)
    assert.equal(ancestry.merge_base_commit.sha,source.head_sha,'Candidate must be merged into main')
  } else assert.equal(source.head_sha,env.GITHUB_SHA,'Validation uses the exact candidate checkout')
  const lock=await github.sourceJSON('core.lock.json',source.head_sha)
  assert.equal(lock.repository.toLowerCase(),'https://github.com/ecnu/eduwork.git')
  await verifyCheckout(coreRoot(),lock.commit)
  const policy=await localSigningPolicy(editionRoot)
  assert.deepEqual(await github.sourceJSON('edition/windows-signing.json',source.head_sha),policy)
  assert.deepEqual(await github.sourceJSON('edition/release/windows-signing/tools.lock.json',source.head_sha),toolsLock)
  await github.signingRun(env.WINDOWS_SIGNING_RUN_ID,source.head_sha)
  const root=resolve(env.RUNNER_TEMP,'desktop-publication-'+env.GITHUB_RUN_ID)
  await mkdir(root,{recursive:false})
  const files=[],receipts=[],artifacts={}
  for(const platform of platforms) {
    const runId=platform==='windows'?env.WINDOWS_SIGNING_RUN_ID:env.SOURCE_RUN_ID
    const artifact=await github.artifact(runId,platform+'-release'),directory=join(root,platform)
    artifacts[platform]={runId,...artifact}
    await github.download(artifact,join(root,platform+'.zip'),directory)
    const context={repository,version,commit:source.head_sha,policy,product,platform,coreCommit:lock.commit,editionCommit:source.head_sha,releaseNotes:env.RELEASE_NOTES,requirePublisherBootstrap:true}
    const checked=platform==='windows'?await validateSignedFiles(directory,context):await validatedNodeNpmFiles(directory,context)
    assert.equal(checked.receipt.coreCommit,lock.commit);assert.equal(checked.receipt.recipe,'pinned-source')
    assert.equal(checked.receipt.releaseNotes.file,env.RELEASE_NOTES)
    assert.equal(checked.receipt.releaseNotes.sha256,await sha256File(notesPath))
    for(const check of ['sourceSnapshot','mediaTemplate','publisherFirstLaunch']) assert.equal(checked.receipt.checks[check],'passed')
    if(platform==='windows') await verifySigningChain({github,receipt:checked.receipt,policy,sourceRun:env.SOURCE_RUN_ID,finalRun:env.WINDOWS_SIGNING_RUN_ID,repository,root:join(root,'signing-chain')})
    const receiptPath=join(root,platform+'-release-receipt.json')
    await copyFile(join(directory,'release-receipt.json'),receiptPath)
    files.push(...checked.files.filter(f=>!['release-receipt.json','RELEASE-NOTES.md'].includes(f.name)),{name:platform+'-release-receipt.json',path:receiptPath,...await fileIdentity(receiptPath)})
    receipts.push(checked.receipt)
  }
  for(const receipt of receipts.slice(1)) for(const key of ['dshVersion','dshCommit','recipe','coreCommit','editionCommit']) assert.equal(receipt[key],receipts[0][key],`Cross-platform ${key} mismatch`)
  files.push({name:'RELEASE-NOTES.md',path:notesPath,...await fileIdentity(notesPath)})
  assert.equal(new Set(files.map(f=>f.name)).size,files.length,'Duplicate release asset')
  return {root,files,notes,title,repository,version,editionCommit:source.head_sha,coreCommit:lock.commit,sourceRun:env.SOURCE_RUN_ID,windowsSigningRun:env.WINDOWS_SIGNING_RUN_ID,artifacts}
}

export async function publishPrepared(prepared,env=process.env) {
  // main() checks complete provenance before calling this writer. Existing
  // public releases are verified only; unequal or missing assets cannot mutate them.
  assert.equal(env.PUBLISH_RELEASE,'true');assert.equal(env.GITHUB_REF,'refs/heads/main')
  assert.equal(prepared.repository.toLowerCase(),'ecnu/eduwork-ecnu')
  const {verifyRemoteAssets}=await coreModule('scripts/publish-desktop-candidate.mjs')
  const {desktopVersion}=await coreModule('scripts/desktop-build-plan.mjs')
  const {files,repository,version,editionCommit,notes,title}=prepared,tag='v'+version
  const api='https://api.github.com/repos/'+repository
  const headers={Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','User-Agent':'EduWork-ECNU-Signed-Publisher','X-GitHub-Api-Version':'2022-11-28'}
  const request=async(path,method='GET',body)=>{
    const response=await fetch(api+path,{method,headers, ...(body===undefined?{}:{body:JSON.stringify(body)})})
    if(response.status===404&&method==='GET') return null
    assert(response.ok,`GitHub publication ${method} ${path}: ${response.status}`)
    return response.status===204?null:response.json()
  }
  const checkRef=ref=>{if(ref){assert.equal(ref.object.type,'commit');assert.equal(ref.object.sha,editionCommit)}}
  checkRef(await request('/git/ref/tags/'+tag))
  const releases=await request('/releases?per_page=100'),matches=releases.filter(r=>r.tag_name===tag)
  assert(matches.length<=1);let release=matches[0]
  const prerelease=desktopVersion(version).prerelease
  const checkLatest=async r=>{if(!prerelease){const latest=await request('/releases/latest');assert.equal(latest?.id,r.id,'Stable release is not GitHub Latest')}}
  const checkRelease=r=>{assert.equal(r.tag_name,tag);assert.equal(r.target_commitish,editionCommit);assert.equal(r.name,title);assert.equal(r.body.trimEnd(),notes.trimEnd());assert.equal(r.prerelease,prerelease)}
  if(release) checkRelease(release)
  if(release&&!release.draft) {const ref=await request('/git/ref/tags/'+tag);assert(ref);checkRef(ref);verifyRemoteAssets(release.assets,files);await checkLatest(release);return release.html_url}
  // All checks above are read-only. A draft retains a failed upload for an exact retry.
  release??=await request('/releases','POST',{tag_name:tag,target_commitish:editionCommit,name:title,body:notes,draft:true,prerelease,make_latest:'false'})
  checkRelease(release)
  for(const file of files) {
    const existing=release.assets.filter(a=>a.name===file.name)
    if(existing.length){verifyRemoteAssets(existing,[file]);continue}
    assert.deepEqual(await fileIdentity(file.path),{bytes:file.bytes,sha256:file.sha256})
    const url=new URL(release.upload_url.replace(/\{.*$/,''));assert.equal(url.origin,'https://uploads.github.com');url.searchParams.set('name',file.name)
    const response=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':String(file.bytes)},body:createReadStream(file.path),duplex:'half'})
    assert(response.ok,`Asset upload failed: ${file.name} (${response.status})`)
    verifyRemoteAssets([await response.json()],[file])
  }
  release=await request('/releases/'+release.id);checkRelease(release);verifyRemoteAssets(release.assets,files)
  checkRef(await request('/git/ref/tags/'+tag))
  await request('/releases/'+release.id,'PATCH',{draft:false,prerelease,make_latest:prerelease?'false':'true'})
  release=await request('/releases/'+release.id);checkRelease(release);assert.equal(release.draft,false);verifyRemoteAssets(release.assets,files)
  const ref=await request('/git/ref/tags/'+tag);assert(ref);checkRef(ref)
  await checkLatest(release)
  return release.html_url
}
export async function main(env=process.env) {
  const prepared=await preparePublication(env)
  const url=env.PUBLISH_RELEASE==='true'?await publishPrepared(prepared,env):undefined
  const {root,files,notes,title,...identity}=prepared
  await writeJSON(join(root,'publication-verification.json'),{...identity,verified:true,published:Boolean(url),...(url?{url}:{}),files:files.map(({path,...f})=>f)})
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) await main()
