// Bounded, read-only ZIP parsing for school CI artifact transport. Payloads are
// streamed; neither the archive nor a decompressed file becomes a single Buffer.
// Format: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
import assert from 'node:assert/strict'
import { open, mkdir, lstat, unlink } from 'node:fs/promises'
import { resolve, parse, join } from 'node:path'
import { Readable, Transform, Writable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createInflateRaw, crc32 } from 'node:zlib'
import { safePath } from './protocol.mjs'

const LIMIT = 16 * 1024 ** 3, MAX_DIRECTORY = 64 * 1024 ** 2, MAX_ENTRIES = 100000
const U32 = 0xffffffff
const integer = value => { assert(Number.isSafeInteger(value) && value >= 0, 'Unsafe ZIP integer'); return value }
const u64 = (bytes, offset) => integer(Number(bytes.readBigUInt64LE(offset)))

async function readAt(file, position, length, limit) {
  integer(position); integer(length)
  assert(position + length <= limit, 'ZIP record outside archive bounds')
  const bytes = Buffer.alloc(length)
  let done = 0
  while (done < length) {
    const { bytesRead } = await file.read(bytes, done, length - done, position + done)
    assert(bytesRead > 0, 'Truncated ZIP record'); done += bytesRead
  }
  return bytes
}

function zip64(extra, values) {
  let offset = 0, extended
  while (offset < extra.length) {
    assert(offset + 4 <= extra.length, 'Truncated ZIP extra field')
    const id = extra.readUInt16LE(offset), size = extra.readUInt16LE(offset + 2)
    offset += 4; assert(offset + size <= extra.length, 'Truncated ZIP extra field')
    if (id === 1) { assert(!extended, 'Duplicate ZIP64 extra'); extended = extra.subarray(offset, offset + size) }
    offset += size
  }
  let cursor = 0
  return values.map(value => {
    if (value !== U32) return value
    assert(extended && cursor + 8 <= extended.length, 'Missing ZIP64 size/offset')
    const result = u64(extended, cursor); cursor += 8; return result
  })
}

