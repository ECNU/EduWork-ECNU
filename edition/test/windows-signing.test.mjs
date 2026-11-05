import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign, X509Certificate, randomBytes } from 'node:crypto'
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { sha256, safePath, requestHash, validatePolicy, validateRequest, validateResponse, validateDigestBinding, validateSigningRun, ownedWindowsFiles } from '../release/windows-signing/protocol.mjs'
import { candidateWorkflow, unpackSafe, usesSchoolSigning } from '../release/windows-signing/io.mjs'
import { validateSigningReceipt, verifySigningChain } from '../release/windows-signing/receipt.mjs'
import { compareManifests, validateSignedFiles, validateOriginalReceipt } from '../release/windows-signing/files.mjs'
import { coreModule, toolsLock } from '../release/windows-signing/core.mjs'
const {ZipWriter}=await coreModule('scripts/lib/zip.mjs')

async function inventory(root, work, exclude = []) {
  await mkdir(work, { recursive: true })
  const job = join(work, 'inventory.json'), output = join(work, 'result.json')
  await writeFile(job, JSON.stringify({ root, output, exclude }))
  await promisify(execFile)('pwsh', ['-NoProfile', '-File', fileURLToPath(new URL('../release/windows-signing/tool.ps1', import.meta.url)), '-Mode', 'inventory', '-Job', job], { windowsHide: true })
  return JSON.parse(await readFile(output, 'utf8'))
}

// Header-only synthetic image; never executed or signed. Mutations below must
// be rejected before Get-AuthenticodeSignature can classify a broken PE as unsigned.
function peHeaderFixture() {
  const bytes = Buffer.alloc(1024)
  bytes.write('MZ'); bytes.writeUInt32LE(128, 60); bytes.write('PE\0\0', 128)
  bytes.writeUInt16LE(0x8664, 132); bytes.writeUInt16LE(1, 134)
  bytes.writeUInt16LE(240, 148); bytes.writeUInt16LE(0x20b, 152)
  bytes.writeUInt32LE(512, 128 + 24 + 240 + 16)
  bytes.writeUInt32LE(512, 128 + 24 + 240 + 20)
  return bytes
}

test('native inventory recognizes actual Windows PE and skips ELF/Mach-O without changing any bytes', { skip: process.platform !== 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'ecnu-pe-inventory-')); t.after(() => rm(root, { recursive: true, force: true }))
  const input = join(root, 'input'); await mkdir(input)
  const bytes = await readFile(process.execPath)
  await writeFile(join(input, 'windows.node'), bytes)
  const fixtures = new Map([['windows.node', sha256(bytes)]])
  for (const magic of ['7f454c46', 'cefaedfe', 'feedface', 'cffaedfe', 'feedfacf', 'cafebabe', 'bebafeca', 'cafebabf', 'bfbafeca']) {
    const file = `foreign-${magic}.node`, body = Buffer.concat([Buffer.from(magic, 'hex'), Buffer.alloc(60)])
    await writeFile(join(input, file), body); fixtures.set(file, sha256(body))
  }
  // Institution-owned files are inventoried/signed through their separate allowlist.
  await writeFile(join(input, 'EduWork.exe'), 'excluded fixture')
  const result = await inventory(input, join(root, 'work'), ['EduWork.exe'])
  assert.equal(result.length, 1)
  assert.equal(result[0].path, 'windows.node')
  assert(['Valid', 'NotSigned'].includes(result[0].status))
  assert.equal(result[0].sha256, fixtures.get('windows.node'))
  for (const [file, hash] of fixtures) assert.equal(sha256(await readFile(join(input, file))), hash)
})

test('native inventory rejects damaged MZ, out-of-bounds headers and truncated PE sections', { skip: process.platform !== 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'ecnu-broken-pe-')); t.after(() => rm(root, { recursive: true, force: true }))
  const cases = [
    ['truncated-dos', () => Buffer.from('MZ')],
    ['offset-overflow', b => { b.writeUInt32LE(0xffffffff, 60); return b }],
    ['bad-signature', b => { b.write('NOPE', 128); return b }],
    ['bad-optional-magic', b => { b.writeUInt16LE(0x999, 152); return b }],
    ['truncated-optional', b => { b.writeUInt16LE(65535, 148); return b }],
    ['section-overflow', b => { b.writeUInt32LE(0xffffffff, 128 + 24 + 240 + 20); return b }],
    ['truncated-section', b => b.subarray(0, 800)],
  ]
  for (const [name, mutate] of cases) {
    const input = join(root, name); await mkdir(input)
    await writeFile(join(input, 'broken.node'), mutate(peHeaderFixture()))
    await assert.rejects(inventory(input, join(root, name + '-work')), error => /Malformed PE/u.test(error.stderr || error.message), name)
  }
  const unknown = join(root, 'unknown'); await mkdir(unknown)
  await writeFile(join(unknown, 'unknown.node'), 'not a recognized native binary')
  await assert.rejects(inventory(unknown, join(root, 'unknown-work')), error => /Unrecognized native binary/u.test(error.stderr || error.message))
})

