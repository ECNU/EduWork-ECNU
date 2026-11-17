import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {entitlementsFor,signingOrder,machoMagic,validateContentPreserved} from '../release/macos-signing/files.mjs'
import {copyReviewedCandidate, readReviewedRelease, textHash, validateRelease} from '../release/macos-signing/github.mjs'
import {validateSourceRun,validateQualification,validatePublicationState,replaceMacAssets} from '../release/macos-signing/publication.mjs'
const plan=JSON.parse(await readFile(new URL('../release/macos-signing/inputs/0.4.13.json',import.meta.url)))
const policy=JSON.parse(await readFile(new URL('../macos-signing.json',import.meta.url)))
const clone=value=>structuredClone(value)
test('draft signing requires the same bytes as the reviewed release asset', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'ecnu-mac-candidate-'))
  t.after(() => rm(dir, {recursive:true, force:true}))
  const source = join(dir, 'candidate.zip'), destination = join(dir, 'original.zip')
  const asset = {size:4, digest:'sha256:' + textHash('good')}
  await writeFile(source, 'good')
  await copyReviewedCandidate(source, destination, asset)
  assert.equal(await readFile(destination, 'utf8'), 'good')
  await writeFile(source, 'evil')
  await assert.rejects(copyReviewedCandidate(source, destination, asset), /digest differs/)
  await writeFile(source, 'longer')
  await assert.rejects(copyReviewedCandidate(source, destination, asset), /size differs/)
})
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
  const release={id:plan.releaseId,tag_name:plan.tag,target_commitish:plan.editionCommit,draft:false,prerelease:false,immutable:false,body:'',assets:clone(plan.assets)}
  validateRelease(release,fixture)
  const devPlan={...fixture,version:'0.4.14-dev.20261115.1',tag:'v0.4.14-dev.20261115.1'}
  const devRelease={...release,tag_name:devPlan.tag,prerelease:true}
  validateRelease(devRelease,devPlan)
  const draftPlan={...devPlan,draft:true}
  validateRelease({...devRelease,draft:true},draftPlan)
  assert.throws(()=>validateRelease(devRelease,draftPlan))
  assert.throws(()=>validateRelease({...devRelease,draft:true},devPlan))
  assert.throws(()=>validateRelease({...release,draft:true},{...fixture,draft:true}))
  assert.throws(()=>validateRelease({...devRelease,prerelease:false},devPlan))
  for(const alter of [s=>s.assets[0].digest='sha256:bad',s=>s.assets.pop(),s=>s.body='different',s=>s.target_commitish='main']) {
    const bad=clone(release);alter(bad);assert.throws(()=>validateRelease(bad,fixture))
  }
})
test('Mac signing loads only explicitly reviewed release versions',async()=>{
  assert.deepEqual(await readReviewedRelease(plan.version),plan)
  await assert.rejects(readReviewedRelease('0.4.14-dev.20261115.0'),{code:'ERR_ASSERTION'})
  await assert.rejects(readReviewedRelease('0.4.14-dev.20261115.1/draft'),{code:'ERR_ASSERTION'})
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
  const release={id:p.releaseId,tag_name:p.tag,target_commitish:p.editionCommit,body:'',draft:false,prerelease:false,immutable:false,assets:clone(p.assets)}
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
test('changing a development release to stable aborts Mac asset replacement',()=>{
  const {release,p,items}=fixture()
  p.version='0.4.14-dev.20261115.1'
  p.tag='v'+p.version
  release.tag_name=p.tag
  release.prerelease=true
  validatePublicationState(release,p,items,'123')
  validatePublicationState({...release,draft:true},{...p,draft:true},items,'123')
  assert.throws(()=>validatePublicationState(release,{...p,draft:true},items,'123'))
  release.prerelease=false
  assert.throws(()=>validatePublicationState(release,p,items,'123'))
})
