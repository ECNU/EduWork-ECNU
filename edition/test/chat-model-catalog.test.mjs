import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const core = process.env.EDUWORK_CORE_ROOT
if (!core) throw new Error('Set EDUWORK_CORE_ROOT to a core checkout with model type support')
const { loadUserConfig } = await import(pathToFileURL(resolve(core, 'dsh-host/user-config.mjs')))
const { normalizeEnterpriseProfile, enterpriseProviderConfig, publicProfile } = await import(pathToFileURL(resolve(core, 'packages/dsh-oidc/src/host/profile.js')))
const { normalizeResourceModels } = await import(pathToFileURL(resolve(core, 'packages/dsh-oidc/src/host/resources.js')))

for (const edition of ['ecnu', 'cernet']) test(edition + ' classifies its catalog and registers only authorized LLMs without changing media', () => {
  const config = loadUserConfig(fileURLToPath(new URL('../desktop-examples/' + edition + '.jsonc', import.meta.url)))
  const school = config.organizations[0], profile = normalizeEnterpriseProfile(school)
  const ids = [edition + '-max', edition + '-plus', edition + '-embedding-small', edition + '-rerank', edition + '-image', edition + '-tts']
  const models = normalizeResourceModels({ data: ids.map(id => ({ id })) }, profile)
  assert.deepEqual(models.map(row => row.id), ids, 'specialist resources remain catalogued')
  if (edition === 'ecnu') assert.deepEqual(models.map(row => row.type), ['llm', 'llm', 'embedding', 'rerank', 'image', 'tts'])
  const discovered = { ...profile, provider: { ...profile.provider, baseURL: 'https://models.example.org/v1', models } }
  const routes = enterpriseProviderConfig(new Map([[profile.id, discovered]])).providers
  assert.deepEqual(routes[profile.provider.id].models.map(row => row.id), ids.slice(0, 2))
  assert.deepEqual(publicProfile(discovered).provider.models.map(row => row.id), ids.slice(0, 2))
  assert.deepEqual(models[1].input, ['text', 'image'])
  const media = config.media.providers.find(row => row.oidcProfileId === school.id)
  assert.equal(media.images.model, edition + '-image')
  assert.equal(media.speech.model, edition + '-tts')
  const specialistsOnly = { ...discovered, provider: { ...discovered.provider, models: models.slice(2) } }
  assert.deepEqual(enterpriseProviderConfig(new Map([[profile.id, specialistsOnly]])).providers, {})
})
