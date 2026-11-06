import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { safePath } from './protocol.mjs'

// A repaired publisher may consume an older, immutable candidate. Both must
// belong to main, and every source pin/policy/approved note must remain exact.
export async function validatePublicationSource({ github, source, publisherCommit, publisherRef, editionRoot, releaseNotes }) {
  assert.match(publisherCommit, /^[a-f0-9]{40}$/)
  assert.match(source.head_sha, /^[a-f0-9]{40}$/)
  assert.equal(publisherRef, 'refs/heads/main', 'Publication validation requires main')
  assert.equal(source.head_branch, 'main', 'Candidate must originate on main')
  const main = await github.request('/git/ref/heads/main')
  assert.equal(main.object.type, 'commit')
  assert.equal(main.object.sha, publisherCommit, 'Publisher must be the current main commit')
  const ancestry = await github.request(`/compare/${source.head_sha}...${publisherCommit}`)
  assert(['identical', 'ahead'].includes(ancestry.status), 'Candidate is not a publisher ancestor')
  assert.equal(ancestry.merge_base_commit.sha, source.head_sha, 'Candidate must be merged into publisher main')
  for (const path of ['core.lock.json', 'edition/windows-signing.json', 'edition/release/windows-signing/tools.lock.json', safePath(releaseNotes)]) {
    const candidate = await github.sourceBytes(path, source.head_sha)
    const publisher = await readFile(join(editionRoot, path))
    assert(candidate.equals(publisher), `Candidate/publisher source drift: ${path}`)
  }
  return { publisherCommit, editionCommit: source.head_sha }
}