test('native inventory still rejects an actual PE with a damaged existing signature', { skip: process.platform !== 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'ecnu-tampered-pe-')); t.after(() => rm(root, { recursive: true, force: true }))
  const input = join(root, 'input'); await mkdir(input)
  const bytes = await readFile(process.execPath)
  const pe = bytes.readUInt32LE(60), optional = pe + 24
  const certificateEntry = optional + (bytes.readUInt16LE(optional) === 0x20b ? 112 : 96) + 4 * 8
  assert(bytes.readUInt32LE(certificateEntry + 4) > 0, 'Windows Node fixture must have its upstream signature')
  const section = optional + bytes.readUInt16LE(pe + 20)
  bytes[bytes.readUInt32LE(section + 20)] ^= 1
  await writeFile(join(input, 'tampered.exe'), bytes)
  await assert.rejects(inventory(input, join(root, 'work')), error => /Invalid existing signature[\s\S]*HashMismatch/u.test(error.stderr || error.message))
})

// Synthetic ephemeral certificate and CMS. No institution identity, private-key
// fixture, token or external trust-store changes are involved in these tests.
function der(tag,...parts){
  const content=Buffer.concat(parts.map(p=>Buffer.isBuffer(p)?p:Buffer.from(p))),n=content.length
  const length=n<128?Buffer.from([n]):Buffer.from(n<=255?[0x81,n]:[0x82,n>>8,n&255])
  return Buffer.concat([Buffer.from([tag]),length,content])
}
const seq=(...a)=>der(0x30,...a),set=(...a)=>der(0x31,...a),oct=b=>der(4,b),oid=h=>der(6,Buffer.from(h,'hex'))
const shaAlg=seq(oid('608648016503040201'),der(5)),rsaAlg=seq(oid('2a864886f70d010101'),der(5)),sigAlg=seq(oid('2a864886f70d01010b'),der(5))
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:3072})
const name=seq(set(seq(oid('550403'),der(12,'Synthetic Test Publisher')))),serial=der(2,[1])
const tbs=seq(der(0xa0,der(2,[2])),serial,sigAlg,name,seq(der(23,'250101000000Z'),der(23,'350101000000Z')),name,publicKey.export({format:'der',type:'spki'}))
const certificate=seq(tbs,sigAlg,der(3,Buffer.from([0]),sign('sha256',tbs,privateKey)))
const cert=new X509Certificate(certificate)
const policy={schemaVersion:1,required:true,certificate:certificate.toString('base64'),thumbprint:cert.fingerprint.replaceAll(':',''),subject:'CN=Synthetic Test Publisher',timestampURL:'https://timestamp.example.test/rfc3161'}
const artifact=name=>({id:'123',name,sha256:'e'.repeat(64),bytes:100})
function entry(path,nonce=''){
  const indirect=seq(seq(oid('2b06010401823702010f')),seq(shaAlg,oct(Buffer.from(sha256(path+nonce),'hex'))))
  // Authenticode hashes the contents of SpcIndirectDataContent, without its SEQUENCE header.
  const indirectContent=indirect.subarray(indirect[1]<128?2:4)
  const attributes=set(seq(oid('2a864886f70d010904'),set(oct(Buffer.from(sha256(indirectContent),'hex')))))
  const digest=Buffer.from(sha256(attributes),'hex'),tagged=Buffer.from(attributes);tagged[0]=0xa0
  const signer=seq(der(2,[1]),seq(name,serial),shaAlg,tagged,rsaAlg,oct(digest))
  const pkcs7=seq(oid('2a864886f70d010702'),der(0xa0,seq(der(2,[1]),set(shaAlg),seq(oid('2b060104018237020104'),der(0xa0,indirect)),der(0xa0,certificate),set(signer))))
  return {id:sha256(path).slice(0,32),path,inputBytes:100,inputSHA256:sha256('original'+path+nonce),bytes:100,sha256:sha256('unsigned'+path+nonce),digest:digest.toString('base64'),pkcs7:pkcs7.toString('base64'),pkcs7SHA256:sha256(pkcs7)}
}
function request(stage='inner'){
  return {schemaVersion:1,kind:'eduwork-windows-signing-request',stage,policy:structuredClone(policy),context:{repository:'ECNU/EduWork-ECNU',editionCommit:'a'.repeat(40),coreCommit:'a'.repeat(40),toolsCommit:toolsLock.commit,version:'0.4.11',product:'EduWork-ECNU',distribution:'eduwork-chatecnu',sourceRun:'1',requestRun:stage==='inner'?'2':'3',parentRun:stage==='inner'?null:'2',sourceArtifact:artifact('windows-unsigned'),policySHA256:sha256(JSON.stringify(policy))},entries:(stage==='inner'?ownedWindowsFiles:['EduWork-ECNU-Setup.exe']).map(p=>entry(p))}
}
function response(req){return {schemaVersion:1,kind:'eduwork-windows-signing-response',requestSHA256:requestHash(req),stage:req.stage,sourceRun:req.context.sourceRun,requestRun:req.context.requestRun,entries:req.entries.map(e=>({id:e.id,signature:sign('sha256',validateDigestBinding(e,policy).attributes,privateKey).toString('base64')}))}}
function signedReceipt(){
  const inner=request(),outer=request('outer'),record=req=>({request:req,response:response(req),stateArtifact:artifact('windows-signing-state'),requestArtifact:artifact('windows-signing-request')})
  const files=[...inner.entries,...outer.entries].map(e=>({path:e.path,originalSHA256:e.inputSHA256,beforeSHA256:e.sha256,sha256:sha256('signed'+e.path),bytes:500,status:'Valid',thumbprint:policy.thumbprint,subject:policy.subject,timestampThumbprint:'F'.repeat(40)}))
  const asset=name=>({name,bytes:100,sha256:'b'.repeat(64)})
  return {schemaVersion:1,kind:'eduwork-windows-release',validationProfile:'ci-build-launch-and-extract-v2',shell:'electron',platform:'windows-x64',passed:true,automaticUpdates:true,releaseNotes:{approved:true,sha256:'c'.repeat(64)},asset:asset('EduWork-ECNU-0.4.11-windows-x64-electron.zip'),portableExtractor:{asset:asset('EduWork-ECNU-0.4.11-windows-x64-setup.zip'),receipt:asset('EduWork-ECNU-0.4.11-windows-x64-setup.zip.json')},edition:'EduWork-ECNU',version:'0.4.11',editionCommit:'a'.repeat(40),coreCommit:'a'.repeat(40),toolsCommit:toolsLock.commit,publication:'signed-and-verified',checks:{...Object.fromEntries(['sourceAndDependencies','desktopLaunch','archiveManifest','nativeRuntimes','portableExtractor','updateContract'].map(key=>[key,'passed'])),authenticode:'passed'},signing:{schemaVersion:1,kind:'eduwork-windows-detached-signing',toolsCommit:toolsLock.commit,policySHA256:sha256(JSON.stringify(policy)),sourceRun:'1',sourceArtifact:artifact('windows-unsigned'),inner:record(inner),outer:record(outer),finalRun:'4',files,originalManifestSHA256:'a'.repeat(64),preservedFiles:'passed',thirdPartyPE:[]}}
}
test('policy, unsigned CMS and RSA response form a verified synthetic round trip',()=>{
  validatePolicy(policy)
  for(const stage of ['inner','outer']){const req=request(stage);validateRequest(req);validateResponse(response(req),req)}
  validateSigningReceipt(signedReceipt(),policy)
})
test('rejects unexpected paths, stages, fields and signing identities',()=>{
  const mutations=[r=>r.entries.push(r.entries[0]),r=>r.entries[0].path='../other.exe',r=>r.entries[0].path='resources/node.exe',r=>r.context.editionCommit='b'.repeat(39),r=>r.context.parentRun='9',r=>r.policy.required=false,r=>r.policy.thumbprint='0'.repeat(40),r=>r.policy.extra='ignore',r=>r.entries[0].extra=true,r=>r.entries[1]=r.entries[0]]
  for(const mutate of mutations){const req=request();mutate(req);assert.throws(()=>validateRequest(req))}
  assert.throws(()=>validateRequest(request(),{requestSHA256:'0'.repeat(64)}))
  assert.throws(()=>validateRequest(request(),{coreCommit:'b'.repeat(40)}))
})
test('digest/envelope/certificate swaps fail before hardware signing',()=>{
  const original=request().entries[0]
  for(const changed of [{digest:randomBytes(32).toString('base64')},{pkcs7:Buffer.from('invalid').toString('base64')},{pkcs7:entry('other.exe').pkcs7},{pkcs7:original.pkcs7.slice(4)}]) assert.throws(()=>validateDigestBinding({...original,...changed},policy))
  assert.throws(()=>validateDigestBinding(original,{...policy,certificate:Buffer.from('wrong').toString('base64')}))
})
test('responses reject replay, omissions, duplicate entries, bogus signatures and extra fields',()=>{
  const req=request()
  const mutations=[r=>r.requestSHA256='0'.repeat(64),r=>r.requestRun='999',r=>r.sourceRun='999',r=>r.stage='outer',r=>r.entries.pop(),r=>r.entries.push(r.entries[0]),r=>r.entries[1]=r.entries[0],r=>r.entries[0].signature=randomBytes(384).toString('base64'),r=>r.entries[0].signature+='\n',r=>r.entries[0].id='bogus',r=>r.PIN='forbidden']
  for(const mutate of mutations){const result=response(req);mutate(result);assert.throws(()=>validateResponse(result,req))}
  assert.throws(()=>validateResponse(response(req),request('outer')))
})
test('final receipt requires both rounds, five signatures, timestamps and preserved bytes',()=>{
  const mutations=[r=>delete r.signing,r=>r.publication='awaiting-windows-signing',r=>r.checks.authenticode='skipped',r=>r.signing.outer.request.context.parentRun='12',r=>r.signing.files.pop(),r=>r.signing.files[0].timestampThumbprint='',r=>r.signing.files[0].thumbprint='0'.repeat(40),r=>r.signing.files[0].beforeSHA256='b'.repeat(64),r=>r.signing.finalRun='2',r=>r.signing.preservedFiles='skipped',r=>r.signing.thirdPartyPE=[{path:'x.dll',sha256:'a'.repeat(64),status:'HashMismatch'}]]
  for(const mutate of mutations){const receipt=signedReceipt();mutate(receipt);assert.throws(()=>validateSigningReceipt(receipt,policy))}
  assert.throws(()=>validateSigningReceipt(signedReceipt(),null))
})
test('signing source allowlist accepts school runs and rejects the public product',()=>{
  assert.equal(usesSchoolSigning('ECNU/EduWork'),false)
  assert.equal(usesSchoolSigning('ECNU/EduWork-ECNU'),true)
  assert.throws(()=>candidateWorkflow('ECNU/EduWork'),/only enabled for EduWork-ECNU/)
  assert.equal(candidateWorkflow('ECNU/EduWork-ECNU'),'.github/workflows/development-windows.yml')
  assert.throws(()=>candidateWorkflow('other/repository'))
  const run={id:2,repository:{full_name:'ECNU/EduWork-ECNU'},path:'.github/workflows/windows-signing.yml',event:'workflow_dispatch',head_sha:'a'.repeat(40),status:'completed',conclusion:'success'}
  const expected={repository:'ECNU/EduWork-ECNU',editionCommit:run.head_sha,runId:'2'}
  validateSigningRun(run,expected)
  for(const changed of [{head_sha:'b'.repeat(40)},{path:'.github/workflows/development-windows.yml'},{event:'pull_request'},{id:3},{conclusion:'failure'},{status:'in_progress'}]) assert.throws(()=>validateSigningRun({...run,...changed},expected))
})

