import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { signingSession } from './session.mjs'
import { inventory, signingOrder, entitlementsFor, validateContentPreserved, validateReleaseMetadata, identity, digest } from './files.mjs'
import { validateSignedDetails, validateNotaryResult } from './policy.mjs'
import { releaseAPI, validateRelease } from './github.mjs'
const exec=promisify(execFile),env=process.env
const version=env.RELEASE_VERSION;assert.match(version??'',/^\d+\.\d+\.\d+$/)
const plan=JSON.parse(await readFile(new URL(`./inputs/${version}.json`,import.meta.url)))
const policy=JSON.parse(await readFile(new URL('../../macos-signing.json',import.meta.url)))
assert.equal(env.GITHUB_REPOSITORY,plan.repository);assert.equal(env.GITHUB_REF,'refs/heads/main')
assert.equal(process.platform,'darwin');assert(['arm64','x64'].includes(process.arch))
const core=resolve(env.EDUWORK_CORE_ROOT),root=resolve(env.RUNNER_TEMP,'ecnu-macos-resign'),output=join(root,'output'),evidence=join(root,'evidence')
const report={schemaVersion:1,version,arch:process.arch,sourceCommit:plan.editionCommit,signerCommit:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,passed:false}
const platform=process.arch==='arm64'?'macos':'macos-x64',appName='EduWork-ECNU.app'
let session
async function json(path,value){await writeFile(path,JSON.stringify(value,null,2)+'\n')}
try {
  await mkdir(root,{recursive:false});await mkdir(output);await mkdir(evidence)
  const head=(await exec('git',['-C',core,'rev-parse','HEAD'])).stdout.trim();assert.equal(head,plan.coreCommit)
  const api=releaseAPI(),release=await api.request(`/releases/${plan.releaseId}`)
  validateRelease(release,plan)
  const receiptAsset=plan.assets.find(a=>a.name===platform+'-release-receipt.json')
  const zipAsset=plan.assets.find(a=>a.name===`EduWork-ECNU-${version}-macos-${process.arch}-electron.zip`)
  await api.download(receiptAsset,join(root,'original-receipt.json'))
  const original=JSON.parse(await readFile(join(root,'original-receipt.json')))
  assert.equal(original.version,version);assert.equal(original.editionCommit,plan.editionCommit);assert.equal(original.coreCommit,plan.coreCommit)
  assert.equal('sha256:'+original.asset.sha256,zipAsset.digest)
  assert.equal(original.asset.bytes,zipAsset.size);assert.equal(original.passed,true);assert.equal(original.applicationName,appName)
  await api.download(zipAsset,join(root,'original.zip'))
  const {verifyMacOSAppArchive,createMacOSAppArchive}=await import(pathToFileURL(join(core,'dsh-electron/scripts/create-macos-archive.mjs')))
  await verifyMacOSAppArchive(join(root,'original.zip'),appName)
  await exec('/usr/bin/ditto',['-x','-k',join(root,'original.zip'),join(root,'unpacked')])
  const app=join(root,'unpacked',appName)
  await exec('/usr/bin/codesign',['--verify','--deep','--strict',app])
  const before=await inventory(app)
  assert(before.binaries.length>10,'Native inventory unexpectedly empty')
  const metadata=JSON.parse(await readFile(join(app,'Contents/Resources/release.json')))
  assert.equal(metadata.version,version)
  await json(join(app,'Contents/Resources/release.json'),{...metadata,developerIDSigned:true,adHocSigned:false,notarized:true})
  await exec('/usr/bin/xattr',['-cr',app])
  session=await signingSession({policy,work:join(env.RUNNER_TEMP,'ecnu-macos-signing-private'),report})
  const {command,keychain,profile}=session
  const entitlements=join(root,'entitlements');await mkdir(entitlements)
  async function sign(relative,bundle=false) {
    const file=relative?join(app,relative):app
    const output=await command('Inspect '+(relative||appName),'/usr/bin/file',['-b',file])
    if(!bundle)assert(output.stdout.includes('Mach-O'),`Not a Mach-O object: ${relative}`)
    const executable=bundle?!relative.endsWith('.framework'):output.stdout.includes('executable')
    const keys=entitlementsFor(relative,executable),args=['--force','--sign',session.identity,'--keychain',keychain,'--timestamp','--options','runtime']
    if(keys.length) {
      const file=join(entitlements,String(keys.join('|').length)+'-'+keys.map(k=>k.split('.').at(-1)).join('-')+'.plist')
      await writeFile(file,`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>${keys.map(key=>`<key>${key}</key><true/>`).join('')}</dict></plist>`)
      args.push('--entitlements',file)
    }
    await command('Sign '+(relative||appName),'/usr/bin/codesign',[...args,file])
  }
  for(const path of signingOrder(before.binaries))await sign(path)
  for(const path of signingOrder(before.bundles.filter(bundle=>before.binaries.some(file=>file.startsWith(bundle+'/')))))await sign(path,true)
  await sign('',true)
  await command('Verify complete signed application','/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',app])
  const details=await command('Inspect application identity','/usr/bin/codesign',['--display','--verbose=4',app]);validateSignedDetails(details.stdout+details.stderr,policy)
  for(const path of before.binaries)await command('Verify '+path,'/usr/bin/codesign',['--verify','--strict',join(app,path)])
  async function notarize(file,kind) {
    const submission=await command('Notarize '+kind,'/usr/bin/xcrun',['notarytool','submit',file,'--keychain-profile',profile,'--keychain',keychain,'--wait','--output-format','json'])
    const result=JSON.parse(submission.stdout);assert.match(result.id??'',/^[a-f0-9-]{36}$/i)
    const log=await command('Read '+kind+' notarization log','/usr/bin/xcrun',['notarytool','log',result.id,'--keychain-profile',profile,'--keychain',keychain])
    const parsed=JSON.parse(log.stdout)
    await json(join(evidence,kind+'-notarization.json'),parsed)
    validateNotaryResult(result);assert.equal(parsed.status,'Accepted')
    return {id:result.id,status:result.status,issues:parsed.issues??[]}
  }
  const submit=join(root,'submission.zip');await createMacOSAppArchive(app,submit)
  report.applicationNotarization=await notarize(submit,'application')
  await command('Staple application','/usr/bin/xcrun',['stapler','staple',app])
  await command('Validate application ticket','/usr/bin/xcrun',['stapler','validate',app])
  const after=await inventory(app);validateContentPreserved(before,after);await validateReleaseMetadata(metadata,app)
  await json(join(evidence,'signature-inventory.json'),{before,after})
  const zip=join(output,zipAsset.name);await createMacOSAppArchive(app,zip)
  await writeFile(zip+'.sha256',`${await digest(zip)}  ${basename(zip)}\n`)
  await command('Extract final signed ZIP','/usr/bin/ditto',['-x','-k',zip,join(root,'final')])
  const finalApp=join(root,'final',appName)
  await command('Validate final ZIP ticket','/usr/bin/xcrun',['stapler','validate',finalApp])
  await command('Assess final application','/usr/sbin/spctl',['--assess','--type','execute','--verbose=2',finalApp])
  const {prepareMacosDmg}=await import(pathToFileURL(join(core,'scripts/prepare-macos-dmg.mjs')))
  const dmg=join(output,original.installer.asset.name)
  const installer=await prepareMacosDmg({app:finalApp,output:dmg,workDirectory:join(root,'dmg-work'),coreRoot:core})
  await command('Sign DMG','/usr/bin/codesign',['--force','--sign',session.identity,'--keychain',keychain,'--timestamp',dmg])
  report.diskImageNotarization=await notarize(dmg,'disk-image')
  await command('Staple DMG','/usr/bin/xcrun',['stapler','staple',dmg])
  await command('Validate DMG ticket','/usr/bin/xcrun',['stapler','validate',dmg])
  await command('Assess DMG','/usr/sbin/spctl',['--assess','--type','open','--context','context:primary-signature','--verbose=2',dmg])
  installer.asset={name:basename(dmg),...await identity(dmg)}
  await writeFile(dmg+'.sha256',`${installer.asset.sha256}  ${basename(dmg)}\n`)
  await session.cleanup();session=null
  const receipt={...original,developerIDSigned:true,notarized:true,asset:{name:basename(zip),...await identity(zip)},installer,deltas:[],passed:false,
    developerIDSigning:{schemaVersion:1,teamId:policy.teamId,identity:policy.identity,certificateSHA256:policy.certificateSHA256,runId:env.GITHUB_RUN_ID,signerCommit:env.GITHUB_SHA,originalAsset:original.asset,originalReceipt:receiptAsset,applicationNotarization:report.applicationNotarization,diskImageNotarization:report.diskImageNotarization,nonCodeContentPreserved:true,metadataChanges:['developerIDSigned','adHocSigned','notarized'],inheritedChecks:['sourceAndDependencies','sourceSnapshot','publisherFirstLaunch'],inventorySHA256:await digest(join(evidence,'signature-inventory.json'))}}
  await json(join(output,'release-receipt.json'),receipt)
  const {acceptMacos}=await import(pathToFileURL(join(core,'scripts/lib/macos-stages.mjs')))
  report.startupChecks=await acceptMacos({workspace:{resolvePath:path=>path==='desktop'?output:join(root,'acceptance',path),parameters:{verifySnapshot:true}},coreRoot:core,name:'EduWork-ECNU',verifyPublisherBootstrap:false})
  assert.equal(report.startupChecks.desktopLaunch,'passed');assert.equal(report.startupChecks.nativeRuntimes,'passed')
  receipt.passed=true;receipt.checks={...original.checks,...report.startupChecks,developerIDSignature:'passed',appleNotarization:'passed',nonCodeContentPreserved:'passed'}
  receipt.developerIDSigning.qualificationOS=(await exec('/usr/bin/sw_vers',['-productVersion'])).stdout.trim()
  await json(join(output,'release-receipt.json'),receipt)
  await copyFile(join(root,'original-receipt.json'),join(output,'original-release-receipt.json'))
  report.passed=true
} catch(error) {report.error=error.message;console.error(error.message);process.exitCode=1}
finally {if(session)try{await session.cleanup()}catch{report.credentialsCleanup=false;report.passed=false;process.exitCode=1}await mkdir(evidence,{recursive:true});await json(join(evidence,'signing-result.json'),report)}
