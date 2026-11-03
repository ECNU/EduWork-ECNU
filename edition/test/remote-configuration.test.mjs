import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'

test('remote configuration feed migrates known origins without changing program updates or trust', async()=>{
  assert.ok(process.env.EDUWORK_CORE_ROOT)
  const {parseUserConfig}=await import(pathToFileURL(join(process.env.EDUWORK_CORE_ROOT,'dsh-host/user-config.mjs')))
  for(const [name,directory] of [['publisher-bootstrap.json','windows'],['publisher-bootstrap.darwin.json','macos']]){
    const file=new URL('../desktop-020/'+name,import.meta.url),value=JSON.parse(await readFile(file,'utf8'))
    const old=value.contentUpdates.baseURL.replace('/core-021-remote/','/core-020/')
    assert.notEqual(old,value.contentUpdates.baseURL)
    assert.ok(value.migrateFrom.includes(old))
    assert.ok(value.contentUpdates.baseURL.endsWith('/'+directory))
    assert.equal(value.contentUpdates.configuration,true)
    assert.equal(value.contentUpdates.skills,false)
    assert.equal(value.contentUpdates.bundled.configuration,0)
    const {migrateFrom,...configuration}=value
    const parsed=parseUserConfig(file.pathname,JSON.stringify(configuration))
    assert.equal(parsed.contentUpdates.publicKey,value.contentUpdates.publicKey)
    assert.ok(!JSON.stringify(value.updates).includes('core-021-remote'))
  }
})

test('signed school relay field uses the configured school account and retains its prefix', async()=>{
  const {parseUserConfig}=await import(pathToFileURL(join(process.env.EDUWORK_CORE_ROOT,'dsh-host/user-config.mjs')))
  const value={schemaVersion:1,organizations:[{id:'ecnu'}],remoteAccess:{relay:'https://relay.example.edu/eduwork-remote/',oidcProfileId:'ecnu'}}
  assert.deepEqual(parseUserConfig('synthetic.json',JSON.stringify(value)).remoteAccess,value.remoteAccess)
  value.remoteAccess.oidcProfileId='missing'
  assert.throws(()=>parseUserConfig('synthetic.json',JSON.stringify(value)),/organizations/)
})
