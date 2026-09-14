import assert from 'node:assert/strict'
import test from 'node:test'
import {
  VisionEvidenceCache, boundVisionAnalysis, rewriteProviderMessages, understandImage,
  resolveVisionConfig,
} from '../lib/vision.js'

test('vision fallback is optional and uses the shared credential name', () => {
  assert.equal(resolveVisionConfig({},{}).enabled,true)
  assert.equal(resolveVisionConfig({},{}).credentialRef,'EDUWORK_API_KEY')
  assert.equal(resolveVisionConfig({enabled:false},{}).enabled,false)
  assert.equal(resolveVisionConfig({enabled:true},{EDUWORK_VISION_FALLBACK:'false'}).enabled,false)
  assert.throws(()=>resolveVisionConfig({enabled:'false'},{}),/boolean/)
})

function imageBlock(id, name = `${id}.png`) {
  return { type: 'image', attachment: { attachmentId: id, name, mediaType: 'image/png' } }
}

function fallbackOptions(calls, starts = []) {
  return {
    cache: new VisionEvidenceCache(),
    specialistModel: 'ecnu-plus',
    onAnalyzeStart: async ref => { starts.push(ref.attachmentId) },
    readImage: async ref => {
      calls.push(ref.attachmentId)
      return { data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) }
    },
    analyze: async () => '页面显示一张测试截图。',
  }
}

test('rewrites a direct image only at the provider message boundary', async () => {
  const calls = []
  const original = [{ role: 'user', content: [{ type: 'text', text: '看看' }, imageBlock('direct')] }]
  const result = await rewriteProviderMessages(original, fallbackOptions(calls))

  assert.deepEqual(calls, ['direct'])
  assert.equal(result[0].content[0], original[0].content[0])
  assert.equal(result[0].content[1].type, 'text')
  assert.match(result[0].content[1].text, /untrusted_visual_evidence/)
  assert.equal(original[0].content[1].type, 'image', 'durable input must remain unchanged')
})

test('rewrites the canonical image inside a DSH rich tool result', async () => {
  const calls = []
  const original = [{ role: 'user', content: [{
    type: 'tool-result', toolCallId: 'read-1', toolName: 'read_image', isError: false,
    content: [{ type: 'text', text: '<type>image</type>' }, imageBlock('tool-image')],
  }] }]
  const result = await rewriteProviderMessages(original, fallbackOptions(calls))

  assert.deepEqual(calls, ['tool-image'])
  assert.equal(result[0].content[0].type, 'tool-result')
  assert.equal(result[0].content[0].content[1].type, 'text')
  assert.match(result[0].content[0].content[1].text, /页面显示一张测试截图/)
})

test('does not inspect arbitrary object paths outside the DSH content contract', async () => {
  const calls = []
  const original = [{ role: 'user', content: [{ type: 'metadata', payload: imageBlock('hidden') }] }]
  const result = await rewriteProviderMessages(original, fallbackOptions(calls))

  assert.deepEqual(calls, [])
  assert.equal(result[0], original[0])
})

test('deduplicates one attachment across provider-bound history', async () => {
  const calls = []
  const starts = []
  const shared = imageBlock('same')
  const original = [
    { role: 'user', content: [shared] },
    { role: 'user', content: [{ type: 'tool-result', content: [shared] }] },
  ]
  await rewriteProviderMessages(original, fallbackOptions(calls, starts))
  assert.deepEqual(calls, ['same'])
  assert.deepEqual(starts, ['same'], 'the analysis hook fires once per cache miss')
})

test('does not start image analysis again for an in-memory cache hit', async () => {
  const calls = []
  const starts = []
  const options = fallbackOptions(calls, starts)
  const original = [{ role: 'user', content: [imageBlock('cached')] }]
  await rewriteProviderMessages(original, options)
  await rewriteProviderMessages(original, options)
  assert.deepEqual(calls, ['cached'])
  assert.deepEqual(starts, ['cached'])
})

test('reuses persisted evidence after the in-memory cache is replaced', async () => {
  const persisted = new Map()
  const evidenceStore = {
    read: async key => persisted.get(key),
    write: async (key, analysis) => { persisted.set(key, analysis) },
  }
  const calls = []
  const starts = []
  const original = [{ role: 'user', content: [imageBlock('durable')] }]
  await rewriteProviderMessages(original, { ...fallbackOptions(calls, starts), evidenceStore })
  await rewriteProviderMessages(original, { ...fallbackOptions(calls, starts), evidenceStore })

  assert.deepEqual(calls, ['durable'])
  assert.deepEqual(starts, ['durable'])
  assert.equal(persisted.size, 1)
})

test('keeps newer evidence when the accumulated text budget is exceeded', async () => {
  const calls = []
  const original = [
    { role: 'user', content: [imageBlock('old')] },
    { role: 'user', content: [imageBlock('new')] },
  ]
  const result = await rewriteProviderMessages(original, {
    ...fallbackOptions(calls),
    maxRequestEvidenceChars: 400,
  })

  assert.deepEqual(calls.sort(), ['new', 'old'])
  assert.match(result[0].content[0].text, /Earlier image.*omitted/)
  assert.match(result[1].content[0].text, /untrusted_visual_evidence/)
})

test('bounds one specialist observation before it enters persistent history', () => {
  const bounded = boundVisionAnalysis('x'.repeat(100), 80)
  assert.equal(bounded.length, 80)
  assert.match(bounded, /truncated/)
})

test('asks the specialist for a bounded non-streaming response', async () => {
  let request
  await understandImage({
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body)
      return new Response(JSON.stringify({ choices: [{ message: { content: '观察结果' } }] }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    },
    baseURL: 'https://ai.example/v1', apiKey: 'test', model: 'vision', prompt: 'observe',
    imageBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    maxAnalysisTokens: 1234,
  })
  assert.equal(request.stream, false)
  assert.equal(request.max_tokens, 1234)
})
