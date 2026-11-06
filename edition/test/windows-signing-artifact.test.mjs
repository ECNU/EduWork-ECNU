import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile, open, stat, mkdir, symlink, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { crc32, deflateRawSync } from 'node:zlib'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { unpackSafe, signingGitHub } from '../release/windows-signing/io.mjs'
import { sha256 } from '../release/windows-signing/protocol.mjs'

async function temporary(t) {
  // macOS exposes its temporary directory through the /var -> /private/var link.
  // Use the physical fixture root; extraction must still reject linked targets.
  const parent = await realpath(tmpdir())
  const root = await mkdtemp(join(parent, 'ecnu-artifact-test-'))
  assert.equal(dirname(root), resolve(parent))
  t.after(() => rm(root, { recursive: true, force: true }))
  return root
}

// Independent ZIP fixtures, including ZIP64 and streamed data descriptors.
function archive(entries, { zip64 = false } = {}) {
  const chunks = [], directory = []
  let offset = 0
  for (const { name, data = Buffer.from('fixture'), method = 0, attributes = 0, descriptor = false, trailing = Buffer.alloc(0) } of entries) {
    const path = Buffer.from(name), packed = Buffer.concat([method === 8 ? deflateRawSync(data) : data, trailing]), crc = crc32(data)
    const flags = 0x800 | (descriptor ? 8 : 0)
    const extra = zip64 ? Buffer.alloc(20) : Buffer.alloc(0)
    if (zip64) { extra.writeUInt16LE(1); extra.writeUInt16LE(16, 2); extra.writeBigUInt64LE(BigInt(data.length), 4); extra.writeBigUInt64LE(BigInt(packed.length), 12) }
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(zip64 ? 45 : 20, 4); local.writeUInt16LE(flags, 6); local.writeUInt16LE(method, 8)
    local.writeUInt32LE(descriptor ? 0 : crc, 14); local.writeUInt32LE(zip64 ? 0xffffffff : descriptor ? 0 : packed.length, 18); local.writeUInt32LE(zip64 ? 0xffffffff : descriptor ? 0 : data.length, 22)
    local.writeUInt16LE(path.length, 26); local.writeUInt16LE(extra.length, 28)
    const d = Buffer.alloc(descriptor ? zip64 ? 24 : 16 : 0)
    if (descriptor) {
      d.writeUInt32LE(0x08074b50); d.writeUInt32LE(crc, 4)
      if (zip64) { d.writeBigUInt64LE(BigInt(packed.length), 8); d.writeBigUInt64LE(BigInt(data.length), 16) }
      else { d.writeUInt32LE(packed.length, 8); d.writeUInt32LE(data.length, 12) }
    }
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(45, 4); central.writeUInt16LE(zip64 ? 45 : 20, 6)
    central.writeUInt16LE(flags, 8); central.writeUInt16LE(method, 10); central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(zip64 ? 0xffffffff : packed.length, 20); central.writeUInt32LE(zip64 ? 0xffffffff : data.length, 24)
    central.writeUInt16LE(path.length, 28); central.writeUInt16LE(extra.length, 30); central.writeUInt32LE(attributes >>> 0, 38); central.writeUInt32LE(offset, 42)
    chunks.push(local, path, extra, packed, d); directory.push(central, path, extra)
    offset += local.length + path.length + extra.length + packed.length + d.length
  }
  const records = Buffer.concat(directory), trailer = []
  if (zip64) {
    const end = Buffer.alloc(56), locator = Buffer.alloc(20)
    end.writeUInt32LE(0x06064b50); end.writeBigUInt64LE(44n, 4); end.writeUInt16LE(45, 12); end.writeUInt16LE(45, 14)
    end.writeBigUInt64LE(BigInt(entries.length), 24); end.writeBigUInt64LE(BigInt(entries.length), 32); end.writeBigUInt64LE(BigInt(records.length), 40); end.writeBigUInt64LE(BigInt(offset), 48)
    locator.writeUInt32LE(0x07064b50); locator.writeBigUInt64LE(BigInt(offset + records.length), 8); locator.writeUInt32LE(1, 16)
    trailer.push(end, locator)
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50)
  end.writeUInt16LE(zip64 ? 0xffff : entries.length, 8); end.writeUInt16LE(zip64 ? 0xffff : entries.length, 10)
  end.writeUInt32LE(zip64 ? 0xffffffff : records.length, 12); end.writeUInt32LE(zip64 ? 0xffffffff : offset, 16)
  return Buffer.concat([...chunks, records, ...trailer, end])
}

test('artifact ZIP streams store/deflate, empty directories, descriptors and ZIP64', async t => {
  const root = await temporary(t)
  for (const zip64 of [false, true]) for (const descriptor of [false, true]) {
    const id = `${zip64}-${descriptor}`, zip = join(root, id + '.zip'), out = join(root, id)
    await writeFile(zip, archive([{ name: 'dir/', data: Buffer.alloc(0), attributes: 0x40000010 }, { name: 'dir/内容.txt', data: Buffer.from('中文 '.repeat(100)), method: 8, descriptor }, { name: 'plain', descriptor }], { zip64 }))
    await unpackSafe(zip, out)
    assert.equal(await readFile(join(out, 'dir/内容.txt'), 'utf8'), '中文 '.repeat(100))
    assert.equal(await readFile(join(out, 'plain'), 'utf8'), 'fixture')
  }
})