test('hosted and local signing commands reject the public repository before files, network or hardware access',async()=>{
  const exec=promisify(execFile)
  const denied=error=>{assert.match(error.stderr,/Windows signing is only enabled for EduWork-ECNU/);return true}
  await assert.rejects(exec(process.execPath,[fileURLToPath(new URL('../release/windows-signing/hosted.mjs',import.meta.url))],{env:{...process.env,GITHUB_REPOSITORY:'ECNU/EduWork'},windowsHide:true}),denied)
  const args=['request','payload-root','output','edition-commit','core-commit','source-run','request-run','request-sha256','policy-sha256','version'].flatMap(key=>['--'+key,'unused'])
  await assert.rejects(exec(process.execPath,[fileURLToPath(new URL('../release/windows-signing/sign-request.mjs',import.meta.url)),'--repository','ECNU/EduWork',...args],{windowsHide:true}),denied)
})
test('publisher independently fetches the two request artifacts and validates the full run chain',async t=>{
  const root=await mkdtemp(join(tmpdir(),'eduwork-signing-chain-'));t.after(()=>rm(root,{recursive:true,force:true}))
  const receipt=signedReceipt(),runs=[]
  let corruptArtifact=false,corruptRequest=false
  const github={
    async signingRun(id,commit){runs.push(id);assert.equal(commit,receipt.editionCommit)},
    async artifact(id,name){return {...artifact(name),...(corruptArtifact?{sha256:'0'.repeat(64)}:{})}},
    async download(identity,archive,directory){await mkdir(directory,{recursive:true});const req=receipt.signing[directory.endsWith('inner')?'inner':'outer'].request;await writeFile(join(directory,'request.json'),JSON.stringify(corruptRequest?{...req,stage:'swapped'}:req))},
  }
  const options={github,receipt,policy,sourceRun:'1',finalRun:'4',repository:'ECNU/EduWork-ECNU',root}
  await verifySigningChain(options);assert.deepEqual(runs,['4','2','3'])
  await assert.rejects(verifySigningChain({...options,sourceRun:'9'}))
  await assert.rejects(verifySigningChain({...options,finalRun:'9'}))
  await assert.rejects(verifySigningChain({...options,repository:'ECNU/EduWork'}))
  corruptArtifact=true;await assert.rejects(verifySigningChain(options));corruptArtifact=false
  corruptRequest=true;await assert.rejects(verifySigningChain(options))
})
test('artifact extraction refuses traversal, Windows aliases and case collisions',async t=>{
  assert.equal(safePath('resources/'+('long-component/'.repeat(30))+'asset.js'),'resources/'+('long-component/'.repeat(30))+'asset.js')
  for(const path of ['../a','a/../../b','C:/x','/x','a\\b','NUL.txt','a/COM1','a./b','a /b','a:b','a?b']) assert.throws(()=>safePath(path))
  const root=await mkdtemp(join(tmpdir(),'eduwork-signing-zip-'));t.after(()=>rm(root,{recursive:true,force:true}))
  for(const [i,names] of [['a',['../escape']],['b',['a','A']],['c',['safe/file.txt']]]){
    const archive=join(root,i+'.zip'),zip=await ZipWriter.create(archive)
    for(const name of names) await zip.addEntry(name,Buffer.from('synthetic'))
    await zip.close()
    if(i==='c'){await unpackSafe(archive,join(root,i));assert.equal(await readFile(join(root,i,'safe/file.txt'),'utf8'),'synthetic')}
    else await assert.rejects(unpackSafe(archive,join(root,i)))
  }
})

