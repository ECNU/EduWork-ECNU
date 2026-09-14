import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

// The institution checkout supplies its data; the pinned public core supplies
// the implementation. Missing inputs must fail instead of skipping assertions.
const core = process.env.EDUWORK_CORE_ROOT
if (!core) throw new Error('Set EDUWORK_CORE_ROOT to the checkout pinned by core.lock.json')
const { loadUserConfig } = await import(pathToFileURL(resolve(core, 'dsh-host/user-config.mjs')))
const { updateEnterpriseModels } = await import(pathToFileURL(resolve(core, 'dsh-host/enterprise-model-updates.mjs')))
const example = name => loadUserConfig(fileURLToPath(new URL(`../desktop-examples/${name}.jsonc`, import.meta.url)))

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
    assert.equal(profile.keyBinding.credentialRef, 'EDUWORK_API_KEY')
  }
})

test('ECNU example declares the native image model and current context policy', () => {
  const model = example('ecnu').organizations[0].provider.models.find(row => row.id === 'ecnu-max')
  assert.deepEqual(model.input, ['text', 'image'])
  assert.equal(model.contextWindow, 524288)
  assert.equal(model.maxTokens, 393216)
  assert.deepEqual(Object.keys(model.reasoningEfforts).sort(), ['high', 'low', 'max'])
})

test('edition catalog upgrades known 1M/256K defaults and preserves custom limits', async () => {
  const rules = JSON.parse(await readFile(new URL('../desktop/ecnu-model-updates.json', import.meta.url), 'utf8'))
  const { match } = rules.updates[0]
  for (const capacity of [1000000, 262144, 524288, 131072]) {
    const original = { id: match.profileID, oidc: { issuer: match.issuer }, provider: {
      id: match.providerID, adapter: match.adapter, baseURL: match.baseURL, modelSource: 'profile',
      models: [{ id: match.modelID, input: ['text'], contextWindow: capacity, maxTokens: 393216 }],
    } }
    const [updated] = updateEnterpriseModels([original], rules)
    assert.equal(updated.provider.models[0].contextWindow, capacity === 131072 ? 131072 : 524288)
    assert.equal(updated.provider.models[0].maxTokens, 393216)
    assert.deepEqual(updated.provider.models[0].input, ['text', 'image'])
    assert.equal(original.provider.models[0].contextWindow, capacity)
  }
})
