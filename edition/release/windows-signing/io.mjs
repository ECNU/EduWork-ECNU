import assert from 'node:assert/strict'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, lstat } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { unpackArtifact } from './artifact-zip.mjs'
import { sha256File } from './util.mjs'
import { safePath, validatePolicy, validateSigningRun } from './protocol.mjs'

export const policyPath = 'edition/windows-signing.json'
export const usesSchoolSigning = repository => repository?.toLowerCase() === 'ecnu/eduwork-ecnu'
export function candidateWorkflow(repository) {
  assert(usesSchoolSigning(repository),'Windows signing is only enabled for EduWork-ECNU')
  return '.github/workflows/development-windows.yml'
}
export async function localSigningPolicy(editionRoot) {
  const bytes = await readFile(join(editionRoot, policyPath)).catch(error => { if(error.code !== 'ENOENT') throw error; return null })
  if (!bytes) return null
  const policy = JSON.parse(bytes); validatePolicy(policy); return policy
}
export const unpackSafe = unpackArtifact
export function signingGitHub(repository, token) {
  candidateWorkflow(repository)
  assert(token, 'GitHub read token required for provenance')
  const api = `https://api.github.com/repos/${repository}`
  const headers = {Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json', 'User-Agent':'EduWork-Windows-Signing', 'X-GitHub-Api-Version':'2022-11-28'}
  async function request(path, optional = false) {
    const response = await fetch(api + path, {headers})
    if (optional && response.status === 404) return null
    assert(response.ok, `GitHub HTTP ${response.status}: ${path}`)
    return response.json()
  }
  async function sourceBytes(path, commit, optional = false) {
    assert.match(commit, /^[a-f0-9]{40}$/); safePath(path)
    const entry = await request(`/contents/${path}?ref=${commit}`, optional)
    if (!entry) return null
    assert.equal(entry.type,'file'); assert.equal(entry.encoding,'base64')
    return Buffer.from(entry.content,'base64')
  }
  async function sourceJSON(path, commit, optional = false) {
    const bytes = await sourceBytes(path, commit, optional)
    return bytes === null ? null : JSON.parse(bytes.toString('utf8'))
  }
  async function artifact(runId, name) {
    assert.match(String(runId),/^[1-9][0-9]*$/)
    const result = await request(`/actions/runs/${runId}/artifacts?per_page=100`)
    assert(result.total_count <= 100, 'Ambiguous artifact pagination')
    const found = result.artifacts.filter(a=>a.name===name && !a.expired)
    assert.equal(found.length,1,`Missing/ambiguous artifact ${name}`)
    const a=found[0];assert.match(a.digest,/^sha256:[a-f0-9]{64}$/)
    assert.equal(String(a.workflow_run.id),String(runId))
    return {id:String(a.id),name:a.name,sha256:a.digest.slice(7),bytes:a.size_in_bytes}
  }
  async function download(identity, archive, directory) {
    const redirect = await fetch(`${api}/actions/artifacts/${identity.id}/zip`, {headers,redirect:'manual'})
    assert.equal(redirect.status,302)
    const location = new URL(redirect.headers.get('location')); assert.equal(location.protocol,'https:')
    const response = await fetch(location); assert(response.ok,`Artifact HTTP ${response.status}`)
    await mkdir(dirname(archive),{recursive:true})
    await pipeline(Readable.fromWeb(response.body),createWriteStream(archive,{flags:'wx'}))
    assert.equal((await lstat(archive)).size,identity.bytes)
    assert.equal(await sha256File(archive),identity.sha256,'Artifact ZIP digest mismatch')
    await unpackSafe(archive,directory)
  }
  async function signingRun(runId, editionCommit) {
    const run = await request(`/actions/runs/${runId}`)
    validateSigningRun(run,{repository,editionCommit,runId:String(runId)})
    return run
  }
  return {request,sourceBytes,sourceJSON,artifact,download,signingRun}
}