test('digest preparation binds SignTool-emitted bytes while local regeneration preserves the approved payload',async t=>{
  const root=await mkdtemp(join(tmpdir(),'eduwork-signing-padding-'));t.after(()=>rm(root,{recursive:true,force:true}))
  const req=request(),input=join(root,'input')
  for(const path of ownedWindowsFiles){await mkdir(join(input,path,'..'),{recursive:true});await writeFile(join(input,path),'original PE fixture')}
  const buildURL=new URL('../release/windows-signing/util.mjs',import.meta.url).href
  const operationsURL=new URL('../release/windows-signing/operations.mjs',import.meta.url).href
  const envelopes=Object.fromEntries(req.entries.map(e=>[e.path.split('/').at(-1),e]))
  const stub=`export * from ${JSON.stringify(buildURL+'?native-test')};
    import fs from 'node:fs';import path from 'node:path';
    const envelopes=${JSON.stringify(envelopes)};
    export async function run(command,args){
      if(command!=='pwsh')throw Error('Unexpected command');
      const job=JSON.parse(fs.readFileSync(args.at(-1),'utf8')),base=path.basename(job.file),entry=envelopes[base];
      fs.appendFileSync(job.file,'alignment');
      fs.writeFileSync(path.join(job.directory,base+'.dig'),entry.digest);
      fs.writeFileSync(path.join(job.directory,base+'.p7u'),Buffer.from(entry.pkcs7,'base64'));
      return {stdout:''};
    }`
  const script=`import {registerHooks} from 'node:module';import fs from 'node:fs';
    registerHooks({resolve(s,c,next){const r=next(s,c);return r.url===${JSON.stringify(buildURL)}?{url:${JSON.stringify('data:text/javascript,'+encodeURIComponent(stub))},shortCircuit:true}:r}});
    const {createSigningRequest,checkSigningPayload}=await import(${JSON.stringify(operationsURL)});
    const request=await createSigningRequest({stage:'inner',context:${JSON.stringify(req.context)},policy:${JSON.stringify(policy)},root:${JSON.stringify(input)},work:${JSON.stringify(join(root,'generate'))}});
    await checkSigningPayload(request,${JSON.stringify(input)},${JSON.stringify(join(root,'regenerate'))});
    fs.writeFileSync(${JSON.stringify(join(root,'result.json'))},JSON.stringify(request));`
  await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{windowsHide:true})
  const generated=JSON.parse(await readFile(join(root,'result.json'),'utf8'))
  for(const entry of generated.entries){
    assert.equal(entry.inputSHA256,sha256('original PE fixture'))
    assert.equal(entry.sha256,sha256('original PE fixturealignment'))
    assert.equal(await readFile(join(input,entry.path),'utf8'),'original PE fixturealignment')
  }
})

