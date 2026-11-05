import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { run } from './util.mjs'

export const editionRoot = fileURLToPath(new URL('../../../', import.meta.url))
export const toolsLock = JSON.parse(await readFile(new URL('tools.lock.json', import.meta.url), 'utf8'))
export function coreRoot() {
  assert(process.env.EDUWORK_CORE_ROOT, 'EDUWORK_CORE_ROOT must name the pinned public core')
  return resolve(process.env.EDUWORK_CORE_ROOT)
}
export const coreURL = path => pathToFileURL(join(coreRoot(), path)).href
export const coreModule = path => import(coreURL(path))
export function toolsRoot() {
  assert(process.env.EDUWORK_SETUP_CORE_ROOT, 'EDUWORK_SETUP_CORE_ROOT must name the pinned Setup tools')
  return resolve(process.env.EDUWORK_SETUP_CORE_ROOT)
}
export async function verifyCheckout(root, commit) {
  assert.match(commit, /^[a-f0-9]{40}$/)
  assert.equal((await run('git', ['-C', root, 'rev-parse', 'HEAD'], { capture: true })).stdout.trim(), commit)
  assert.equal((await run('git', ['-C', root, 'status', '--porcelain'], { capture: true })).stdout.trim(), '', 'Pinned source must be clean')
}
export async function verifyInputs() {
  const lock = JSON.parse(await readFile(join(editionRoot, 'core.lock.json'), 'utf8'))
  assert.equal(lock.repository.toLowerCase(), 'https://github.com/ecnu/eduwork.git')
  assert.equal(toolsLock.repository.toLowerCase(), lock.repository.toLowerCase())
  assert.equal(toolsLock.purpose, 'portable-extractor-only')
  await verifyCheckout(coreRoot(), lock.commit)
  await verifyCheckout(toolsRoot(), toolsLock.commit)
  return lock
}
