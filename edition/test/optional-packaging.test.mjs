import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

test('school distribution omits remote access until website integration is ready', async () => {
  const distribution=JSON.parse(await readFile(new URL('../distribution.json',import.meta.url),'utf8'))
  assert.deepEqual(distribution.excludedOptionalBundles,['@eduwork/dsh-remote-access'])
  assert.ok(!distribution.retiredPluginIds.includes('eduwork-remote-access'), 'Do not prohibit user installation')
})
test('assembled school product retains annotation and omits the remote package and default entry', {skip:!process.env.EDUWORK_TEST_RUNTIME}, async () => {
  const runtime=process.env.EDUWORK_TEST_RUNTIME
  const identity=JSON.parse(await readFile(join(runtime,'../assembly.json'),'utf8'))
  assert.ok(identity.bundles.includes('@eduwork/dsh-annotation'))
  assert.deepEqual(identity.excludedOptionalBundles,['@eduwork/dsh-remote-access'])
  assert.ok(!identity.bundles.includes('@eduwork/dsh-remote-access'))
  assert.ok(!identity.optionalBundles.includes('@eduwork/dsh-remote-access'))
  assert.ok(!identity.externalPackages.some(x=>x.name==='@eduwork/dsh-remote-access'))
  const manifest=JSON.parse(await readFile(join(runtime,'package.json'),'utf8'))
  assert.equal(manifest.dependencies['@eduwork/dsh-remote-access'],undefined)
  await assert.rejects(readFile(join(runtime,'node_modules/@eduwork/dsh-remote-access/package.json')),{code:'ENOENT'})
  assert.equal(JSON.parse(await readFile(join(runtime,'node_modules/@eduwork/dsh-annotation/package.json'),'utf8')).version,'0.1.0')
})
