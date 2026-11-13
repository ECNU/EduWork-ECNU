import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, readFile, readlink, open, realpath, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'

export async function digest(path) { const hash=createHash('sha256');for await(const data of createReadStream(path))hash.update(data);return hash.digest('hex') }
export async function identity(path) {return {bytes:(await stat(path)).size,sha256:await digest(path)}}
export function machoMagic(bytes) { return bytes.length>=4&&['feedface','feedfacf','cefaedfe','cffaedfe','cafebabe','bebafeca','cafebabf','bfbafeca'].includes(bytes.subarray(0,4).toString('hex')) }
export function isSignaturePath(path) { return path.split('/').includes('_CodeSignature')||path.split('/').at(-1)==='CodeResources' }
export function signingOrder(paths) {return [...paths].sort((a,b)=>b.split('/').length-a.split('/').length||b.localeCompare(a))}
export function entitlementsFor(path, executable) {
  if(!executable)return []
  if(path==='Contents/Resources/runtime/node')return ['com.apple.security.cs.allow-jit','com.apple.security.cs.allow-unsigned-executable-memory','com.apple.security.cs.disable-library-validation']
  if(/(?:^|\/)python(?:\d+(?:\.\d+)*)?$/.test(path))return ['com.apple.security.cs.disable-library-validation']
  if(path.includes('(Plugin)'))return ['com.apple.security.cs.allow-jit','com.apple.security.cs.allow-unsigned-executable-memory','com.apple.security.cs.disable-library-validation']
  if(path===''||path.startsWith('Contents/MacOS/')||/Electron Helper|Chromium|Google Chrome/.test(path))return ['com.apple.security.cs.allow-jit','com.apple.security.device.audio-input']
  return []
}
export async function inventory(app) {
  const entries={},binaries=[],bundles=[]
  async function walk(directory) {
    for(const row of await readdir(directory,{withFileTypes:true})) {
      const path=join(directory,row.name),rel=relative(app,path).split(sep).join('/')
      if(row.isSymbolicLink()) {
        const target=await realpath(path)
        assert(target===app||target.startsWith(app+sep),`External app symlink: ${rel}`)
        entries[rel]={type:'link',target:await readlink(path)}
      } else if(row.isDirectory()) {
        if(/\.(?:app|framework|xpc|bundle)$/.test(row.name))bundles.push(rel)
        await walk(path)
      } else if(row.isFile()) {
        const file=await open(path,'r'),magic=Buffer.alloc(4)
        try {await file.read(magic,0,4,0)}finally{await file.close()}
        const macho=machoMagic(magic)
        entries[rel]={type:'file',macho,sha256:await digest(path)}
        if(macho)binaries.push(rel)
      } else throw Error('Unsupported app entry: '+rel)
    }
  }
  app=resolve(app);await walk(app)
  return {entries,binaries,bundles}
}
export function validateContentPreserved(before,after) {
  for(const path of new Set([...Object.keys(before.entries),...Object.keys(after.entries)])) {
    if(isSignaturePath(path)||path==='Contents/Resources/release.json')continue
    const old=before.entries[path],next=after.entries[path]
    assert(old&&next,`Unexpected content added/removed: ${path}`)
    if(old.macho)assert(next.macho&&next.type==='file',`Native file type changed: ${path}`)
    else assert.deepEqual(next,old,`Non-signature content changed: ${path}`)
  }
  assert.deepEqual([...after.binaries].sort(),[...before.binaries].sort())
}
export async function validateReleaseMetadata(before,app) {
  const after=JSON.parse(await readFile(join(app,'Contents/Resources/release.json')))
  assert.deepEqual(after,{...before,developerIDSigned:true,adHocSigned:false,notarized:true})
}
