// Website installers are distinct from the client updater ZIP/appcast feeds.
import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {fileURLToPath} from 'node:url'

export const websiteOrigin='https://ecnunic-data-cdn.oss-cn-shanghai.aliyuncs.com'
const prefix='/chatecnu-work/releases-bridge/stable/'
const repository='ECNU/EduWork-ECNU'
export const websitePlatforms={
 windows:{target:'windows-amd64',suffix:'windows-x64-setup.zip',format:'setup-zip',pointer:'latest-windows-amd64.json'},
 macos:{target:'darwin-arm64',suffix:'macos-arm64-electron.dmg',format:'dmg',pointer:'latest-macos-arm64.json'},
}

function originURL(value){
 const url=new URL(value)
 assert.equal(url.protocol,'https:');assert.equal(url.pathname,'/')
 assert.ok(!url.username&&!url.password&&!url.search&&!url.hash)
 return url.origin
}

export function websiteManifest(release,platform,origin=websiteOrigin){
 origin=originURL(origin)
 const spec=websitePlatforms[platform];assert.ok(spec,'Unsupported website platform')
 assert.equal(release.draft,false);assert.equal(release.prerelease,false,'Website accepts stable releases only')
 assert.match(release.tag_name??'',/^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/)
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
 const url=origin+prefix+version+'/'+name
 return {schemaVersion:1,distribution:'eduwork-chatecnu',channel:'stable',version,target:spec.target,publishedAt:release.published_at,
  release:{tag:'v'+version,notes:'当前稳定版汇总了工作台、Knowledge Studio、学校服务与桌面体验更新，完整内容请查看发行说明。',schoolReleaseUrl:releaseURL,publicReleaseUrl:`https://github.com/ECNU/EduWork/releases/tag/v${version}`},
  artifacts:[{shell:'electron',flavor:'installer',format:spec.format,fileName:name,bytes:asset.size,sha256:asset.digest.slice(7),url,sha256Url:url+'.sha256'}]}
}

// Call only after original binaries have passed the deployment's full hash check.
// This checks live pointers and installer metadata, not a second binary download.
export async function verifyWebsiteRelease(release,{origin=websiteOrigin,fetcher=fetch}={}){
 origin=originURL(origin)
 const expected=Object.entries(websitePlatforms).map(([platform,spec])=>({spec,manifest:websiteManifest(release,platform,origin)}))
 const verified=[]
 for(const {spec,manifest} of expected){
  const pointerURL=origin+prefix+'website/'+spec.pointer
  const response=await fetcher(pointerURL,{cache:'no-store',headers:{Origin:'https://aitools.ecnu.edu.cn'}})
  assert.equal(response.status,200,`Website pointer unavailable: ${pointerURL}`)
  assert.ok(['*','https://aitools.ecnu.edu.cn'].includes(response.headers.get('access-control-allow-origin')),'Website CORS missing')
  assert.match(response.headers.get('cache-control')??'',/no-cache|no-store/,'Website pointer must revalidate')
  assert.deepEqual(await response.json(),manifest,'Website pointer differs from this stable release')
  const asset=manifest.artifacts[0],head=await fetcher(asset.url,{method:'HEAD',cache:'no-store'})
  assert.equal(head.status,200,'Website installer unavailable')
  assert.equal(Number(head.headers.get('content-length')),asset.bytes,'Website installer size mismatch')
  const checksum=await fetcher(asset.sha256Url,{cache:'no-store'})
  assert.equal(checksum.status,200,'Website installer checksum unavailable')
  assert.equal((await checksum.text()).trim(),`${asset.sha256}  ${asset.fileName}`,'Website installer checksum mismatch')
  verified.push({target:spec.target,version:manifest.version,pointerURL,installer:asset.fileName})
 }
 return {version:release.tag_name.slice(1),websiteVerified:true,platforms:verified}
}

async function main(){
 const args=process.argv.slice(2),mode=args.shift(),options={}
 assert.ok(['prepare','verify'].includes(mode),'Use prepare or verify')
 for(let i=0;i<args.length;i+=2){assert.match(args[i],/^--(?:release|output|origin)$/);assert.ok(args[i+1]);assert.ok(!Object.hasOwn(options,args[i]));options[args[i]]=args[i+1]}
 assert.ok(options['--release'],'Provide the published GitHub Release JSON')
 const release=JSON.parse((await readFile(options['--release'],'utf8')).replace(/^\uFEFF/,''))
 const origin=options['--origin']??websiteOrigin
 if(mode==='prepare'){
  assert.ok(options['--output']);const output=resolve(options['--output'])
  const pointers=Object.entries(websitePlatforms).map(([platform,spec])=>({name:spec.pointer,value:websiteManifest(release,platform,origin)}))
  await mkdir(output,{recursive:false})
  for(const {name,value} of pointers)await writeFile(join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'})
  console.log(JSON.stringify({version:release.tag_name.slice(1),prepared:pointers.map(p=>p.name)}))
 }else console.log(JSON.stringify(await verifyWebsiteRelease(release,{origin})))
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main()
