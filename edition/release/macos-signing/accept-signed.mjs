import assert from 'node:assert/strict'
import {readFile,mkdir,writeFile} from 'node:fs/promises'
import {join,resolve} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {validateSignedDetails} from './policy.mjs'
import {identity} from './files.mjs'
const exec=promisify(execFile),[candidateArg,outputArg]=process.argv.slice(2)
const candidate=resolve(candidateArg),output=resolve(outputArg),core=resolve(process.env.EDUWORK_CORE_ROOT)
const receipt=JSON.parse(await readFile(join(candidate,'release-receipt.json')))
const policy=JSON.parse(await readFile(new URL('../../macos-signing.json',import.meta.url)))
assert.equal(receipt.version,process.env.RELEASE_VERSION);assert.equal(receipt.developerIDSigned,true);assert.equal(receipt.notarized,true)
assert.equal(receipt.developerIDSigning.signerCommit,process.env.GITHUB_SHA);assert.equal(receipt.developerIDSigning.runId,process.env.GITHUB_RUN_ID)
assert.equal((await exec('git',['-C',core,'rev-parse','HEAD'])).stdout.trim(),receipt.coreCommit)
for(const asset of [receipt.asset,receipt.installer.asset]) {
  assert.equal(asset.name,asset.name.split('/').at(-1));assert.deepEqual(await identity(join(candidate,asset.name)),{bytes:asset.bytes,sha256:asset.sha256})
}
const ticketDirectory=join(process.env.RUNNER_TEMP,'signed-ticket-check');await mkdir(ticketDirectory)
await exec('ditto',['-x','-k',join(candidate,receipt.asset.name),ticketDirectory])
const app=join(ticketDirectory,receipt.applicationName),dmg=join(candidate,receipt.installer.asset.name)
await exec('codesign',['--verify','--deep','--strict',app])
const details=await exec('codesign',['--display','--verbose=4',app]);validateSignedDetails(details.stdout+details.stderr,policy)
await exec('xcrun',['stapler','validate',app]);await exec('xcrun',['stapler','validate',dmg])
await exec('spctl',['--assess','--type','execute','--verbose=2',app])
await exec('spctl',['--assess','--type','open','--context','context:primary-signature','--verbose=2',dmg])
await exec(process.execPath,[join(core,'scripts/accept-macos-candidate.mjs'),candidate,output],{maxBuffer:16*1024*1024})
await writeFile(join(output,'evidence-public/signature-result.json'),JSON.stringify({passed:true,runId:process.env.GITHUB_RUN_ID,signerCommit:process.env.GITHUB_SHA,arch:process.arch,asset:receipt.asset,installer:receipt.installer.asset,checks:{developerIDSignature:'passed',applicationTicket:'passed',diskImageTicket:'passed',applicationGatekeeper:'passed',diskImageGatekeeper:'passed'}},null,2)+'\n')
