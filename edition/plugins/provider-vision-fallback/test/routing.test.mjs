import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'

test('mounted fallback is inactive for native images, active for text, and removable without changing native input', {skip:!process.env.EDUWORK_TEST_RUNTIME}, async () => {
 const req=createRequire(join(process.env.EDUWORK_TEST_RUNTIME,'package.json'))
 const hook=registerHooks({resolve(name,ctx,next){return next(name,name.startsWith('@deepseek-ai/')?{...ctx,parentURL:pathToFileURL(join(process.env.EDUWORK_TEST_RUNTIME,'package.json')).href}:ctx)}})
 const home=await mkdtemp(join(tmpdir(),'vision-routing-'))
 let dispose, registration, analyses=0
 try {
  const {apply}=await import('../lib/index.js')
  const ctx={enterpriseTransforms:{register:entry=>{registration=entry;return()=>{registration=null}}},effect:fn=>{dispose=fn()},credentials:{resolve:async()=>{throw Error('no credential calls expected')}},attachments:{readImage:async()=>{analyses++;throw Error('no image reads expected')}}}
  const env=process.env.EDUWORK_VISION_FALLBACK;delete process.env.EDUWORK_VISION_FALLBACK
  try {
   apply(ctx,{enabled:true,dshHome:home})
   assert.equal(registration.when({inputModalities:['text','image']}),false)
   assert.equal(registration.when({inputModalities:['text']}),true)
   // A text-only request still needs no vision analysis.
   const original={messages:[{role:'user',content:[{type:'text',text:'hello'}]}]}
   assert.deepEqual(await registration.transform(original),original)
   assert.equal(analyses,0)
   dispose();assert.equal(registration,null)
   apply(ctx,{enabled:false,dshHome:home});assert.equal(registration,null)
   process.env.EDUWORK_VISION_FALLBACK='false'
   apply(ctx,{enabled:true,dshHome:home});assert.equal(registration,null)
  } finally {if(env===undefined)delete process.env.EDUWORK_VISION_FALLBACK;else process.env.EDUWORK_VISION_FALLBACK=env}
 } finally {hook.deregister();await rm(home,{recursive:true,force:true})}
})
