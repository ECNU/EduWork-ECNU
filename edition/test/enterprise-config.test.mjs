import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile,writeFile,mkdir,mkdtemp,rm } from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import { resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

// The institution checkout supplies its data; the pinned public core supplies
// the implementation. Missing inputs must fail instead of skipping assertions.
const core = process.env.EDUWORK_CORE_ROOT
if (!core) throw new Error('Set EDUWORK_CORE_ROOT to the checkout pinned by core.lock.json')
const { loadUserConfig, parseUserConfig } = await import(pathToFileURL(resolve(core, 'dsh-host/user-config.mjs')))
const { updateEnterpriseModels } = await import(pathToFileURL(resolve(core, 'dsh-host/enterprise-model-updates.mjs')))
const example = name => loadUserConfig(fileURLToPath(new URL(`../desktop-examples/${name}.jsonc`, import.meta.url)))

test('school release enables OAuth heartbeat on its profile origin without a hard-coded version or credentials', async () => {
  const distribution = JSON.parse(await readFile(new URL('../distribution.json', import.meta.url), 'utf8'))
  const plugin = distribution.plugins.find(row => row.id === 'chatecnu-active-heartbeat')
  const { config } = plugin
  assert.equal(config.enabled, true)
  assert.equal(config.backend, 'web')
  const school = example('ecnu').organizations.find(profile => profile.id === config.profileID)
  assert.ok(school)
  assert.equal(new URL(config.baseURL).origin, new URL(school.auth.expectedIssuer).origin)
  assert.equal(config.endpoint, '/user/active')
  assert.equal(config.version, undefined)
  assert.equal(config.installationID, undefined)
  assert.deepEqual(Object.keys(config).sort(), ['backend', 'baseURL', 'enabled', 'endpoint', 'productName', 'profileID'])
})


test('CI edition carries only public bootstrap metadata and pins configuration trust', async () => {
  const path = fileURLToPath(new URL('../desktop/publisher-bootstrap.json', import.meta.url))
  const raw = JSON.parse(await readFile(path, 'utf8'))
  assert.deepEqual(Object.keys(raw).sort(), ['contentUpdates', 'migrateFrom', 'schemaVersion', 'updates'])
  const { migrateFrom, ...descriptor } = raw
  assert.deepEqual(migrateFrom, ['https://ecnunic-data-cdn.oss-cn-shanghai.aliyuncs.com/chatecnu-work/content-updates'])
  const config = parseUserConfig(path, JSON.stringify(descriptor))
  assert.equal(config.contentUpdates.publisher, 'eduwork-ecnu')
  assert.equal(config.contentUpdates.configuration, true)
  assert.equal(config.contentUpdates.bundled.configuration, 0)
  assert.equal(config.updates.defaultPolicy, undefined)
  assert.equal(config.updates.provider, 'static')
  assert.match(config.contentUpdates.publicKey, /^-----BEGIN PUBLIC KEY-----/)
  const seed = loadUserConfig(fileURLToPath(new URL('../desktop/eduwork.jsonc', import.meta.url)))
  assert.deepEqual(seed.organizations, [])
  const distribution = JSON.parse(await readFile(new URL('../distribution.json', import.meta.url), 'utf8'))
  assert.ok(distribution.resources.some(row => row.source === 'edition/desktop/publisher-bootstrap.json' && row.target === 'desktop/publisher-bootstrap.json'))
  const mac = loadUserConfig(fileURLToPath(new URL('../desktop/publisher-bootstrap.darwin.json', import.meta.url)))
  assert.notEqual(mac.contentUpdates.baseURL, config.contentUpdates.baseURL)
  assert.equal(mac.contentUpdates.publicKey, config.contentUpdates.publicKey)
  assert.deepEqual(mac.updates, {}) // Sparkle owns Mac application updates; do not disable it.
  assert.ok(distribution.resources.some(row => row.target === 'desktop/publisher-bootstrap.darwin.json'))
})

test('ECNU media uses public providers and keeps existing IDs, voices and sizes', async () => {
  const { normalizeMediaConfig } = await import(pathToFileURL(resolve(core, 'dsh-host/media-config.mjs')))
  const defaults = JSON.parse(await readFile(new URL('../desktop/media-defaults.json', import.meta.url), 'utf8'))
  assert.deepEqual(example('ecnu').media, normalizeMediaConfig(defaults))
  const [provider] = example('ecnu').media.providers
  assert.equal(provider.id, 'ecnu')
  assert.equal(provider.credentialRef, 'EDUWORK_API_KEY')
  assert.equal(provider.oidcProfileId, 'ecnu')
  assert.equal(provider.images.model, 'ecnu-image')
  assert.equal(provider.speech.model, 'ecnu-tts')
  assert.equal(provider.speech.voices.length, 16)
  assert.deepEqual(provider.images.nativeSizes, ['512x512', '768x768', '720x1280', '1280x720', '1024x1024'])
  const distribution = JSON.parse(await readFile(new URL('../distribution.json', import.meta.url), 'utf8'))
  assert.equal(distribution.plugins.some(p => /(?:studio-media|tool-ecnu-media)/u.test(p.source)), false)
  assert.equal(distribution.skills.some(s => s.name === 'artifact-images'), false)
})

test('deployment examples keep service provider IDs separate from local profile IDs', () => {
  for (const id of ['ecnu', 'cernet']) {
    const profile = example(id).organizations[0]
    assert.equal(profile.id, id)
    assert.equal(profile.provider.id, 'chatecnu')
    assert.equal(profile.keyBinding, undefined)
    assert.equal(profile.auth.identityMode, 'oidc')
    assert.equal(profile.provider.baseURL, undefined)
  }
})

test('ECNU max is text-only with vision fallback enabled and unchanged context policy', () => {
  const model = example('ecnu').organizations[0].provider.models.find(row => row.id === 'ecnu-max')
  assert.deepEqual(model.input, ['text'])
  assert.equal(example('ecnu').features.visionFallback, true)
  assert.deepEqual(example('ecnu').organizations[0].provider.models.find(row => row.id === 'ecnu-plus').input, ['text', 'image'])
  assert.equal(model.contextWindow, 524288)
  assert.equal(model.maxTokens, 393216)
  assert.deepEqual(Object.keys(model.reasoningEfforts).sort(), ['high', 'low', 'max'])
})

test('edition catalog upgrades known 1M/256K defaults and preserves custom limits', async () => {
  const rules = JSON.parse(await readFile(new URL('../desktop/ecnu-model-updates.json', import.meta.url), 'utf8'))
  const { match } = rules.updates[0]
  for (const capacity of [1000000, 262144, 524288, 131072]) for (const input of [['text'], ['text', 'image']]) {
    const original = { id: match.profileID, oidc: { issuer: match.issuer }, provider: {
      id: match.providerID, adapter: match.adapter, baseURL: match.baseURL, modelSource: 'profile',
      models: [{ id: match.modelID, input, contextWindow: capacity, maxTokens: 393216 }],
    } }
    const [updated] = updateEnterpriseModels([original], rules)
    assert.equal(updated.provider.models[0].contextWindow, capacity === 131072 ? 131072 : 524288)
    assert.equal(updated.provider.models[0].maxTokens, 393216)
    assert.deepEqual(updated.provider.models[0].input, ['text'])
    assert.deepEqual(original.provider.models[0].input, input)
    assert.deepEqual(updateEnterpriseModels([updated], rules), [updated])
    const unrelated = structuredClone(original)
    unrelated.provider.id = 'personal'
    assert.deepEqual(updateEnterpriseModels([unrelated], rules), [unrelated])
    assert.equal(original.provider.models[0].contextWindow, capacity)
  }
})

test('publisher migrates to one editable school config with one backup and preserves personal settings',async t=>{
 const root=await mkdtemp(join(tmpdir(),'ecnu-config-upgrade-'))
 t.after(()=>rm(root,{recursive:true,force:true}))
 const {desktopConfigurationPath}=await import(pathToFileURL(resolve(core,'dsh-electron/src/configuration-policy.mjs')))
 const {loadEnterpriseProfiles,enterpriseProviderConfig}=await import(pathToFileURL(resolve(core,'packages/dsh-oidc/src/host/profile.js')))
 const {resolveEnterpriseProfiles}=await import(pathToFileURL(resolve(core,'packages/dsh-oidc/src/host/provider/core.js')))
 await mkdir(join(root,'config'));await mkdir(join(root,'data'))
 const old=join(root,'config/eduwork.jsonc'),personal=join(root,'data/settings.json')
 await writeFile(old,'{"schemaVersion":1,"product":{"name":"Old"},"organizations":[]}')
 await writeFile(personal,'{"personalProvider":"untouched","theme":"blue"}')
 const version='0.3.6-dev.20260914.3'
 const active=desktopConfigurationPath({root,version,ownership:'publisher'})
 assert.equal(active,old)
 const legacy=join(root,'config/eduwork.'+version+'.jsonc')
 const source=await readFile(new URL('../desktop-examples/ecnu.jsonc',import.meta.url),'utf8')
 await writeFile(legacy,source)
 const product=join(root,'product')
 await mkdir(join(product,'resources/desktop'),{recursive:true})
 await writeFile(join(product,'resources/desktop/eduwork.jsonc'),'{"schemaVersion":1,"organizations":[]}')
 const {publisherBootstrap}=await import(pathToFileURL(resolve(core,'dsh-host/publisher-bootstrap.mjs')))
 const bootstrap=await publisherBootstrap({ownership:'publisher',product,distribution:'synthetic-school',version,configPath:active,dataRoot:join(root,'data')})
 const config=loadUserConfig(active)
 const profiles=loadEnterpriseProfiles({profiles:config.organizations},{})
 const model=config.organizations[0].provider.models.find(model=>model.id==='ecnu-max')
 assert.equal(profiles.get('ecnu').auth.experimentalOidcLlm,true)
 assert.deepEqual(model.input,['text'])
 assert.equal(model.contextWindow,524288)
 assert.equal(model.maxTokens,393216)
 assert.equal(config.media.providers[0].images.model,'ecnu-image')
 assert.equal(config.media.providers[0].speech.model,'ecnu-tts')
 assert.equal(await readFile(bootstrap.file.backup,'utf8'),'{"schemaVersion":1,"product":{"name":"Old"},"organizations":[]}')
 await bootstrap.file.cleanupLegacy()
 await assert.rejects(readFile(legacy),{code:'ENOENT'})
 assert.equal(await readFile(personal,'utf8'),'{"personalProvider":"untouched","theme":"blue"}')
 const policy=JSON.parse(await readFile(new URL('../desktop/configuration-policy.json',import.meta.url)))
 assert.equal(policy.ownership,'publisher')
})


test('school plugin endpoints are editable in the same file and skill authorization follows its account', async () => {
  const configured=example('ecnu').pluginConfig
  assert.equal(configured['chatecnu-campus-search'].baseURL,configured['chatecnu-vision'].baseURL)
  assert.equal(new URL(configured['chatecnu-active-heartbeat'].baseURL).origin,new URL(configured['chatecnu-vision'].baseURL).origin)
  const distribution=JSON.parse(await readFile(new URL('../distribution.json',import.meta.url),'utf8'))
  const skill=distribution.skills.find(skill=>skill.name==='ecnu-campus-search')
  assert.equal(skill.metadata.eduwork.oidcProfileId,'ecnu')
  assert.equal(skill.metadata.eduwork.runtimeBaseURL,undefined)
})