async function entriesFrom(file, size) {
  assert(size >= 22 && size < LIMIT + MAX_DIRECTORY, 'Invalid signing artifact size')
  const tail = await readAt(file, Math.max(0, size - 65557), Math.min(size, 65557), size)
  let end = -1
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50 && i + 22 + tail.readUInt16LE(i + 20) === tail.length) { end = i; break }
  }
  assert(end >= 0, 'Missing ZIP end record')
  const eocd = tail.subarray(end), eocdOffset = size - tail.length + end
  assert(eocd.readUInt16LE(4) === 0 && eocd.readUInt16LE(6) === 0, 'Split ZIP forbidden')
  let count = eocd.readUInt16LE(10), directorySize = eocd.readUInt32LE(12), directoryOffset = eocd.readUInt32LE(16), directoryEnd = eocdOffset
  assert.equal(eocd.readUInt16LE(8), count, 'Split ZIP forbidden')
  if (count === 0xffff || directorySize === U32 || directoryOffset === U32) {
    const locator = await readAt(file, eocdOffset - 20, 20, size)
    assert.equal(locator.readUInt32LE(0), 0x07064b50, 'Missing ZIP64 locator')
    assert(locator.readUInt32LE(4) === 0 && locator.readUInt32LE(16) === 1, 'Split ZIP forbidden')
    directoryEnd = u64(locator, 8)
    const record = await readAt(file, directoryEnd, 56, eocdOffset - 20)
    assert.equal(record.readUInt32LE(0), 0x06064b50, 'Missing ZIP64 end record')
    assert(u64(record, 4) >= 44 && directoryEnd + 12 + u64(record, 4) === eocdOffset - 20, 'Invalid ZIP64 end size')
    assert(record.readUInt32LE(16) === 0 && record.readUInt32LE(20) === 0, 'Split ZIP forbidden')
    count = u64(record, 32); assert.equal(u64(record, 24), count, 'Split ZIP forbidden')
    directorySize = u64(record, 40); directoryOffset = u64(record, 48)
    for (const [legacy, sentinel, actual] of [[eocd.readUInt16LE(10), 0xffff, count], [eocd.readUInt32LE(12), U32, directorySize], [eocd.readUInt32LE(16), U32, directoryOffset]]) {
      assert(legacy === sentinel || legacy === actual, 'Conflicting ZIP64 end records')
    }
  }
  assert(count > 0 && count <= MAX_ENTRIES && directorySize <= MAX_DIRECTORY, 'Oversized ZIP directory')
  assert.equal(directoryOffset + directorySize, directoryEnd, 'Invalid ZIP directory bounds')
  const directory = await readAt(file, directoryOffset, directorySize, size)
  const entries = [], paths = new Map(), files = new Set()
  let offset = 0, total = 0
  for (let index = 0; index < count; index++) {
    assert(offset + 46 <= directory.length && directory.readUInt32LE(offset) === 0x02014b50, 'Corrupt ZIP directory')
    const h = directory.subarray(offset, offset + 46)
    const nameLength = h.readUInt16LE(28), extraLength = h.readUInt16LE(30), commentLength = h.readUInt16LE(32)
    const next = offset + 46 + nameLength + extraLength + commentLength
    assert(next <= directory.length, 'Truncated ZIP directory entry')
    const nameBytes = directory.subarray(offset + 46, offset + 46 + nameLength), name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes)
    const isDirectory = name.endsWith('/'), path = safePath(isDirectory ? name.slice(0, -1) : name), key = path.toLowerCase()
    assert(!paths.has(key), 'Duplicate/case-colliding ZIP entry'); paths.set(key, path)
    if (!isDirectory) files.add(key)
    const flags = h.readUInt16LE(8), method = h.readUInt16LE(10), attributes = h.readUInt32LE(38), type = (attributes >>> 16) & 0xf000
    assert((flags & ~0x080e) === 0 && [0, 8].includes(method), 'Unsupported/encrypted ZIP entry')
    assert(method === 8 || (flags & 6) === 0, 'Invalid store flags')
    assert(type === 0 || type === (isDirectory ? 0x4000 : 0x8000), 'ZIP links/devices forbidden')
    assert(!(attributes & 0x10) || isDirectory, 'Conflicting ZIP directory type')
    assert.equal(h.readUInt16LE(34), 0, 'Split ZIP forbidden')
    const [bytes, compressed, header] = zip64(directory.subarray(offset + 46 + nameLength, offset + 46 + nameLength + extraLength), [h.readUInt32LE(24), h.readUInt32LE(20), h.readUInt32LE(42)])
    total += bytes; assert(total < LIMIT, 'Oversized signing artifact')
    assert(!isDirectory || bytes === 0, 'Directory contains file data')
    assert(method !== 0 || bytes === compressed, 'Stored ZIP size mismatch')
    entries.push({ nameBytes, path, isDirectory, flags, method, crc: h.readUInt32LE(16), bytes, compressed, header })
    offset = next
  }
  assert.equal(offset, directory.length, 'Unexpected ZIP directory data')
  // Also reject implicit directory aliases and file/child conflicts before writes.
  const components = new Map()
  for (const entry of entries) {
    const parts = entry.path.split('/')
    for (let i = 1; i <= parts.length; i++) {
      const path = parts.slice(0, i).join('/'), key = path.toLowerCase()
      assert(!components.has(key) || components.get(key) === path, 'Case-colliding ZIP directory')
      components.set(key, path)
      if (i < parts.length) assert(!files.has(key), 'ZIP file/directory conflict')
    }
  }
  for (const entry of entries) {
    const h = await readAt(file, entry.header, 30, directoryOffset)
    assert.equal(h.readUInt32LE(0), 0x04034b50, 'Corrupt ZIP local header')
    assert.equal(h.readUInt16LE(6), entry.flags, 'ZIP local flags mismatch')
    assert.equal(h.readUInt16LE(8), entry.method, 'ZIP local method mismatch')
    const nameLength = h.readUInt16LE(26), extraLength = h.readUInt16LE(28)
    const variable = await readAt(file, entry.header + 30, nameLength + extraLength, directoryOffset)
    assert(variable.subarray(0, nameLength).equals(entry.nameBytes), 'ZIP local name mismatch')
    const sizes = zip64(variable.subarray(nameLength), [h.readUInt32LE(22), h.readUInt32LE(18)])
    entry.start = entry.header + 30 + variable.length; entry.end = entry.start + entry.compressed
    assert(entry.end <= directoryOffset, 'ZIP payload outside bounds')
    if (!(entry.flags & 8)) {
      assert.equal(h.readUInt32LE(14), entry.crc, 'ZIP local CRC mismatch')
      assert.deepEqual(sizes, [entry.bytes, entry.compressed], 'ZIP local size mismatch')
    } else {
      const wide = h.readUInt32LE(18) === U32 || h.readUInt32LE(22) === U32 || entry.bytes >= U32 || entry.compressed >= U32
      let position = entry.end
      const signature = await readAt(file, position, 4, directoryOffset)
      if (signature.readUInt32LE(0) === 0x08074b50) position += 4
      const descriptor = await readAt(file, position, wide ? 20 : 12, directoryOffset)
      assert.equal(descriptor.readUInt32LE(0), entry.crc, 'ZIP descriptor CRC mismatch')
      assert.equal(wide ? u64(descriptor, 4) : descriptor.readUInt32LE(4), entry.compressed, 'ZIP descriptor size mismatch')
      assert.equal(wide ? u64(descriptor, 12) : descriptor.readUInt32LE(8), entry.bytes, 'ZIP descriptor size mismatch')
      entry.end = position + descriptor.length
    }
  }
  const ranges = [...entries].sort((a, b) => a.header - b.header)
  for (let i = 1; i < ranges.length; i++) assert(ranges[i].header >= ranges[i - 1].end, 'Overlapping ZIP entries')
  return entries
}

