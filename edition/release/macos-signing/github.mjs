import assert from 'node:assert/strict'
import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { identity } from './files.mjs'

export const textHash = value => createHash('sha256').update(value).digest('hex')
export function validateRelease(release, plan, {allowExtra = false} = {}) {
  assert.equal(release.id, plan.releaseId);assert.equal(release.tag_name, plan.tag)
  assert.equal(release.target_commitish, plan.editionCommit)
  assert.equal(release.draft,false);assert.equal(release.immutable,false)
  assert.equal(textHash(release.body),plan.bodySHA256)
  if(!allowExtra)assert.equal(release.assets.length,plan.assets.length)
  for(const asset of plan.assets) {
    const found=release.assets.filter(row=>row.name===asset.name)
    assert.equal(found.length,1,`Missing source asset ${asset.name}`)
    for(const key of ['id','size','digest'])assert.equal(found[0][key],asset[key],`Changed source asset ${asset.name}: ${key}`)
  }
}
export function releaseAPI(token=process.env.GITHUB_TOKEN) {
  assert(token)
  const base='https://api.github.com/repos/ECNU/EduWork-ECNU'
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'EduWork-ECNU-macOS-signing'}
  async function request(path,method='GET',body) {
    const response=await fetch(base+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})})
    assert(response.ok,`GitHub ${method} ${path}: ${response.status}`)
    return response.status===204?null:response.json()
  }
  async function download(asset,path) {
    const first=await fetch(`${base}/releases/assets/${asset.id}`,{headers:{...headers,Accept:'application/octet-stream'},redirect:'manual'})
    let response=first
    if(first.status===302){const url=new URL(first.headers.get('location'));assert.equal(url.protocol,'https:');response=await fetch(url)}
    assert(response.ok)
    await mkdir(dirname(path),{recursive:true})
    await pipeline(Readable.fromWeb(response.body),createWriteStream(path,{flags:'wx'}))
    const actual=await identity(path)
    assert.equal(actual.bytes,asset.size);assert.equal('sha256:'+actual.sha256,asset.digest)
  }
  async function upload(releaseId,file,name,expected) {
    const actual=await identity(file);assert.deepEqual(actual,expected)
    const url=`https://uploads.github.com/repos/ECNU/EduWork-ECNU/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`
    const response=await fetch(url,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream','Content-Length':String(actual.bytes)},body:createReadStream(file),duplex:'half'})
    assert(response.ok,`Upload ${name}: HTTP ${response.status}`)
    const uploaded=await response.json();assert.equal(uploaded.size,actual.bytes);assert.equal(uploaded.digest,'sha256:'+actual.sha256)
    return uploaded
  }
  return {request,download,upload}
}
