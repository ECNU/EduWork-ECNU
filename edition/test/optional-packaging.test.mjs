import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile,access} from 'node:fs/promises'
import {dirname,join} from 'node:path'

test('school distribution omits remote access until website integration is ready', async () => {
  const distribution=JSON.parse(await readFile(new URL('../distribution.json',import.meta.url),'utf8'))
  assert.deepEqual(distribution.excludedOptionalBundles,['@eduwork/dsh-remote-access'])
  assert.ok(!distribution.retiredPluginIds.includes('eduwork-remote-access'), 'Do not prohibit user installation')
})

test('music tools are assembled while the unreleased music skill stays in source', async () => {
  const distribution=JSON.parse(await readFile(new URL('../distribution.json',import.meta.url),'utf8'))
  assert.ok(distribution.plugins.some(row=>row.id==='chatecnu-music' && row.name==='@chatecnu-work/dsh-tool-ecnu-music'))
  assert.ok(!distribution.skills.some(row=>row.name==='ecnu-music'))
  await access(new URL('../skills/ecnu-music/SKILL.md',import.meta.url))
  await access(new URL('../skills/ecnu-music/references/workflows.md',import.meta.url))
})

test('assembled product contains music tools but no preinstalled music skill', {skip:!process.env.EDUWORK_TEST_RUNTIME}, async () => {
  const runtime=process.env.EDUWORK_TEST_RUNTIME
  const manifest=JSON.parse(await readFile(join(runtime,'node_modules/@chatecnu-work/dsh-tool-ecnu-music/package.json'),'utf8'))
  assert.equal(manifest.name,'@chatecnu-work/dsh-tool-ecnu-music')
  await access(join(runtime,'node_modules/@chatecnu-work/dsh-tool-ecnu-music/lib/index.js'))
  await assert.rejects(access(join(runtime,'../skills/ecnu-music')),{code:'ENOENT'})
})
test('assembled school product follows public annotation, side chat and decision pins and omits remote defaults', {skip:!process.env.EDUWORK_TEST_RUNTIME}, async () => {
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
  assert.ok(process.env.EDUWORK_CORE_ROOT, 'Use the pinned public core to check npm versions')
  const recipe=JSON.parse(await readFile(join(process.env.EDUWORK_CORE_ROOT,'config/desktop-build.json'),'utf8'))
  const candidate=dirname(join(process.env.EDUWORK_CORE_ROOT,recipe.sourceLock))
  const published=JSON.parse(await readFile(join(candidate,'source-probe/package.json'),'utf8')).dependencies
  for(const name of ['@eduwork/dsh-annotation','@eduwork/dsh-side-chat','@eduwork/dsh-decision']){
    assert.ok(identity.bundles.includes(name), `Missing preinstalled bundle: ${name}`)
    assert.match(published[name], /^\d+\.\d+\.\d+$/)
    assert.equal(JSON.parse(await readFile(join(runtime,'node_modules',name,'package.json'),'utf8')).version,published[name])
  }
})
