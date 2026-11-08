import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { validatePublicationSource } from '../release/windows-signing/publication-source.mjs'
import { localSigningPolicy } from '../release/windows-signing/io.mjs'

test('publisher reads and validates the actual public signing policy from disk', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ecnu-publication-policy-')); assert.equal(dirname(root), resolve(tmpdir()))
  t.after(() => rm(root, { recursive: true, force: true }))
  assert.equal(await localSigningPolicy(root), null)
  const bytes = await readFile(new URL('../windows-signing.json', import.meta.url))
  await mkdir(join(root, 'edition')); await writeFile(join(root, 'edition/windows-signing.json'), bytes)
  assert.deepEqual(await localSigningPolicy(root), JSON.parse(bytes))
  await writeFile(join(root, 'edition/windows-signing.json'), '{}')
  await assert.rejects(localSigningPolicy(root), /Unexpected protocol fields/)
})

test('repaired main publisher keeps original candidate identity and refuses ancestry/pin/policy/notes drift', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ecnu-publication-source-')); assert.equal(dirname(root), resolve(tmpdir()))
  t.after(() => rm(root, { recursive: true, force: true }))
  const paths = ['core.lock.json', 'edition/windows-signing.json', 'edition/release/windows-signing/tools.lock.json', 'docs/releases/0.4.11.md']
  const files = new Map(paths.map(path => [path, Buffer.from('approved exact bytes: ' + path + '\n')]))
  for (const [path, bytes] of files) { await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes) }
  const source = { head_sha: 'a'.repeat(40), head_branch: 'main' }, publisherCommit = 'b'.repeat(40)
  let main = publisherCommit, base = source.head_sha, status = 'ahead', drift
  const github = {
    async request(path) {
      if (path === '/git/ref/heads/main') return { object: { type: 'commit', sha: main } }
      assert.equal(path, `/compare/${source.head_sha}...${publisherCommit}`)
      return { status, merge_base_commit: { sha: base } }
    },
    async sourceBytes(path, commit) { assert.equal(commit, source.head_sha); return path === drift ? Buffer.from('changed') : files.get(path) },
  }
  const input = { github, source, publisherCommit, publisherRef: 'refs/heads/main', editionRoot: root, releaseNotes: paths.at(-1) }
  assert.deepEqual(await validatePublicationSource(input), { editionCommit: source.head_sha, publisherCommit })
  await assert.rejects(validatePublicationSource({ ...input, publisherRef: 'refs/heads/feature' }))
  await assert.rejects(validatePublicationSource({ ...input, source: { ...source, head_branch: 'feature' } }))
  main = 'c'.repeat(40); await assert.rejects(validatePublicationSource(input), /current main/); main = publisherCommit
  base = publisherCommit; await assert.rejects(validatePublicationSource(input), /merged/); base = source.head_sha
  for (const bad of ['behind', 'diverged']) { status = bad; await assert.rejects(validatePublicationSource(input), /ancestor/) } status = 'ahead'
  for (const path of paths) { drift = path; await assert.rejects(validatePublicationSource(input), /source drift/) } drift = undefined
  // Identical candidate/publisher remains valid without inventing a new candidate SHA.
  source.head_sha = publisherCommit; base = publisherCommit; status = 'identical'
  assert.deepEqual(await validatePublicationSource(input), { editionCommit: publisherCommit, publisherCommit })
})
