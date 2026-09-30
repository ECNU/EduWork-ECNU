import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeCampusSearchRequest,
  normalizeWorkerSearchRequest,
  resolveCampusSearchConfig,
  searchCampus,
  searchWorker,
  workerSearchURL,
} from '../lib/core.js'

test('campus search config shares the runtime API base and credential defaults', () => {
  const config = resolveCampusSearchConfig({
    baseURLEnv: 'CHATECNU_WORK_RUNTIME_API_BASE',
    baseURL: 'https://fallback.example/open/api/v1/',
  }, { CHATECNU_WORK_RUNTIME_API_BASE: 'https://runtime.example/open/api/v1/' })
  assert.equal(config.baseURL, 'https://runtime.example/open/api/v1')
  assert.equal(config.credentialRef, 'CHATECNU_API_KEY')
  assert.equal(config.requestTimeoutMs, 65_000)
  assert.equal(config.webSearch, true)
  assert.equal(resolveCampusSearchConfig({ webSearch: false }).webSearch, false)
  assert.throws(() => resolveCampusSearchConfig({ webSearch: 'no' }), /webSearch must be a boolean/)
})

test('worker search routes stay on the configured service origin', () => {
  assert.equal(workerSearchURL('https://school.example/open/api/v1', 'campus'), 'https://school.example/api/worker/v1/search/campus')
  assert.equal(workerSearchURL('http://uat.example.test/v1', 'web'), 'http://uat.example.test/api/worker/v1/search/web')
  assert.throws(() => workerSearchURL('https://school.example/v1', 'notebook'), /unknown worker search kind/)
  assert.deepEqual(normalizeWorkerSearchRequest({ query: '  图书馆开放时间 ', page: 2 }), { query: '图书馆开放时间' })
  assert.throws(() => normalizeWorkerSearchRequest({ query: ' ' }), /must not be empty/)
})

test('worker search sends only the query and returns bounded untrusted data', async () => {
  let observed
  const fetchImpl = async (url, init) => {
    observed = { url, init }
    return Response.json({ type: 'campus', tool: 'campus_search', data: { results: [{ title: '图书馆', url: 'https://lib.example' }] } })
  }
  const result = await searchWorker({ fetchImpl, baseURL: 'https://school.example/open/api/v1', kind: 'campus', request: { query: '图书馆' } })
  assert.equal(observed.url, 'https://school.example/api/worker/v1/search/campus')
  assert.equal(observed.init.method, 'POST')
  assert.equal(observed.init.redirect, 'manual')
  assert.equal(observed.init.headers.Authorization, undefined)
  assert.equal(observed.init.headers['X-User-Id'], undefined)
  assert.deepEqual(JSON.parse(observed.init.body), { query: '图书馆' })
  assert.deepEqual(result, { query: '图书馆', tool: 'campus_search', dataJSON: '{"results":[{"title":"图书馆","url":"https://lib.example"}]}', truncated: false })
  const large = await searchWorker({
    fetchImpl: async () => Response.json({ type: 'web', tool: 'web_search', data: 'x'.repeat(70_000) }),
    baseURL: 'https://school.example/v1', kind: 'web', request: { query: 'q' },
  })
  assert.equal(large.truncated, true)
  assert.equal(large.dataJSON.length, 60_000)
})

test('worker search maps status codes without echoing response bodies', async () => {
  const run = (status, kind = 'campus') => searchWorker({
    fetchImpl: async () => new Response(JSON.stringify({ detail: 'token=secret' }), { status }),
    baseURL: 'https://school.example/v1', kind, request: { query: 'q' },
  })
  await assert.rejects(run(403, 'web'), error => /search\.web/.test(error.message) && /sign in/.test(error.message) && !/secret/.test(error.message))
  await assert.rejects(run(403), /search\.campus/)
  await assert.rejects(run(400), /HTTP 400/)
  await assert.rejects(run(503), /not configured/)
  await assert.rejects(run(502), /upstream service failed/)
  await assert.rejects(searchWorker({
    fetchImpl: async () => { throw Object.assign(new Error('x'), { code: 'oidc_login_required' }) },
    baseURL: 'https://school.example/v1', kind: 'web', request: { query: 'q' },
  }), /Sign in/)
  await assert.rejects(searchWorker({
    fetchImpl: async () => Response.json({ type: 'web' }),
    baseURL: 'https://school.example/v1', kind: 'web', request: { query: 'q' },
  }), /did not contain data/)
})

test('campus search request applies API defaults and validates bounds', () => {
  assert.deepEqual(normalizeCampusSearchRequest({ keyword: '  图书馆  ' }), {
    keyword: '图书馆', page: 1, size: 10, cancel_segment: false,
  })
  assert.throws(() => normalizeCampusSearchRequest({ keyword: ' ' }), /must not be empty/)
  assert.throws(() => normalizeCampusSearchRequest({ keyword: '图书馆', size: 51 }), /between 1 and 50/)
  assert.throws(() => normalizeCampusSearchRequest({ keyword: '图书馆', cancel_segment: 'false' }), /must be a boolean/)
})

test('campus search sends only documented fields and normalizes response', async () => {
  let observed
  const fetchImpl = async (url, init) => {
    observed = { url, init }
    return new Response(JSON.stringify({
      id: 'campus-search-12', query: '图书馆', ignored: 'not forwarded',
      results: [
        { title: '图书馆', url: 'https://lib.ecnu.edu.cn', snippet: '校内应用', date: '2026-01-01', extra: true },
        { title: '服务', url: 'javascript:alert(1)', snippet: '入口' },
      ],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  const request = normalizeCampusSearchRequest({ keyword: '图书馆', page: 2, size: 10, cancel_segment: true, unknown: 'drop' })
  const result = await searchCampus({ fetchImpl, baseURL: 'https://api.example/open/api/v1', apiKey: 'secret', request })
  assert.equal(observed.url, 'https://api.example/open/api/v1/search')
  assert.equal(observed.init.method, 'POST')
  assert.equal(observed.init.redirect, 'manual')
  assert.equal(observed.init.headers.Authorization, 'Bearer secret')
  assert.deepEqual(JSON.parse(observed.init.body), { keyword: '图书馆', page: 2, size: 10, cancel_segment: true })
  assert.equal(result.results[0].date, '2026-01-01')
  assert.equal(result.results[1].url, '')
  assert.equal('extra' in result.results[0], false)
})

test('campus search exposes allowlisted upstream errors without leaking arbitrary bodies', async () => {
  await assert.rejects(
    searchCampus({
      fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'invalid_request', message: 'keyword is required' } }), { status: 400 }),
      baseURL: 'https://api.example/open/api/v1', apiKey: 'secret', request: normalizeCampusSearchRequest({ keyword: 'x' }),
    }),
    /HTTP 400 \(invalid_request\): keyword is required/,
  )
  await assert.rejects(
    searchCampus({
      fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'secret_backend', message: 'token=secret' } }), { status: 502 }),
      baseURL: 'https://api.example/open/api/v1', apiKey: 'secret', request: normalizeCampusSearchRequest({ keyword: 'x' }),
    }),
    error => error.message === 'the ECNU campus search service returned HTTP 502',
  )
})
