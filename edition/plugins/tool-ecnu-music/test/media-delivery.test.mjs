import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodingArgs, prepareMedia } from '../../../skills/ecnu-music/scripts/prepare-media.mjs'

test('sharing preset keeps full duration and aspect, avoids upscaling or recompressing compatible audio', () => {
  const audio = { codec_type: 'audio', codec_name: 'aac', channels: 2, bit_rate: '128000' }
  const video = { codec_type: 'video', index: 0, width: 360, height: 640, sample_aspect_ratio: '1:1', avg_frame_rate: '24/1' }
  const args = encodingArgs('video', 'in.mp4', 'out.mp4', { streams: [video, audio] })
  assert.equal(args[args.indexOf('-vf') + 1], 'scale=360:640:flags=lanczos')
  assert.equal(args[args.indexOf('-c:a') + 1], 'copy')
  for (const option of ['-shortest', '-t', '-ss', '-r', '-y']) assert.ok(!args.includes(option))
  const hd = encodingArgs('video', 'in', 'out', { streams: [{ ...video, width: 1920, height: 1080, avg_frame_rate: '60/1' }, { ...audio, bit_rate: '320000' }] })
  assert.equal(hd[hd.indexOf('-vf') + 1], 'scale=1280:720:flags=lanczos')
  assert.equal(hd[hd.indexOf('-r') + 1], '30')
  assert.equal(hd[hd.indexOf('-b:a') + 1], '160k')
  assert.throws(() => encodingArgs('video', 'in', 'out', { streams: [{ ...video, side_data_list: [{ rotation: 90 }] }, audio] }), /rotation/)
  const mp3 = encodingArgs('audio', 'in', 'out', { streams: [{ ...audio, codec_name: 'mp3' }] })
  assert.equal(mp3[mp3.indexOf('-c:a') + 1], 'copy')
})

test('real encoder preserves source, publishes a playable MP3 receipt and refuses output replacement', { skip: !process.env.EDUWORK_MUSIC_FFMPEG }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'music-share-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const input = join(root, '音乐 source.wav'), output = join(root, '试听 copy.mp3')
  const samples = 48000 * 2, pcm = Buffer.alloc(samples * 2), header = Buffer.alloc(44)
  for (let i = 0; i < samples; i++) pcm.writeInt16LE(Math.round(6000 * Math.sin(i / 48000 * 440 * Math.PI * 2)), i * 2)
  header.write('RIFF'); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(48000, 24); header.writeUInt32LE(96000, 28)
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  const original = Buffer.concat([header, pcm]); await writeFile(input, original)
  const receipt = await prepareMedia({ mode: 'audio', input, output })
  assert.equal(receipt.streams[0].codec_name, 'mp3'); assert.equal(receipt.streams[0].channels, 1)
  assert.equal(receipt.streams[0].bit_rate, '192000'); assert.ok(Math.abs(receipt.duration - 2) < .1)
  assert.ok(receipt.outputBytes < receipt.inputBytes); assert.deepEqual(await readFile(input), original)
  const saved = await readFile(output)
  await assert.rejects(prepareMedia({ mode: 'audio', input, output }), /overwrite/)
  assert.deepEqual(await readFile(output), saved)
  const copy = join(root, 'reuse.mp3'), second = await prepareMedia({ mode: 'audio', input: output, output: copy })
  assert.equal(second.streams[0].bit_rate, '192000'); assert.ok(Math.abs(second.duration - receipt.duration) < .01)
  await assert.rejects(access(output + '.lock'))
})
