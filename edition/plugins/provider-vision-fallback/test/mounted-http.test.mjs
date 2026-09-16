import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire, registerHooks } from 'node:module'
import { pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'
import { once } from 'node:events'

// Use an assembled, published Runtime for the real provider transform boundary.
// Only the credential store, attachment store and remote model service are fakes.
test('text-only max uses specialist HTTP through the mounted adapter; native plus bypasses it', {
  skip: !process.env.EDUWORK_TEST_RUNTIME,
}, async () => {
  const runtime = join(process.env.EDUWORK_TEST_RUNTIME, 'package.json')
  const require = createRequire(runtime)
  const hook = registerHooks({ resolve(name, context, next) {
    return next(name, /^(?:@deepseek-ai|@eduwork)\//u.test(name)
      ? { ...context, parentURL: pathToFileURL(runtime).href } : context)
  } })
  const home = await mkdtemp(join(tmpdir(), 'vision-mounted-'))
  const previousOverride = process.env.EDUWORK_VISION_FALLBACK
  delete process.env.EDUWORK_VISION_FALLBACK
  let context, dispose
  const httpCalls = []
  const server = createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    httpCalls.push({ path: request.url, authorization: request.headers.authorization, body: JSON.parse(body) })
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ choices: [{ message: { content: '测试图片是一个像素。' } }] }))
  })
  try {
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const baseURL = `http://127.0.0.1:${server.address().port}/v1`
    const { Context } = await import('@deepseek-ai/cordis')
    const { EnterpriseModelTransforms } = await import('@eduwork/dsh-oidc/transforms')
    const { TransformingEnterpriseAdapter } = await import(pathToFileURL(join(
      dirname(require.resolve('@eduwork/dsh-oidc/transforms')), 'transform-adapter.js')))
    const { apply } = await import('../lib/index.js')
    context = new Context()
    await context.plugin(EnterpriseModelTransforms)
    const transforms = context.enterpriseTransforms
    const credentials = []
    const source = { provider: 'chatecnu', model: 'ecnu-max', messages: [{ role: 'user', content: [
      { type: 'text', text: '描述图片' },
      { type: 'image', attachment: { attachmentId: 'synthetic-pixel', name: 'pixel.png', mediaType: 'image/png' } },
    ] }] }
    const original = structuredClone(source)
    const pluginContext = {
      enterpriseTransforms: transforms,
      effect: fn => { dispose = fn() },
      credentials: { resolve: async () => { throw Error('must use the selected OIDC profile') } },
      get: name => name === 'oidcAccounts' ? { resolveBoundCredential: async (id, options) => {
        credentials.push({ id, ...options }); return { value: 'synthetic-test-key' }
      } } : undefined,
      attachments: { readImage: async ref => {
        assert.equal(ref.attachmentId, 'synthetic-pixel')
        return { data: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nO8AAAAASUVORK5CYII=', 'base64') }
      } },
    }
    apply(pluginContext, { provider: 'chatecnu', oidcProfileId: 'ecnu', baseURL, dshHome: home, enabled: true })
    const forwarded = []
    const inner = {
      resolveModel: async (_provider, id) => ({ id, inputModalities: id === 'ecnu-max' ? ['text'] : ['text', 'image'] }),
      stream: async function* (options) { forwarded.push(options); yield { type: 'done' } },
    }
    const adapter = new TransformingEnterpriseAdapter(inner, transforms)
    assert.deepEqual((await adapter.resolveModel('chatecnu', 'ecnu-max')).inputModalities, ['text', 'image'])
    for await (const _event of adapter.stream(source)) { /* drive the real transform */ }
    assert.equal(httpCalls.length, 1)
    assert.equal(httpCalls[0].path, '/v1/chat/completions')
    assert.equal(httpCalls[0].authorization, 'Bearer synthetic-test-key')
    assert.equal(httpCalls[0].body.model, 'ecnu-plus')
    assert.equal(httpCalls[0].body.stream, false)
    assert.match(httpCalls[0].body.messages[0].content[1].image_url.url, /^data:image\/png;base64,/u)
    assert.deepEqual(credentials, [{ id: 'ecnu', credentialRef: 'EDUWORK_API_KEY', runtimeBaseURL: baseURL }])
    assert.equal(forwarded[0].messages[0].content[1].type, 'text')
    assert.match(forwarded[0].messages[0].content[1].text, /untrusted_visual_evidence[\s\S]*测试图片是一个像素/u)
    assert.deepEqual(source, original, 'original image history stays unchanged')
    for await (const _event of adapter.stream(source)) { /* repeat with cached evidence */ }
    assert.equal(httpCalls.length, 1)
    const native = { ...source, model: 'ecnu-plus' }
    for await (const _event of adapter.stream(native)) { /* native route bypasses the specialist */ }
    assert.equal(httpCalls.length, 1)
    assert.deepEqual(forwarded.at(-1), native)
    dispose(); dispose = undefined
    apply(pluginContext, { enabled: false, dshHome: home })
    assert.deepEqual((await adapter.resolveModel('chatecnu', 'ecnu-max')).inputModalities, ['text'])
    assert.deepEqual((await adapter.resolveModel('chatecnu', 'ecnu-plus')).inputModalities, ['text', 'image'])
  } finally {
    dispose?.()
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
    hook.deregister()
    if (previousOverride === undefined) delete process.env.EDUWORK_VISION_FALLBACK
    else process.env.EDUWORK_VISION_FALLBACK = previousOverride
    await rm(home, { recursive: true, force: true })
  }
})
