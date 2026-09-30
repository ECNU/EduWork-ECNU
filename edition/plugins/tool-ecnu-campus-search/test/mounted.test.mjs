import test from 'node:test'
import assert from 'node:assert/strict'

const register = (config, account) => import('../lib/index.js').then(({ apply }) => {
  const tools = new Map()
  apply({
    tools: { register(value) { tools.set(value.name, value) } },
    credentials: { resolve() { throw Error('OIDC cannot fall back to a personal API key') } },
    get: name => name === 'oidcAccounts' ? account : undefined,
  }, config)
  return tools
})

test('mounted worker tools delegate scoped Token transport and fail closed after logout', { skip: !process.env.EDUWORK_TEST_RUNTIME }, async () => {
  let ready = true
  const calls = []
  const baseURL = 'https://campus.example.org/open/api/v1'
  const account = {
    async modelAuthorization(id, base) { assert.equal(id, 'school'); assert.equal(base, baseURL); return ready },
    async authorizedFetch(id, url, init, authorization) {
      assert.equal(id, 'school')
      assert.equal(init.headers.Authorization, undefined, 'The extension does not read or copy the token')
      assert.equal(authorization.retryUnauthorized, true)
      assert.equal(url, 'https://campus.example.org' + authorization.issuerServicePath)
      calls.push(authorization.issuerServicePath)
      return Response.json({ type: 'x', tool: 'x', data: { query: JSON.parse(init.body).query } })
    },
  }
  const tools = await register({ oidcProfileId: 'school', baseURL }, account)
  assert.deepEqual([...tools.keys()].sort(), ['ecnu_campus_search', 'ecnu_web_search'])
  const exec = { signal: new AbortController().signal }
  assert.equal((await tools.get('ecnu_campus_search').execute({ query: '图书馆' }, exec)).dataJSON, '{"query":"图书馆"}')
  assert.equal((await tools.get('ecnu_web_search').execute({ query: 'ECNU' }, exec)).trust, 'untrusted-web-search-content')
  assert.deepEqual(calls, ['/api/worker/v1/search/campus', '/api/worker/v1/search/web'])
  ready = false
  await assert.rejects(tools.get('ecnu_campus_search').execute({ query: '图书馆' }, exec), /Sign in/)
  assert.equal(calls.length, 2)
  const campusOnly = await register({ oidcProfileId: 'school', baseURL, webSearch: false }, account)
  assert.deepEqual([...campusOnly.keys()], ['ecnu_campus_search'])
})

test('API key mode keeps the open platform campus route without web search', { skip: !process.env.EDUWORK_TEST_RUNTIME }, async () => {
  const tools = await register({ baseURL: 'https://campus.example.org/open/api/v1' }, undefined)
  assert.deepEqual([...tools.keys()], ['ecnu_campus_search'])
})
