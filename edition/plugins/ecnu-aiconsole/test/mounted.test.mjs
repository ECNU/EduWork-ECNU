import test from 'node:test'
import assert from 'node:assert/strict'

test('DSH RC.3 registry and real OIDC host: only read tools, safe transport, logout and disposal', { skip: !process.env.EDUWORK_TEST_RUNTIME }, async t => {
  const { Context, Service } = await import('@deepseek-ai/cordis')
  const { ToolsService } = await import('@deepseek-ai/dsh-tools')
  const { default: LlmRuntime } = await import('@deepseek-ai/dsh-llm')
  const { default: Oidc } = await import('@eduwork/dsh-oidc')
  const { default: Aiconsole } = await import('../lib/index.js')
  const { fixture } = await import('../../ecnu-account-resources/test/helpers/oidc-http-fixture.mjs')
  let permissionDenied = false, redirect = false
  const f = await fixture(t, { resources: true, resourceHandler(req, res, url) {
    if (!url.pathname.startsWith('/v1/account/')) return false
    assert.equal(req.method, 'GET')
    assert.equal(req.headers.authorization, 'Bearer <ACCESS_TOKEN>')
    if (redirect) { res.writeHead(302, { location: '/must-not-follow' }); res.end(); return true }
    const operation = url.pathname.endsWith('/usage') ? 'account_get_usage' : 'account_get_profile'
    res.writeHead(permissionDenied ? 403 : 200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(permissionDenied ? { error: { message: 'private diagnostic' } } : { object: 'account_result', operation, data: { name: 'Example', items: [], total: 0 } }))
    return true
  } })
  const records = new Map(), opened = []
  class Credentials extends Service {
    constructor(ctx) { super(ctx, 'credentials') }
    async resolve(ref) { return records.has(ref) ? { value: records.get(ref) } : undefined }
    async set(ref, value) { records.set(ref, value); this.ctx.emit('credentials/reference-updated', { ref }) }
    async unset(ref) { records.delete(ref); this.ctx.emit('credentials/reference-updated', { ref }) }
  }
  class DesktopServices extends Service {
    constructor(ctx) { super(ctx, 'desktopServices') }
    async openExternal(url) { opened.push(url) }
  }
  class SystemPrompt extends Service {
    constructor(ctx) { super(ctx, 'systemPrompt') }
    tools() { return () => {} }
  }
  const ctx = new Context(), fibers = []
  t.after(async () => { for (const fiber of fibers.reverse()) await fiber.dispose() })
  for (const plugin of [LlmRuntime, Credentials, DesktopServices, SystemPrompt, ToolsService]) fibers.push(await ctx.plugin(plugin))
  fibers.push(await ctx.plugin(Oidc, { backend: 'desktop', profile: f.rawProfile }))
  const plugin = await ctx.plugin(Aiconsole, { oidcProfileId: 'desktop-test', baseURL: `${f.origin}/v1`, allowInsecureDevelopment: true })
  fibers.push(plugin)
  const names = ctx.tools.definitions().map(tool => tool.name)
  assert.equal(names.length, 12)
  for (const name of ['ecnu_account_stop_request', 'ecnu_account_get_invitation', 'ecnu_account_create_key']) assert.equal(ctx.tools.get(name), undefined)
  await assert.rejects(ctx.ecnuAiconsole.read('account_get_profile'), { code: 'sign_in_required' })
  await ctx.oidcAccounts.begin('desktop-test')
  assert.equal((await fetch(opened.at(-1))).status, 200)
  assert.equal((await ctx.oidcAccounts.status('desktop-test')).credentialReady, true)
  const tool = ctx.tools.get('ecnu_account_get_usage')
  const args = { page: 2, page_size: 5, credential_id: 'oauth' }
  const result = await tool.execute(args, { signal: new AbortController().signal })
  assert.equal(result.coverage, 'page')
  assert.deepEqual(JSON.parse(result.parametersJSON), args)
  assert.equal(JSON.parse(result.dataJSON).total, 0)
  assert.match(tool.output.render(args, result)[0].text, /https:\/\/aiconsole.ecnu.edu.cn/)
  const before = f.requests.length
  await assert.rejects(tool.execute({ method: 'POST' }, { signal: new AbortController().signal }), { code: 'invalid_arguments' })
  await assert.rejects(ctx.ecnuAiconsole.read('account_get_invitation', { confirmed: true }), { code: 'operation_not_allowed' })
  assert.equal(f.requests.length, before)
  permissionDenied = true
  await assert.rejects(ctx.ecnuAiconsole.read('account_get_profile'), { code: 'permission_denied' })
  permissionDenied = false
  redirect = true
  await assert.rejects(ctx.ecnuAiconsole.read('account_get_profile'), { code: 'unavailable' })
  assert.equal(f.requests.some(request => request.path === '/must-not-follow'), false)
  redirect = false
  await ctx.oidcAccounts.logout('desktop-test')
  await assert.rejects(ctx.ecnuAiconsole.read('account_get_profile'), { code: 'sign_in_required' })
  await plugin.dispose()
  assert.equal(ctx.tools.definitions().length, 0)
})
