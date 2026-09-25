import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const core = process.env.EDUWORK_CORE_ROOT
if (!core) throw new Error('Set EDUWORK_CORE_ROOT to a core checkout with chatModelIds support')
const { loadUserConfig } = await import(pathToFileURL(resolve(core, 'dsh-host/user-config.mjs')))
const { normalizeEnterpriseProfile } = await import(pathToFileURL(resolve(core, 'packages/dsh-oidc/src/host/profile.js')))
const { normalizeResourceModels } = await import(pathToFileURL(resolve(core, 'packages/dsh-oidc/src/host/resources.js')))

test('school chat catalog excludes specialist models without removing media configuration', () => {
  const config = loadUserConfig(fileURLToPath(new URL('../desktop-examples/ecnu.jsonc', import.meta.url)))
  const school = config.organizations.find(row => row.id === 'ecnu')
  assert.deepEqual(school.provider.chatModelIds, ['ecnu-max', 'ecnu-plus'])
  const profile = normalizeEnterpriseProfile(school)
  const data = ['ecnu-max', 'ecnu-plus', 'ecnu-embedding-small', 'ecnu-rerank', 'ecnu-image', 'ecnu-tts'].map(id => ({ id }))
  const models = normalizeResourceModels({ data }, profile)
  assert.deepEqual(models.map(row => row.id), ['ecnu-max', 'ecnu-plus'])
  assert.deepEqual(models[1].input, ['text', 'image'])
  const media = config.media.providers.find(row => row.oidcProfileId === school.id)
  assert.equal(media.images.model, 'ecnu-image')
  assert.equal(media.speech.model, 'ecnu-tts')
  assert.deepEqual(normalizeResourceModels({ data: data.slice(2) }, profile), [])
})
