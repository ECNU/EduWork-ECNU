import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { requestID, segment, serviceBinding, normalizeSubmission } from './core.js'

// Read-only access: do not create directories when opening an empty library.
async function directory(root) {
  let path = await realpath(root)
  for (const part of ['.eduwork', 'generated', 'music']) {
    path = join(path, part)
    try {
      const info = await lstat(path)
      if (info.isSymbolicLink() || !info.isDirectory()) throw Error('Invalid music output directory')
    } catch (error) { if (error.code === 'ENOENT') return undefined; throw error }
  }
  return path
}
async function read(path, max) {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink() || info.size > max) throw Error('Invalid or oversized music file')
  const bytes = await readFile(path)
  if (bytes.length > max) throw Error('Music file exceeds preview limit')
  return bytes
}
export async function musicLibrary(root, config) {
  const dir = await directory(root)
  if (!dir) return { items: [], skipped: 0, truncated: false }
  const names = (await readdir(dir)).filter(name => /^request-[0-9a-f-]+\.json$/i.test(name))
  const items = []; let skipped = 0, total = 0, truncated = names.length > 500
  // Bound IO and renderer memory; callers are told when a large library is partial.
  for (const name of names.slice(0, 500)) {
    try {
      const receipt = JSON.parse((await read(join(dir, name), 512 * 1024)).toString('utf8'))
      const id = requestID(receipt.request_id)
      if (name !== `request-${id}.json` || receipt.binding !== serviceBinding(config)) continue
      if (!['generate', 'plan', 'cover', 'transcribe'].includes(receipt.operation) || !Number.isFinite(Date.parse(receipt.created_at))) throw Error('Invalid music history entry')
      if (receipt.title !== undefined && (typeof receipt.title !== 'string' || [...receipt.title].length > 120)) throw Error('Invalid music title')
      if (receipt.parent_request_id !== undefined) requestID(receipt.parent_request_id)
      let input
      if (receipt.input !== undefined) {
        if (!receipt.input || Array.isArray(receipt.input) || typeof receipt.input !== 'object') throw Error('Invalid music input')
        const { model: _model, ...args } = receipt.input
        const normalized = normalizeSubmission({ ...args, operation: receipt.operation })
        input = { ...normalized.body, ...(args.audio ? { audio: args.audio } : {}) }
      }
      let accepted
      try { accepted = JSON.parse((await read(join(dir, `accepted-${id}.json`), 4096)).toString('utf8')) }
      catch (error) { if (error.code !== 'ENOENT') throw error }
      if (accepted) { segment(accepted.id); if (accepted.request_id !== id) throw Error('Mismatched accepted receipt') }
      total += Buffer.byteLength(JSON.stringify(input || {}))
      if (total > 8 * 1024 * 1024) { truncated = true; break }
      items.push({ request_id: id, operation: receipt.operation, created_at: receipt.created_at,
        title: receipt.title || '', parent_request_id: receipt.parent_request_id,
        input, job_id: accepted?.id, status: accepted?.id ? 'pending_refresh' : 'unknown' })
    } catch { skipped++ }
  }
  items.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return { items, skipped, truncated }
}
export async function previewMusic(root, relativePath) {
  // No arbitrary workspace reads, receipt JSON, remote URL or symlink preview.
  if (typeof relativePath !== 'string' || !/^\.eduwork\/generated\/music\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,300}\.(abc|wav|mp3|flac|ogg)$/i.test(relativePath)) throw Error('Choose a saved music audio or ABC artifact')
  const dir = await directory(root)
  if (!dir) throw Error('Music output directory does not exist')
  const extension = extname(relativePath).toLowerCase(), score = extension === '.abc'
  const bytes = await read(join(dir, relativePath.split('/').at(-1)), score ? 256 * 1024 : 32 * 1024 * 1024)
  return { encoding: score ? 'utf8' : 'base64', data: bytes.toString(score ? 'utf8' : 'base64'),
    mime: score ? 'text/vnd.abc' : ({ '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.ogg': 'audio/ogg' })[extension] }
}