test('full manifest comparison rejects injected, missing and changed third-party files',()=>{
  const files=[...ownedWindowsFiles,'resources/node.exe'].map(path=>({path,bytes:1,sha256:sha256(path)}))
  const before={files},after=structuredClone(before)
  after.files[0].sha256=sha256('signed');compareManifests(before,after)
  for(const mutate of [m=>m.files.push({path:'extra',bytes:1,sha256:sha256('x')}),m=>m.files.pop(),m=>m.files.at(-1).sha256=sha256('tampered'),m=>m.files[1]=m.files[0]]) {
    const bad=structuredClone(after);mutate(bad);assert.throws(()=>compareManifests(before,bad))
  }
})

test('school workflows keep unsigned builds away from the publisher and require both signing rounds',async()=>{
  const read=path=>readFile(new URL('../../'+path,import.meta.url),'utf8')
  const build=await read('.github/workflows/development-windows.yml'),signing=await read('.github/workflows/windows-signing.yml'),publish=await read('.github/workflows/publish-desktop-candidate.yml')
  assert.match(build,/'windows-unsigned'/);assert.doesNotMatch(build,/uses: .*publish-desktop-candidate/)
  assert.match(signing,/contents: read/);assert.doesNotMatch(signing,/contents: write|secrets\.|self-hosted/)
  assert.match(signing,/name: windows-signing-state\s+path: [^\n]+\s+include-hidden-files: true/)
  assert.match(signing,/institution\/edition\/release\/windows-signing\/hosted.mjs/)
  assert.match(signing,/if: inputs.stage == 'finalize'[\s\S]*name: windows-release/)
  assert.match(publish,/WINDOWS_SIGNING_RUN_ID:/);assert.match(publish,/institution\/edition\/release\/windows-signing\/publish.mjs/)
  assert.doesNotMatch(publish,/run: node core\/scripts\/publish-desktop-candidate.mjs/)
})