async function safeDirectory(directory) {
  const absolute = resolve(directory), root = parse(absolute).root
  let path = root
  for (const part of absolute.slice(root.length).split(/[\\/]/).filter(Boolean)) {
    path = join(path, part)
    await mkdir(path).catch(error => { if (error.code !== 'EEXIST') throw error })
    const info = await lstat(path)
    assert(info.isDirectory() && !info.isSymbolicLink(), 'Extraction directory is a link/non-directory')
  }
}

export async function unpackArtifact(archive, directory) {
  const file = await open(archive, 'r')
  const created = []
  let totalOutput = 0
  try {
    const info = await file.stat(); assert(info.isFile(), 'ZIP must be a regular file')
    const entries = await entriesFrom(file, info.size)
    await safeDirectory(directory)
    for (const entry of entries) {
      const destination = join(directory, entry.path)
      await safeDirectory(entry.isDirectory ? destination : resolve(destination, '..'))
      let bytes = 0, crc = 0
      const check = new Transform({ transform(chunk, encoding, callback) {
        bytes += chunk.length
        totalOutput += chunk.length
        if (bytes > entry.bytes || totalOutput >= LIMIT) return callback(new Error('ZIP output exceeds declared size/limit'))
        crc = crc32(chunk, crc); callback(null, chunk)
      } })
      const input = entry.compressed ? file.createReadStream({ start: entry.start, end: entry.start + entry.compressed - 1, autoClose: false, highWaterMark: 1024 * 1024 }) : Readable.from([])
      const inflate = entry.method === 8 ? createInflateRaw() : null
      const target = entry.isDirectory ? null : await open(destination, 'wx')
      if (target) created.push(destination)
      const output = target ? target.createWriteStream() : new Writable({ write(chunk, encoding, callback) { callback() } })
      try { await pipeline(input, ...(inflate ? [inflate] : []), check, output) }
      finally { if (target) await target.close() }
      if (inflate) assert.equal(inflate.bytesWritten, entry.compressed, 'Trailing ZIP compressed data')
      assert.equal(bytes, entry.bytes, 'ZIP output size mismatch')
      assert.equal(crc, entry.crc, 'ZIP CRC mismatch')
    }
  } catch (error) {
    // Only files exclusively created by this extraction may be removed.
    const cleanup = await Promise.allSettled(created.map(path => unlink(path)))
    const failures = cleanup.filter(result => result.status === 'rejected').map(result => result.reason)
    if (failures.length) throw new AggregateError([error, ...failures], 'ZIP extraction and partial-file cleanup failed')
    throw error
  } finally { await file.close() }
}
