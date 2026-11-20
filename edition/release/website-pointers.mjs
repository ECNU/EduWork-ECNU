// Website installers are distinct from the client updater ZIP/appcast feeds.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'

export const websiteOrigin='https://ecnunic-data-cdn.oss-cn-shanghai.aliyuncs.com'
const websiteRoot='/chatecnu-work/releases-bridge/'
const tagPatterns={
 stable:/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/,
 development:/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-dev\.\d{8}\.[1-9]\d*$/,
}
const repository='ECNU/EduWork-ECNU'
export const websitePlatforms={
 // Keep the legacy ZIP pointer usable by already deployed website versions.
 windows:{target:'windows-amd64',suffix:'windows-x64-setup.zip',format:'setup-zip',pointer:'latest-windows-amd64.json'},
 'windows-exe':{target:'windows-amd64',suffix:'windows-x64-setup.exe',format:'setup-exe',pointer:'latest-windows-amd64-exe.json'},
 macos:{target:'darwin-arm64',suffix:'macos-arm64-electron.dmg',format:'dmg',pointer:'latest-macos-arm64.json'},
 'macos-x64':{target:'darwin-amd64',suffix:'macos-x64-electron.dmg',format:'dmg',pointer:'latest-macos-x64.json'},
}

function originURL(value){
 const url=new URL(value)
 assert.equal(url.protocol,'https:');assert.equal(url.pathname,'/')
 assert.ok(!url.username&&!url.password&&!url.search&&!url.hash)
 return url.origin
}

export function websiteManifest(release,platform,origin=websiteOrigin,channel='stable'){
 origin=originURL(origin)
 const spec=websitePlatforms[platform];assert.ok(spec,'Unsupported website platform')
 assert.ok(Object.hasOwn(tagPatterns,channel),'Unsupported website channel')
 assert.equal(release.draft,false);assert.equal(release.prerelease,channel==='development','Release does not match website channel')
 assert.match(release.tag_name??'',tagPatterns[channel])
 const version=release.tag_name.slice(1)
 const releaseURL=`https://github.com/${repository}/releases/tag/v${version}`
 assert.equal(release.html_url,releaseURL,'Wrong release repository')
 assert.ok(typeof release.published_at==='string'&&Number.isFinite(Date.parse(release.published_at)))
 const name=`EduWork-ECNU-${version}-${spec.suffix}`
 const matches=release.assets.filter(asset=>asset.name===name)
 assert.equal(matches.length,1,`Expected one website installer: ${name}`)
 const asset=matches[0]
 assert.equal(asset.browser_download_url,`https://github.com/${repository}/releases/download/v${version}/${name}`)
 assert.match(asset.digest??'',/^sha256:[a-f0-9]{64}$/,'Installer must carry a GitHub SHA-256 digest')
 assert.ok(Number.isSafeInteger(asset.size)&&asset.size>0)
 const url=origin+websiteRoot+channel+'/'+version+'/'+name
 const releaseInfo={tag:'v'+version,notes:'开发预览版的功能与测试范围见本版发布说明。',schoolReleaseUrl:releaseURL}
 if(channel==='stable'){
  releaseInfo.notes='当前稳定版汇总了工作台、Knowledge Studio、学校服务与桌面体验更新，完整内容请查看发行说明。'
  releaseInfo.publicReleaseUrl=`https://github.com/ECNU/EduWork/releases/tag/v${version}`
 }
 const manifest={schemaVersion:1,distribution:'eduwork-chatecnu',channel,version,target:spec.target,publishedAt:release.published_at,
  release:releaseInfo,
  artifacts:[{shell:'electron',flavor:'installer',format:spec.format,fileName:name,bytes:asset.size,sha256:asset.digest.slice(7),url,sha256Url:url+'.sha256'}]}
 if(platform==='windows-exe')manifest.fallbackArtifact=websiteManifest(release,'windows',origin,channel).artifacts[0]
 return manifest
}

// Call only after original binaries have passed the deployment's full hash check.
// This checks live pointers and installer metadata, not a second binary download.
export async function verifyWebsiteRelease(release,{origin=websiteOrigin,fetcher=fetch,channel='stable'}={}){
 origin=originURL(origin)
 const expected=Object.entries(websitePlatforms).map(([platform,spec])=>({spec,manifest:websiteManifest(release,platform,origin,channel)}))
 const verified=[]
 for(const {spec,manifest} of expected){
  const pointerURL=origin+websiteRoot+channel+'/website/'+spec.pointer
  const response=await fetcher(pointerURL,{cache:'no-store',headers:{Origin:'https://aitools.ecnu.edu.cn'}})
  assert.equal(response.status,200,`Website pointer unavailable: ${pointerURL}`)
  if(channel==='stable')assert.ok(['*','https://aitools.ecnu.edu.cn'].includes(response.headers.get('access-control-allow-origin')),'Website CORS missing')
  assert.match(response.headers.get('cache-control')??'',/no-cache|no-store/,'Website pointer must revalidate')
  const received=await response.json()
  const installer=manifest.artifacts[0]
  if(installer.format==='dmg'){
   const signedURL=origin+websiteRoot+channel+'/'+manifest.version+'/signed/'+installer.sha256+'/'+installer.fileName
   if(received.artifacts?.[0]?.url===signedURL){
    installer.url=signedURL
    installer.sha256Url=signedURL+'.sha256'
   }
  }
  assert.deepEqual(received,manifest,'Website pointer differs from the selected release')
  for(const asset of [...manifest.artifacts,...(manifest.fallbackArtifact?[manifest.fallbackArtifact]:[])]){
  const head=await fetcher(asset.url,{method:'HEAD',cache:'no-store'})
  assert.equal(head.status,200,'Website installer unavailable')
  assert.equal(Number(head.headers.get('content-length')),asset.bytes,'Website installer size mismatch')
  const checksum=await fetcher(asset.sha256Url,{cache:'no-store'})
  assert.equal(checksum.status,200,'Website installer checksum unavailable')
  assert.equal((await checksum.text()).trim(),`${asset.sha256}  ${asset.fileName}`,'Website installer checksum mismatch')
  }
  verified.push({target:spec.target,version:manifest.version,pointerURL,installer:manifest.artifacts[0].fileName})
 }
 return {version:release.tag_name.slice(1),websiteVerified:true,platforms:verified}
}

async function main(){
 const args=process.argv.slice(2),mode=args.shift(),options={}
 assert.ok(['prepare','verify'].includes(mode),'Use prepare or verify')
 for(let i=0;i<args.length;i+=2){assert.match(args[i],/^--(?:release|output|origin|channel)$/);assert.ok(args[i+1]);assert.ok(!Object.hasOwn(options,args[i]));options[args[i]]=args[i+1]}
 assert.ok(options['--release'],'Provide the published GitHub Release JSON')
 const release=JSON.parse((await readFile(options['--release'],'utf8')).replace(/^\uFEFF/,''))
 const origin=options['--origin']??websiteOrigin
 const channel=options['--channel']??'stable'
 if(mode==='prepare'){
  assert.ok(options['--output']);const output=resolve(options['--output'])
  const pointers=Object.entries(websitePlatforms).map(([platform,spec])=>({name:spec.pointer,value:websiteManifest(release,platform,origin,channel)}))
  await mkdir(output,{recursive:false})
  for(const {name,value} of pointers)await writeFile(join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({version:release.tag_name.slice(1),channel,prepared:pointers.map(p=>p.name)}))
 }else console.log(JSON.stringify(await verifyWebsiteRelease(release,{origin,channel})))
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main()