test('signed file gate hashes delivered archives, Setup, notes, feeds and sidecars',async t=>{
  const root=await mkdtemp(join(tmpdir(),'ecnu-final-files-'));t.after(()=>rm(root,{recursive:true,force:true}))
  const receipt=signedReceipt();receipt.distribution='eduwork-chatecnu';receipt.deltas=[]
  const save=async(name,bytes)=>{await writeFile(join(root,name),bytes);return {name,bytes:Buffer.byteLength(bytes),sha256:sha256(bytes)}}
  receipt.asset=await save(receipt.asset.name,'signed application archive fixture')
  receipt.portableExtractor.asset=await save(receipt.portableExtractor.asset.name,'signed setup archive fixture')
  receipt.setupExecutable=await save('EduWork-ECNU-0.4.11-windows-x64-setup.exe','signed Setup fixture')
  const signed=receipt.signing.files.find(f=>f.path==='EduWork-ECNU-Setup.exe')
  signed.bytes=receipt.setupExecutable.bytes;signed.sha256=receipt.setupExecutable.sha256
  const extractor={schemaVersion:1,kind:'eduwork-portable-extractor',format:'zip-containing-self-extracting-exe',version:receipt.version,distribution:receipt.distribution,payload:receipt.asset,asset:receipt.portableExtractor.asset,extractor:{name:'EduWork-ECNU-Setup.exe',bytes:signed.bytes,sha256:signed.sha256,sourceCommit:toolsLock.commit,sourceDirty:false},checks:Object.fromEntries(['embeddedArchive','manifestIdentity','outerZIP','extraction'].map(k=>[k,'passed']))}
  extractor.checks.executionLevel='asInvoker'
  receipt.portableExtractor.receipt=await save(receipt.portableExtractor.receipt.name,JSON.stringify(extractor))
  receipt.releaseNotes.sha256=(await save('RELEASE-NOTES.md','# Approved synthetic 0.4.11\n')).sha256
  for(const d of [receipt.asset,receipt.portableExtractor.asset,receipt.setupExecutable]) await save(d.name+'.sha256',`${d.sha256}  ${d.name}\n`)
  const {githubUpdateManifestBytes,updateManifestName}=await coreModule('scripts/github-update-manifest.mjs')
  await save(updateManifestName,githubUpdateManifestBytes(receipt,'ECNU/EduWork-ECNU'))
  await save('release-receipt.json',JSON.stringify(receipt))
  const context={repository:'ECNU/EduWork-ECNU',version:'0.4.11',commit:receipt.editionCommit,policy}
  const result=await validateSignedFiles(root,context);assert.equal(result.files.length,10)
  const originalExtractor=JSON.stringify(extractor),originalDescriptor=structuredClone(receipt.portableExtractor.receipt)
  extractor.extractor.sourceCommit=receipt.coreCommit
  receipt.portableExtractor.receipt=await save(originalDescriptor.name,JSON.stringify(extractor))
  await save('release-receipt.json',JSON.stringify(receipt))
  await assert.rejects(validateSignedFiles(root,context),/extractor source/)
  await save(originalDescriptor.name,originalExtractor);receipt.portableExtractor.receipt=originalDescriptor
  await save('release-receipt.json',JSON.stringify(receipt))
  await assert.rejects(validateSignedFiles(root,{...context,repository:'ECNU/EduWork'}))
  for(const field of ['publication','signing']) {
    const altered=structuredClone(receipt);delete altered[field]
    await save('release-receipt.json',JSON.stringify(altered));await assert.rejects(validateSignedFiles(root,context))
  }
  await save('release-receipt.json',JSON.stringify(receipt))
  for(const name of [receipt.asset.name,receipt.setupExecutable.name,'RELEASE-NOTES.md',updateManifestName,receipt.asset.name+'.sha256',receipt.portableExtractor.receipt.name]) {
    const bytes=await readFile(join(root,name));await writeFile(join(root,name),'corrupt')
    await assert.rejects(validateSignedFiles(root,context));await writeFile(join(root,name),bytes)
  }
  await save('unexpected.exe','extra');await assert.rejects(validateSignedFiles(root,context))
})

