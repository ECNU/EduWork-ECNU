import test from 'node:test'
import assert from 'node:assert/strict'

async function register(t, config, account) {
  const { Context } = await import('@deepseek-ai/cordis')
  const { WebRuntime } = await import('@deepseek-ai/dsh-web')
  const { apply } = await import('../lib/index.js')
  const root = new Context()
  const fiber = await root.plugin(WebRuntime, { searchProvider: 'ecnu-worker' })
  t.after(() => fiber.dispose())
  const tools = new Map()
  apply({ tools: { register(value) { tools.set(value.name, value) } },
    credentials: { resolve() { throw Error('OIDC cannot fall back to a personal API key') } },
    get: name => name === 'oidcAccounts' ? account : name === 'web' ? root.web : undefined,
    effect: factory => root.effect(factory),
  }, config)
  return { tools, web: root.web }
}

test('official web seam and campus tool delegate scoped transport and fail closed after logout', { skip: !process.env.EDUWORK_TEST_RUNTIME }, async t => {
  let ready = true
  const calls = [], baseURL = 'https://campus.example.org/open/api/v1'
  const account = {
    async modelAuthorization(id, base) { assert.equal(id, 'school'); assert.equal(base, baseURL); return ready },
    async authorizedFetch(id, url, init, authorization) {
      assert.equal(id, 'school')
      assert.equal(init.headers.Authorization, undefined)
      assert.equal(authorization.retryUnauthorized, true)
      assert.equal(url, 'https://campus.example.org' + authorization.issuerServicePath)
      calls.push(authorization.issuerServicePath)
      return Response.json({ data: { results: [{ title: JSON.parse(init.body).query, url: 'https://example.org/first' }, { url: 'https://example.org/second' }] } })
    },
  }
  const { tools, web } = await register(t, { oidcProfileId: 'school', baseURL }, account)
  assert.deepEqual([...tools.keys()], ['ecnu_campus_search'], 'No duplicate school web-search tool')
  const exec = { signal: new AbortController().signal }
  assert.match((await tools.get('ecnu_campus_search').execute({ query: '图书馆' }, exec)).dataJSON, /图书馆/)
  const result = await web.search({ query: 'ECNU', maxResults: 1 }, exec.signal)
  assert.equal(result.sources[0].title, 'ECNU')
  assert.equal(result.sources.length, 1)
  assert.equal(result.truncated, true)
  assert.deepEqual(calls, ['/api/worker/v1/search/campus', '/api/worker/v1/search/web'])
  ready = false
  await assert.rejects(web.search({ query: 'ECNU' }), /Sign in/)
  await assert.rejects(tools.get('ecnu_campus_search').execute({ query: '图书馆' }, exec), /Sign in/)
  assert.equal(calls.length, 2)
  const campusOnly = await register(t, { oidcProfileId: 'school', baseURL, webSearch: false }, account)
  await assert.rejects(campusOnly.web.search({ query: 'x' }), /not registered/)
})

test('API key mode keeps the open platform campus route without registering a web provider', { skip: !process.env.EDUWORK_TEST_RUNTIME }, async t => {
  const { tools, web } = await register(t, { baseURL: 'https://campus.example.org/open/api/v1' })
  assert.deepEqual([...tools.keys()], ['ecnu_campus_search'])
  await assert.rejects(web.search({ query: 'x' }), /not registered/)
})
