import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { musicLibrary } from '../lib/library.js'
import { resolveMusicConfig, submitMusic } from '../lib/core.js'

const config = resolveMusicConfig({ baseURL: 'https://school.example.org/v1', oidcProfileId: 'school' })
async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'music-library-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

test('creative history preserves input and parent, excludes local metadata upstream and isolates service config', async t => {
  const root = await workspace(t), request_id = randomUUID(), parent = randomUUID()
  assert.deepEqual(await musicLibrary(root, config), { items: [], skipped: 0, truncated: false })
  let sent
  const authorization = { assertCurrent() {}, async fetch(url, init) { sent = JSON.parse(init.body); return Response.json({ id: 'job-one', status: 'queued' }, { status: 202 }) } }
  await submitMusic({ root, config, authorization, args: { request_id, title: '合唱草稿', parent_request_id: parent, operation: 'generate', lyrics: '晨光和希望', style: 'choral', seed: 0 } })
  assert.equal(sent.title, undefined); assert.equal(sent.parent_request_id, undefined)
  const library = await musicLibrary(root, config)
  assert.equal(library.items[0].title, '合唱草稿')
  assert.equal(library.items[0].parent_request_id, parent)
  assert.equal(library.items[0].input.lyrics, '晨光和希望')
  assert.equal(library.items[0].input.seed, 0)
  assert.equal(library.items[0].job_id, 'job-one')
  assert.equal(library.items[0].status, 'pending_refresh')
  assert.equal((await musicLibrary(root, { ...config, oidcProfileId: 'another' })).items.length, 0)
  await writeFile(join(root, '.eduwork/generated/music', `request-${randomUUID()}.json`), 'invalid-json')
  assert.equal((await musicLibrary(root, config)).skipped, 1)
  assert.doesNotMatch(JSON.stringify(library), /credential|Bearer|fingerprint|binding/)
})