test('artifact ZIP preflight rejects aliases, links, file conflicts and malformed metadata', async t => {
  const root = await temporary(t)
  const cases = [
    archive([{ name: '../escape' }]), archive([{ name: 'C:/escape' }]), archive([{ name: 'NUL.txt' }]),
    archive([{ name: 'a' }, { name: 'A' }]), archive([{ name: 'dir/a' }, { name: 'Dir/b' }]),
    archive([{ name: 'a' }, { name: 'a/b' }]), archive([{ name: 'a' }, { name: 'a/', data: Buffer.alloc(0) }]),
    archive([{ name: 'link', attributes: 0xa0000000 }]), archive([{ name: 'device', attributes: 0x20000000 }]),
    archive([{ name: 'dir/' }]), archive([{ name: 'wrong-type', attributes: 0x10 }]),
  ]
  const single = () => archive([{ name: 'file' }])
  const mutate = change => { const b = single(); change(b, b.readUInt32LE(b.length - 6)); cases.push(b) }
  mutate(b => b.writeUInt16LE(1, 6)) // encrypted/local flags
  mutate((b, c) => b.writeUInt16LE(99, c + 10)) // unsupported compression
  mutate(b => b[30] ^= 1) // local name differs from directory
  mutate((b, c) => b.writeUInt32LE(0xfffffff0, c + 42)) // local header outside archive
  mutate(b => b.writeUInt32LE(0xfffffff0, b.length - 6)) // central directory outside archive
  mutate((b, c) => b.writeUInt16LE(0xffff, c + 28)) // name beyond directory
  mutate(b => b.writeUInt32LE(1, b.length - 10)) // directory size differs
  mutate(b => b.writeUInt16LE(1, b.length - 18)) // split archive
  const unsafe64 = archive([{ name: 'x' }], { zip64: true }); unsafe64.writeBigUInt64LE(2n ** 60n, 35); cases.push(unsafe64)
  const oversized64 = archive([{ name: 'x' }], { zip64: true }); const central64 = oversized64.indexOf(Buffer.from('504b0102', 'hex')); oversized64.writeBigUInt64LE(16n * 1024n ** 3n, central64 + 51); cases.push(oversized64)
  const many = archive([{ name: 'x' }], { zip64: true }); const end64 = many.length - 22 - 20 - 56; many.writeBigUInt64LE(100001n, end64 + 24); many.writeBigUInt64LE(100001n, end64 + 32); cases.push(many)
  mutate(b => b.writeUInt32LE(64 * 1024 ** 2 + 1, b.length - 10))
  for (const [i, bytes] of cases.entries()) {
    const zip = join(root, i + '.zip'), out = join(root, String(i)); await writeFile(zip, bytes)
    await assert.rejects(unpackSafe(zip, out), undefined, `case ${i}`)
    await assert.rejects(stat(out), { code: 'ENOENT' }, `preflight wrote output for case ${i}`)
  }
})

