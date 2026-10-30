import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const core = process.env.EDUWORK_CORE_ROOT
if (!core) throw Error('Set EDUWORK_CORE_ROOT to the pinned public core checkout')
const { loadUserConfig } = await import(pathToFileURL(resolve(core, 'dsh-host/user-config.mjs')))

test('school supplies public decision configuration without copying a tool or skill', async () => {
  const configuration = loadUserConfig(fileURLToPath(new URL('../desktop/eduwork.jsonc', import.meta.url)))
  const decision = configuration.pluginConfig.decision
  assert.equal(decision.model, 'ecnu-decision'); assert.equal(decision.authMode, 'oidc')
  assert.equal(decision.oidcProfileId, 'ecnu'); assert.equal(decision.maxQuestions, 64)
  assert.equal(decision.baseURL, 'https://chat.ecnu.edu.cn/open/api/v1')
  const descriptions = JSON.parse(await readFile(new URL('../desktop/configuration-options.json', import.meta.url)))
  for (const key of Object.keys(decision)) assert.ok(descriptions[`plugins.decision.${key}`])
  const distribution = JSON.parse(await readFile(new URL('../distribution.json', import.meta.url)))
  assert.ok(!distribution.plugins.some(row => row.name.includes('decision')))
  assert.ok(!distribution.skills.some(row => row.name.includes('decision')))
  await assert.rejects(access(new URL('../plugins/tool-ecnu-decision', import.meta.url)), { code: 'ENOENT' })
})
