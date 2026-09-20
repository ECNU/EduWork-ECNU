import test from 'node:test'
import assert from 'node:assert/strict'

test('mounted campus tool delegates Token transport and fails closed after logout', {skip:!process.env.EDUWORK_TEST_RUNTIME}, async()=>{
  const {apply}=await import('../lib/index.js')
  let tool,ready=true,calls=0
  const baseURL='https://campus.example.org/v1'
  const account={
    async modelAuthorization(id,base){assert.equal(id,'school');assert.equal(base,baseURL);return ready},
    async authorizedFetch(id,url,init){
      calls++;assert.equal(id,'school');assert.equal(url,baseURL+'/search')
      assert.equal(init.headers.Authorization,undefined,'The extension does not read or copy the token')
      assert.equal(JSON.parse(init.body).keyword,'图书馆')
      return Response.json({id:'test',query:'图书馆',results:[]})
    },
  }
  apply({tools:{register(value){tool=value}},credentials:{resolve(){throw Error('OIDC cannot fall back to a personal API key')}},get:name=>name==='oidcAccounts'?account:undefined},{oidcProfileId:'school',baseURL})
  const exec={signal:new AbortController().signal}
  assert.equal((await tool.execute({keyword:'图书馆'},exec)).resultCount,0)
  ready=false
  await assert.rejects(tool.execute({keyword:'图书馆'},exec),/Sign in/)
  assert.equal(calls,1)
})
