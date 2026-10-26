import assert from 'node:assert/strict'
import test from 'node:test'
import {websiteManifest,verifyWebsiteRelease,websitePlatforms} from '../release/website-pointers.mjs'

function fixture(){
 const version='0.4.6',root='https://github.com/ECNU/EduWork-ECNU/releases'
 const assets=Object.values(websitePlatforms).map(spec=>{
  const name=`EduWork-ECNU-${version}-${spec.suffix}`
  return {name,size:123,digest:'sha256:'+'a'.repeat(64),browser_download_url:`${root}/download/v${version}/${name}`}
 })
 return {tag_name:'v'+version,html_url:`${root}/tag/v${version}`,draft:false,prerelease:false,published_at:'2026-10-18T14:13:22Z',assets}
}
function server(release,mutate=()=>{}){
 const replies=new Map()
 for(const [platform,spec] of Object.entries(websitePlatforms)){
  const manifest=websiteManifest(release,platform),asset=manifest.artifacts[0]
  replies.set('https://ecnunic-data-cdn.oss-cn-shanghai.aliyuncs.com/chatecnu-work/releases-bridge/stable/website/'+spec.pointer,{body:manifest,headers:{'Cache-Control':'no-cache','Access-Control-Allow-Origin':'*'}})
  replies.set(asset.url,{body:null,headers:{'Content-Length':String(asset.bytes)}})
  replies.set(asset.sha256Url,{body:asset.sha256+'  '+asset.fileName+'\n'})
 }
 mutate(replies)
 return async url=>{const reply=replies.get(url);if(!reply)return new Response(null,{status:404});return new Response(typeof reply.body==='object'&&reply.body!==null?JSON.stringify(reply.body):reply.body,{status:reply.status??200,headers:reply.headers})}
}

test('stable website chooses Windows setup and Mac DMG from exact release assets',()=>{
 const release=fixture(),before=structuredClone(release)
 assert.equal(websiteManifest(release,'windows').artifacts[0].format,'setup-zip')
 assert.equal(websiteManifest(release,'macos').artifacts[0].format,'dmg')
 assert.deepEqual(release,before)
})
for(const [name,mutate] of [
 ['prerelease',r=>{r.prerelease=true}],['dev tag',r=>{r.tag_name='v0.4.6-dev.1'}],['draft',r=>{r.draft=true}],
 ['missing installer',r=>{r.assets=[]}],['ambiguous installer',r=>{r.assets.push(r.assets[0])}],
 ['missing digest',r=>{delete r.assets[0].digest}],['different repository',r=>{r.html_url=r.html_url.replace('-ECNU','')}],
])test(`website rejects ${name}`,()=>{const release=fixture();mutate(release);assert.throws(()=>websiteManifest(release,'windows'))})

test('delivery verification accepts both current installer pointers',async()=>{
 const release=fixture(),result=await verifyWebsiteRelease(release,{fetcher:server(release)})
 assert.equal(result.websiteVerified,true);assert.equal(result.platforms.length,2)
})
for(const [name,mutate] of [
 ['old version',map=>{[...map.values()][0].body.version='0.4.3'}],
 ['one platform missing',map=>{map.delete([...map.keys()].find(k=>k.endsWith('latest-macos-arm64.json')))}],
 ['updater ZIP instead of installer',map=>{[...map.values()][0].body.artifacts[0].flavor='offline'}],
 ['installer unavailable',map=>{[...map.values()][1].status=404}],
 ['installer size mismatch',map=>{[...map.values()][1].headers['Content-Length']='124'}],
 ['checksum mismatch',map=>{[...map.values()][2].body='b'.repeat(64)}],
 ['CORS missing',map=>{delete [...map.values()][0].headers['Access-Control-Allow-Origin']}],
])test(`delivery verification fails on ${name}`,async()=>{
 const release=fixture();await assert.rejects(verifyWebsiteRelease(release,{fetcher:server(release,mutate)}))
})