test('artifact ZIP rejects overlap, descriptor corruption and actual CRC/size errors, cleaning owned outputs', async t => {
  const root = await temporary(t)
  const base = archive([{ name: 'good', data: Buffer.from('keep') }, { name: 'bad', data: Buffer.from('payload'.repeat(50)), method: 8, descriptor: true }])
  const first = base.indexOf(Buffer.from('504b0102', 'hex')), second = base.indexOf(Buffer.from('504b0102', 'hex'), first + 4)
  const badHeader = base.readUInt32LE(second + 42), packedStart = badHeader + 30 + 3
  const cases = []
  const wrongCRC = Buffer.from(base); wrongCRC.writeUInt32LE(1, second + 16); const descriptor = base.indexOf(Buffer.from('504b0708', 'hex')); wrongCRC.writeUInt32LE(1, descriptor + 4); cases.push(wrongCRC)
  const small = Buffer.from(base); small.writeUInt32LE(1, second + 24); small.writeUInt32LE(1, descriptor + 12); cases.push(small)
  const corrupt = Buffer.from(base); corrupt[packedStart] ^= 0xff; cases.push(corrupt)
  const badDescriptor = Buffer.from(base); badDescriptor[descriptor + 4] ^= 1; cases.push(badDescriptor)
  // A complete valid inner local header/data embedded in a stored outer file:
  // both entries pass individual header/CRC checks, but their ranges overlap.
  const inner = archive([{ name: 'inner' }]), innerCentral = inner.readUInt32LE(inner.length - 6)
  const outer = archive([{ name: 'outer', data: inner.subarray(0, innerCentral) }]), outerCentral = outer.readUInt32LE(outer.length - 6)
  const extraCentral = Buffer.from(inner.subarray(innerCentral, -22)); extraCentral.writeUInt32LE(35, 42)
  const overlapEnd = Buffer.from(outer.subarray(-22)); overlapEnd.writeUInt16LE(2, 8); overlapEnd.writeUInt16LE(2, 10); overlapEnd.writeUInt32LE(overlapEnd.readUInt32LE(12) + extraCentral.length, 12)
  const overlap = Buffer.concat([outer.subarray(0, -22), extraCentral, overlapEnd])
  const overlapZip = join(root, 'overlap.zip'); await writeFile(overlapZip, overlap)
  await assert.rejects(unpackSafe(overlapZip, join(root, 'overlap')), /Overlapping ZIP entries/)
  assert(outerCentral > 35)
  cases.push(archive([{ name: 'good' }, { name: 'bad', data: Buffer.from('deflated'), method: 8, trailing: Buffer.from('junk') }]))
  for (const [i, bytes] of cases.entries()) {
    const zip = join(root, i + '.zip'), out = join(root, String(i)); await writeFile(zip, bytes)
    await assert.rejects(unpackSafe(zip, out))
    for (const name of ['good', 'bad']) await assert.rejects(stat(join(out, name)), { code: 'ENOENT' })
  }
  const out = join(root, 'existing'); await mkdir(out); await writeFile(join(out, 'good'), 'existing')
  const zip = join(root, 'existing.zip'); await writeFile(zip, base)
  await assert.rejects(unpackSafe(zip, out), { code: 'EEXIST' })
  assert.equal(await readFile(join(out, 'good'), 'utf8'), 'existing')
  const target = join(root, 'target'); await mkdir(target)
  const link = join(root, 'linked'); await symlink(target, link, process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(unpackSafe(zip, link), /link\/non-directory/)
  await assert.rejects(stat(join(target, 'good')), { code: 'ENOENT' })
})

test('download still rejects transfer size/SHA mismatches before extraction', async t => {
  const root = await temporary(t), body = archive([{ name: 'file' }]), github = signingGitHub('ECNU/EduWork-ECNU', 'synthetic')
  t.mock.method(globalThis, 'fetch', async url => String(url).startsWith('https://api.github.com/') ? new Response(null, { status: 302, headers: { location: 'https://artifact.example.test/fixture' } }) : new Response(body))
  for (const [i, identity] of [{ id: '1', bytes: body.length + 1, sha256: sha256(body) }, { id: '1', bytes: body.length, sha256: '0'.repeat(64) }].entries()) {
    const out = join(root, String(i))
    await assert.rejects(github.download(identity, join(root, i + '.zip'), out))
    await assert.rejects(stat(out), { code: 'ENOENT' })
  }
})

test('a real >2 GiB stored artifact and entry extract with bounded child memory', async t => {
  const root = await temporary(t), zip = join(root, 'large.zip'), out = join(root, 'out')
  const bytes = 2 ** 31 + 1024 ** 2, block = Buffer.alloc(1024 ** 2, 0x5a)
  const fixture = archive([{ name: 'large.bin', data: Buffer.alloc(0) }])
  const local = Buffer.from(fixture.subarray(0, 39)), central = Buffer.from(fixture.subarray(39, fixture.length - 22)), end = Buffer.from(fixture.subarray(-22))
  let crc = 0
  for (let i = 0; i < bytes / block.length; i++) crc = crc32(block, crc)
  local.writeUInt32LE(crc, 14); local.writeUInt32LE(bytes, 18); local.writeUInt32LE(bytes, 22)
  central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes, 20); central.writeUInt32LE(bytes, 24); end.writeUInt32LE(local.length + bytes, 16)
  const file = await open(zip, 'wx')
  const write = async buffer => { let at = 0; while (at < buffer.length) { const { bytesWritten } = await file.write(buffer, at, buffer.length - at); assert(bytesWritten); at += bytesWritten } }
  try { await write(local); for (let i = 0; i < bytes / block.length; i++) await write(block); await write(central); await write(end) } finally { await file.close() }
  assert((await stat(zip)).size > 2 ** 31)
  const script = `import {unpackSafe} from ${JSON.stringify(new URL('../release/windows-signing/io.mjs', import.meta.url).href)}; await unpackSafe(${JSON.stringify(zip)}, ${JSON.stringify(out)}); console.log(JSON.stringify({maxRSS:process.resourceUsage().maxRSS}));`
  const { stdout } = await promisify(execFile)(process.execPath, ['--max-old-space-size=64', '--input-type=module', '-e', script], { windowsHide: true })
  const memory = JSON.parse(stdout); assert(memory.maxRSS < 512 * 1024, 'Extraction exceeded 512 MiB peak RSS')
  assert.equal((await stat(join(out, 'large.bin'))).size, bytes)
  const result = await open(join(out, 'large.bin'), 'r')
  try { for (const position of [0, bytes - block.length]) { const sample = Buffer.alloc(block.length); await result.read(sample, 0, sample.length, position); assert(sample.equals(block)) } } finally { await result.close() }
  t.diagnostic(`archive=${(await stat(zip)).size} bytes; output=${bytes}; peakRSS=${memory.maxRSS} KiB`)
})
