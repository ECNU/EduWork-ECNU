import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {entitlementsFor,signingOrder,machoMagic,validateContentPreserved} from '../release/macos-signing/files.mjs'
import {validateRelease} from '../release/macos-signing/github.mjs'
import {validateSourceRun,validateQualification,validatePublicationState,replaceMacAssets} from '../release/macos-signing/publication.mjs'
const plan=JSON.parse(await readFile(new URL('../release/macos-signing/inputs/0.4.13.json',import.meta.url)))
const policy=JSON.parse(await readFile(new URL('../macos-signing.json',import.meta.url)))
const clone=value=>structuredClone(value)
test('content verification rejects JavaScript, config, symlink and native-file-set changes',()=>{
  const before={entries:{'main.js':{type:'file',macho:false,sha256:'a'},'node':{type:'file',macho:true,sha256:'b'},link:{type:'link',target:'node'}},binaries:['node']}
  const after=clone(before);after.entries.node.sha256='signed';after.entries['_CodeSignature/CodeResources']={type:'file',sha256:'signature'}
  validateContentPreserved(before,after)
  for(const alter of [s=>s.entries['main.js'].sha256='changed',s=>s.entries.link.target='elsewhere',s=>delete s.entries.node,s=>s.binaries.push('extra')]) {
    const bad=clone(after);alter(bad);assert.throws(()=>validateContentPreserved(before,bad))
  }
})
test('native signing order and runtime exceptions are scoped to executable roles',()=>{
  assert.deepEqual(signingOrder(['Framework.app','Framework.app/Contents/A.app','Framework.app/Contents/A.app/Contents/MacOS/A']),['Framework.app/Contents/A.app/Contents/MacOS/A','Framework.app/Contents/A.app','Framework.app'])
  assert(machoMagic(Buffer.from('cffaedfe','hex')));assert(!machoMagic(Buffer.from('plain text')))
  assert(entitlementsFor('Contents/Resources/runtime/node',true).includes('com.apple.security.cs.allow-jit'))
  assert(entitlementsFor('Contents/Resources/python/bin/python3.12',true).includes('com.apple.security.cs.disable-library-validation'))
  assert.deepEqual(entitlementsFor('Contents/Resources/native/addon.node',false),[])
  assert.deepEqual(entitlementsFor('Contents/Frameworks/Sparkle.framework',false),[])
  assert(!entitlementsFor('',true).includes('com.apple.security.cs.disable-library-validation'))
})
test('signing source rejects a modified or missing original release asset',()=>{
  // The production manifest binds the actual release body hash; this fixture
  // supplies an independent known body so its mutation check is exercised.
  const fixture={...plan,bodySHA256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
  const release={id:plan.releaseId,tag_name:plan.tag,target_commitish:plan.editionCommit,draft:false,immutable:false,body:'',assets:clone(plan.assets)}
  validateRelease(release,fixture)
  for(const alter of [s=>s.assets[0].digest='sha256:bad',s=>s.assets.pop(),s=>s.body='different',s=>s.target_commitish='main']) {
    const bad=clone(release);alter(bad);assert.throws(()=>validateRelease(bad,fixture))
  }
})
const sourceRun={id:123,repository:{full_name:'ECNU/EduWork-ECNU'},path:'.github/workflows/macos-signing-release.yml',event:'workflow_dispatch',head_branch:'main',status:'completed',conclusion:'success',head_sha:'a'.repeat(40)}
test('publication accepts only completed main signing workflow runs',()=>{
  validateSourceRun(sourceRun)
  for(const [key,value] of [['path','.github/workflows/other.yml'],['head_branch','feature'],['event','pull_request'],['conclusion','failure'],['status','in_progress']])assert.throws(()=>validateSourceRun({...sourceRun,[key]:value}))
})
test('qualification binds both runtime acceptance and Gatekeeper to the exact signed asset',()=>{
  const name='EduWork-ECNU-0.4.13-macos-arm64-electron.zip',old=plan.assets.find(a=>a.name===name)
  const asset={name,bytes:123,sha256:'f'.repeat(64)},installer={name:name.replace('.zip','.dmg'),bytes:456,sha256:'e'.repeat(64)}
  const receipt={edition:'EduWork-ECNU',version:plan.version,platform:'macos-arm64',editionCommit:plan.editionCommit,coreCommit:plan.coreCommit,passed:true,developerIDSigned:true,notarized:true,minimumSystemVersion:'15.0',applicationName:'EduWork-ECNU.app',asset,installer:{asset:installer},developerIDSigning:{...policy,runId:'123',signerCommit:sourceRun.head_sha,nonCodeContentPreserved:true,originalAsset:{bytes:old.size,sha256:old.digest.slice(7)},applicationNotarization:{status:'Accepted'},diskImageNotarization:{status:'Accepted'}},checks:Object.fromEntries(['desktopLaunch','nativeRuntimes','readOnlyApplication','developerIDSignature','appleNotarization','nonCodeContentPreserved'].map(k=>[k,'passed']))}
  const minimum={passed:true,arch:'arm64',asset,os:'15.7',coreCommit:plan.coreCommit,checks:{desktopLaunch:'passed',nativeRuntimes:'passed',readOnlyApplication:'passed'}}
  const signature={passed:true,arch:'arm64',asset,installer,runId:'123',signerCommit:sourceRun.head_sha,checks:Object.fromEntries(['developerIDSignature','applicationTicket','diskImageTicket','applicationGatekeeper','diskImageGatekeeper'].map(k=>[k,'passed']))}
  const validate=(r=receipt,m=minimum,s=signature)=>validateQualification(r,m,s,plan,policy,sourceRun,'arm64')
  validate()
  assert.throws(()=>validate({...receipt,notarized:false}))
  assert.throws(()=>validate(receipt,{...minimum,os:'26.0'}))
  assert.throws(()=>validate(receipt,{...minimum,asset:{...asset,sha256:'wrong'}}))
  assert.throws(()=>validate(receipt,minimum,{...signature,runId:'999'}))
  assert.throws(()=>validate(receipt,minimum,{...signature,checks:{...signature.checks,applicationGatekeeper:'failed'}}))
})
function fixture(){
  const p={...plan,bodySHA256:'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}
  const assets=plan.assets.filter(a=>/macos.*(?:\.zip|\.dmg|\.sha256|receipt\.json)$/.test(a.name))
  assert.equal(assets.length,10)
  const items=assets.map((a,i)=>({name:a.name,file:a.name,expected:{bytes:100+i,sha256:String(i).repeat(64)}}))
  const release={id:p.releaseId,tag_name:p.tag,target_commitish:p.editionCommit,body:'',draft:false,immutable:false,assets:clone(p.assets)}
  let id=900000000,mutations=0,failAt=Infinity
  const api={
    async upload(releaseId,file,name,expected){assert.equal(releaseId,p.releaseId);release.assets.push({id:id++,name,size:expected.bytes,digest:'sha256:'+expected.sha256})},
    async request(path,method='GET',body){
      if(method==='GET')return clone(release)
      if(++mutations===failAt)throw Error('simulated connection loss')
      const asset=release.assets.find(a=>a.id===Number(path.split('/').at(-1)));assert(asset)
      if(method==='PATCH'){assert(!release.assets.some(a=>a.name===body.name));asset.name=body.name}
      else {assert.equal(method,'DELETE');release.assets=release.assets.filter(a=>a!==asset)}
      return clone(asset)
    }
  }
  return {p,items,release,api,failAt:value=>{failAt=value}}
}
test('staged publication resumes a disconnect after the old asset was renamed',async()=>{
  const f=fixture();f.failAt(2)
  await assert.rejects(replaceMacAssets(f.api,f.p,f.items,'123'),/simulated connection loss/)
  assert.equal(f.release.assets.filter(a=>a.name.startsWith('macos-signing-stage-')).length,10)
  assert.equal(f.release.assets.filter(a=>a.name.startsWith('macos-signing-backup-')).length,1)
  f.failAt(Infinity);const result=await replaceMacAssets(f.api,f.p,f.items,'123')
  assert.equal(result.length,10);assert.equal(f.release.assets.length,plan.assets.length)
  assert.deepEqual(await replaceMacAssets(f.api,f.p,f.items,'123'),result)
  for(const old of plan.assets.filter(a=>!f.items.some(i=>i.name===a.name)))assert.deepEqual(f.release.assets.find(a=>a.name===old.name),old)
})
test('unexpected replacement bytes or changed Windows asset abort before mutation',()=>{
  const f=fixture();const target=f.release.assets.find(a=>a.name===f.items[0].name);target.digest='sha256:unexpected'
  assert.throws(()=>validatePublicationState(f.release,f.p,f.items,'123'))
  const g=fixture();g.release.assets.find(a=>a.name.includes('windows')).size++
  assert.throws(()=>validatePublicationState(g.release,g.p,g.items,'123'))
})
