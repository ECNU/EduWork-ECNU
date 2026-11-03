import { open, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'

async function openWorkspaceAsset(root, path, max, signal) {
  signal?.throwIfAborted()
  if (typeof path !== 'string' || !path.trim() || path.length > 4096) throw Error('Expected a workspace file path')
  const project = await realpath(root), source = await realpath(resolve(project, path))
  const rel = relative(project, source)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith('../') || rel.startsWith('..\\')) throw Error('File must be inside the session workspace')
  const handle = await open(source, 'r')
  try {
    const info = await handle.stat()
    if (!info.isFile() || info.size < 1 || info.size > max) throw Error(`File must be a regular file of 1–${max} bytes`)
    return handle
  } catch (error) { await handle.close(); throw error }
}

// Canonical workspace fence plus bounded reads, including files that grow while open.
export async function readWorkspaceAsset(root, path, max, signal) {
  const handle = await openWorkspaceAsset(root, path, max, signal)
  try {
    const chunks = []; let size = 0
    while (size <= max) {
      signal?.throwIfAborted()
      const chunk = Buffer.alloc(Math.min(1024 * 1024, max + 1 - size))
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null)
      if (!bytesRead) break
      chunks.push(chunk.subarray(0, bytesRead)); size += bytesRead
    }
    if (size > max) throw Error(`File exceeds ${max} bytes`)
    return Buffer.concat(chunks, size)
  } finally { await handle.close() }
}

// Audio stays a separate file. Copy in bounded chunks rather than loading/base64-encoding it.
export async function copyWorkspaceAsset(root, path, destination, max, signal, validateHeader) {
  const source = await openWorkspaceAsset(root, path, max, signal)
  let output
  try {
    const header = Buffer.alloc(16)
    const { bytesRead } = await source.read(header, 0, header.length, 0)
    validateHeader(header.subarray(0, bytesRead))
    output = await open(destination, 'wx', 0o600)
    const chunk = Buffer.alloc(1024 * 1024); let size = 0
    while (true) {
      signal?.throwIfAborted()
      const { bytesRead } = await source.read(chunk, 0, Math.min(chunk.length, max + 1 - size), size)
      if (!bytesRead) break
      size += bytesRead
      if (size > max) throw Error(`File exceeds ${max} bytes`)
      await output.writeFile(chunk.subarray(0, bytesRead))
    }
    if (!size) throw Error('Audio became empty during export')
    return size
  } finally { await source.close(); await output?.close() }
}