test('publisher rejects an unsigned request before any network or file input',async()=>{
  const {preparePublication,publishPrepared}=await import('../release/windows-signing/publish.mjs')
  await assert.rejects(preparePublication({GITHUB_REPOSITORY:'ECNU/EduWork'}),/only enabled/)
  await assert.rejects(preparePublication({GITHUB_REPOSITORY:'ECNU/EduWork-ECNU',GITHUB_ACTIONS:'true',PUBLISH_RELEASE:'false',RELEASE_NOTES_APPROVED:'true',SOURCE_RUN_ID:'1',GITHUB_RUN_ID:'4'}))
  await assert.rejects(publishPrepared({}, {PUBLISH_RELEASE:'false',GITHUB_REF:'refs/heads/main'}))
})

test('actual signed updater survives the pinned packer manifest check byte-for-byte', {skip:!process.env.EDUWORK_SIGNED_UPDATER_FIXTURE},async t=>{
  const root=await mkdtemp(join(tmpdir(),'ecnu-signed-packer-'));t.after(()=>rm(root,{recursive:true,force:true}))
  const fixture=process.env.EDUWORK_SIGNED_UPDATER_FIXTURE,output=join(root,'EduWork-ECNU-0.4.11-windows-x64-electron.zip')
  const {signingTool}=await import('../release/windows-signing/operations.mjs')
  const realPolicy=JSON.parse(await readFile(new URL('../windows-signing.json',import.meta.url),'utf8'))
  await signingTool('verify',{file:fixture,policy:realPolicy,output:join(root,'verification.json')},join(root,'verify'))
  assert.equal(JSON.parse(await readFile(join(root,'verification.json'),'utf8')).status,'Valid')
  const script=`import assert from 'node:assert/strict';import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
    import {join} from 'node:path';
    const {packSignedInner}=await import(${JSON.stringify(new URL('../release/windows-signing/packaging.mjs',import.meta.url).href)});
    const {sha256File}=await import(${JSON.stringify(new URL('../release/windows-signing/util.mjs',import.meta.url).href)});
    const {coreModule}=await import(${JSON.stringify(new URL('../release/windows-signing/core.mjs',import.meta.url).href)});
    const root=${JSON.stringify(root)},fixture=${JSON.stringify(fixture)},candidate=join(root,'candidate');
    const before=await sha256File(fixture);await mkdir(join(candidate,'resources/update'),{recursive:true});await mkdir(join(candidate,'resources/app'),{recursive:true});
    await copyFile(fixture,join(candidate,'resources/update/EduWork-Updater.exe'));
    await writeFile(join(candidate,'resources/app/eduwork.desktop.json'),JSON.stringify({productVersion:'0.4.11',shell:'electron',distribution:'eduwork-chatecnu'}));
    for(const name of ['ChatECNU-Work.exe','EduWork.exe','EduWork-Electron.exe'])await writeFile(join(candidate,name),'non-executed launcher fixture');
    await packSignedInner(candidate,${JSON.stringify(output)});
    assert.equal(await sha256File(fixture),before);assert.equal(await sha256File(join(candidate,'resources/update/EduWork-Updater.exe')),before);
    const {ZipReader}=await coreModule('scripts/lib/zip.mjs'),zip=await ZipReader.open(${JSON.stringify(output)});
    const delivered=zip.read(zip.entries.find(e=>e.name.endsWith('/resources/update/EduWork-Updater.exe')));
    assert(delivered.equals(await readFile(fixture)));
    const manifest=JSON.parse(zip.read(zip.entries.find(e=>e.name.endsWith('/RELEASE-MANIFEST.json'))));
    assert.equal(manifest.files.find(f=>f.path==='resources/update/EduWork-Updater.exe').sha256,before);`
  await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{windowsHide:true})
})

