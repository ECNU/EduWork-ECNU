import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {signingGitHub} from '../windows-signing/io.mjs'
import {identity} from './files.mjs'
import {releaseAPI} from './github.mjs'
import {validateSourceRun,validateQualification,replaceMacAssets} from './publication.mjs'
const env=process.env,version=env.RELEASE_VERSION,runId=env.SOURCE_RUN_ID
assert.equal(env.GITHUB_REPOSITORY,'ECNU/EduWork-ECNU');assert.equal(env.GITHUB_REF,'refs/heads/main');assert.equal(env.GITHUB_EVENT_NAME,'workflow_dispatch')
assert.match(version??'',/^\d+\.\d+\.\d+$/);assert.match(runId??'',/^[1-9][0-9]*$/)
const planPath=`edition/release/macos-signing/inputs/${version}.json`
const plan=JSON.parse(await readFile(planPath)),policy=JSON.parse(await readFile('edition/macos-signing.json'))
const github=signingGitHub(env.GITHUB_REPOSITORY,env.GITHUB_TOKEN),api=releaseAPI(),run=await github.request(`/actions/runs/${runId}`)
validateSourceRun(run)
execFileSync('git',['merge-base','--is-ancestor',run.head_sha,env.GITHUB_SHA])
assert.deepEqual(await github.sourceJSON(planPath,run.head_sha),plan)
assert.deepEqual(await github.sourceJSON('edition/macos-signing.json',run.head_sha),policy)
const root=resolve(env.RUNNER_TEMP,'macos-signing-publication');await mkdir(root)
const items=[],provenance=[]
for(const arch of ['arm64','x64']) {
  const folder=join(root,arch),minimumFolder=join(root,arch+'-minimum')
  for(const [name,directory] of [[`signed-macos-${arch}`,folder],[`signed-macos15-${arch}`,minimumFolder]]) {
    const artifact=await github.artifact(runId,name);await github.download(artifact,directory+'.zip',directory);provenance.push(artifact)
  }
  const receipt=JSON.parse(await readFile(join(folder,'release-receipt.json')))
  const minimum=JSON.parse(await readFile(join(minimumFolder,'macos15-result.json'))),signature=JSON.parse(await readFile(join(minimumFolder,'signature-result.json')))
  validateQualification(receipt,minimum,signature,plan,policy,run,arch)
  const originalFile=join(folder,'original-release-receipt.json'),original=JSON.parse(await readFile(originalFile))
  const oldReceipt=plan.assets.find(a=>a.name===(arch==='arm64'?'macos':'macos-x64')+'-release-receipt.json')
  assert.deepEqual(await identity(originalFile),{bytes:oldReceipt.size,sha256:oldReceipt.digest.slice(7)})
  assert.deepEqual(receipt.developerIDSigning.originalReceipt,oldReceipt)
  assert.deepEqual(receipt.developerIDSigning.originalAsset,original.asset);assert.deepEqual(receipt.releaseNotes,original.releaseNotes)
  for(const asset of [receipt.asset,receipt.installer.asset]) {
    const file=join(folder,asset.name),expected={bytes:asset.bytes,sha256:asset.sha256}
    assert.deepEqual(await identity(file),expected)
    const sidecar=file+'.sha256';assert.equal(await readFile(sidecar,'utf8'),`${asset.sha256}  ${asset.name}\n`)
    items.push({name:asset.name,file,expected},{name:asset.name+'.sha256',file:sidecar,expected:await identity(sidecar)})
  }
  receipt.developerIDSigning.minimumSystemQualification={...minimum,signatureChecks:signature.checks}
  const name=oldReceipt.name,file=join(folder,name)
  await writeFile(file,JSON.stringify(receipt,null,2)+'\n');items.push({name,file,expected:await identity(file)})
}
const assets=await replaceMacAssets(api,plan,items,runId)
await writeFile(join(root,'publication-verification.json'),JSON.stringify({passed:true,version,releaseId:plan.releaseId,tag:plan.tag,editionCommit:plan.editionCommit,bodySHA256:plan.bodySHA256,sourceRun:runId,signerCommit:run.head_sha,artifacts:provenance,assets,ossModified:false},null,2)+'\n')
console.log(`Verified ${assets.length} signed macOS assets on ${plan.tag}; non-Mac assets and release metadata preserved.`)
