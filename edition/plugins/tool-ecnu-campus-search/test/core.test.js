import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeCampusSearchRequest,
  resolveCampusSearchConfig,
  searchCampus,
} from '../lib/core.js'

test('campus search config shares the runtime API base and credential defaults', () => {
  const config = resolveCampusSearchConfig({
    baseURLEnv: 'CHATECNU_WORK_RUNTIME_API_BASE',
    baseURL: 'https://fallback.example/open/api/v1/',
  }, { CHATECNU_WORK_RUNTIME_API_BASE: 'https://runtime.example/open/api/v1/' })
  assert.equal(config.baseURL, 'https://runtime.example/open/api/v1')
  assert.equal(config.credentialRef, 'CHATECNU_API_KEY')
  assert.equal(config.requestTimeoutMs, 65_000)
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