test('original build must pass publisher first launch and source snapshot before any signature request',async()=>{
  const original=signedReceipt();delete original.signing
  original.distribution='eduwork-chatecnu';original.recipe='pinned-source'
  Object.assign(original.checks,{sourceSnapshot:'passed',publisherFirstLaunch:'passed',mediaTemplate:'passed'})
  const context={repository:'ECNU/EduWork-ECNU',version:original.version,commit:original.editionCommit}
  await validateOriginalReceipt(original,context)
  for(const check of ['sourceSnapshot','publisherFirstLaunch','mediaTemplate']) for(const value of [undefined,'not-run','failed']) {
    const bad=structuredClone(original);bad.checks[check]=value;await assert.rejects(validateOriginalReceipt(bad,context))
  }
})

test('retry of an existing public stable release checks Latest without issuing writes',async t=>{
  const {publishPrepared}=await import('../release/windows-signing/publish.mjs')
  const file={name:'synthetic.zip',bytes:5,sha256:'a'.repeat(64)},commit='b'.repeat(40)
  const release={id:10,draft:false,tag_name:'v0.4.11',target_commitish:commit,name:'Approved 0.4.11',body:'notes',prerelease:false,assets:[{...file,size:file.bytes,digest:'sha256:'+file.sha256,state:'uploaded'}],html_url:'https://github.com/ECNU/EduWork-ECNU/releases/tag/v0.4.11'}
  let latest=11
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(options.method,'GET','Existing public release must never be modified')
    const path=new URL(url).pathname
    const value=path.endsWith('/releases/latest')?{id:latest}:path.endsWith('/releases')?[release]:{object:{type:'commit',sha:commit}}
    return new Response(JSON.stringify(value),{status:200})
  })
  const prepared={repository:'ECNU/EduWork-ECNU',version:'0.4.11',editionCommit:commit,title:release.name,notes:release.body,files:[file]}
  const env={PUBLISH_RELEASE:'true',GITHUB_REF:'refs/heads/main',GITHUB_TOKEN:'synthetic-test-only'}
  await assert.rejects(publishPrepared(prepared,env),/Latest/)
  latest=10;assert.equal(await publishPrepared(prepared,env),release.html_url)
})
