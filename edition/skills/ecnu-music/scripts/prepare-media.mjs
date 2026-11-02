#!/usr/bin/env node
// Local delivery copies. Never downloads encoders or overwrites a source/output.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { access, copyFile, link, open, realpath, stat, unlink, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

function run(executable, args, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, shell: false, stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'] })
    let output = ''
    child.stdout?.on('data', chunk => { output += chunk; if (output.length > 1024 * 1024) child.kill() })
    child.on('error', reject)
    child.on('exit', (code, signal) => code === 0 ? resolve(output) : reject(Error(`Media process failed: code=${code}, signal=${signal}`)))
  })
}

export async function mediaBinaries(options = {}) {
  let ffmpeg = options.ffmpeg || process.env.EDUWORK_MUSIC_FFMPEG
  if (!ffmpeg) {
    const candidates = [
      ...(process.env.DSH_MEDIA_NODE_ENV ? [join(process.env.DSH_MEDIA_NODE_ENV, 'package.json')] : []),
      ...(process.env.ECNU_AGENT_NODE_ENV ? [join(process.env.ECNU_AGENT_NODE_ENV, 'package.json')] : []),
      fileURLToPath(new URL('../../../d/package.json', import.meta.url)),
      fileURLToPath(import.meta.url),
    ]
    for (const candidate of candidates) {
      try {
        const { RenderInternals } = createRequire(candidate)('@remotion/renderer')
        ffmpeg = RenderInternals.getExecutablePath({ type: 'ffmpeg', indent: false, logLevel: 'error', binariesDirectory: null })
        break
      } catch {}
    }
  }
  if (!ffmpeg) throw Error('Existing media runtime not found. Pass --ffmpeg <absolute path>; no encoder will be downloaded.')
  const ffprobe = options.ffprobe || join(dirname(ffmpeg), process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe')
  for (const path of [ffmpeg, ffprobe]) if (!(await stat(path)).isFile()) throw Error('Missing media executable: ' + path)
  return { ffmpeg: await realpath(ffmpeg), ffprobe: await realpath(ffprobe) }
}

async function probe(ffprobe, path) {
  return JSON.parse(await run(ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format', '-of', 'json', path], true))
}

export function encodingArgs(mode, input, output, source) {
  const audio = source.streams.find(stream => stream.codec_type === 'audio')
  if (!audio) throw Error('Source has no audio stream')
  const args = ['-nostdin', '-hide_banner', '-v', 'warning', '-n', '-protocol_whitelist', 'file,pipe', '-i', input]
  if (mode === 'audio') {
    args.push('-map', '0:a:0', '-vn')
    if (audio.codec_name === 'mp3') args.push('-c:a', 'copy')
    else args.push('-c:a', 'libmp3lame', '-b:a', '192k', '-ac', String(Math.min(2, audio.channels || 2)), '-ar', audio.sample_rate === '44100' ? '44100' : '48000')
    args.push('-id3v2_version', '3', '-write_xing', '1')
  } else if (mode === 'video') {
    const video = source.streams.find(stream => stream.codec_type === 'video' && !stream.disposition?.attached_pic)
    if (!video) throw Error('Source has no video stream')
    if (video.sample_aspect_ratio && !['1:1', '0:1', 'N/A'].includes(video.sample_aspect_ratio)) throw Error('Normalize non-square pixel video before using this song delivery preset')
    if (video.side_data_list?.some(item => Number(item.rotation || 0) % 360 !== 0)) throw Error('Normalize video rotation before using this song delivery preset')
    const landscape = video.width >= video.height
    const scale = Math.min(1, (landscape ? 1280 : 720) / video.width, (landscape ? 720 : 1280) / video.height)
    const width = Math.max(2, Math.floor(video.width * scale / 2) * 2), height = Math.max(2, Math.floor(video.height * scale / 2) * 2)
    args.push('-map', `0:${video.index}`, '-map', '0:a:0', '-vf', `scale=${width}:${height}:flags=lanczos`, '-aspect', `${width}:${height}`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '24', '-maxrate', '1800k', '-bufsize', '3600k', '-pix_fmt', 'yuv420p', '-threads', '4')
    const fps = video.avg_frame_rate?.split('/').map(Number)
    if (fps?.[1] && fps[0] / fps[1] > 30) args.push('-r', '30')
    if (audio.codec_name === 'aac' && Number(audio.bit_rate) > 0 && Number(audio.bit_rate) <= 192000) args.push('-c:a', 'copy')
    else args.push('-c:a', 'aac', '-b:a', '160k', '-ac', String(Math.min(2, audio.channels || 2)))
    args.push('-movflags', '+faststart')
  } else throw Error('Mode must be audio or video')
  return [...args, '-map_metadata', '-1', '-map_chapters', '-1', '-progress', 'pipe:1', '-nostats', output]
}

export async function prepareMedia({ mode, input, output, ...options }) {
  const expected = mode === 'audio' ? '.mp3' : mode === 'video' ? '.mp4' : null
  if (!expected || extname(output).toLowerCase() !== expected) throw Error('Use audio <input> <new.mp3> or video <input> <new.mp4>')
  input = await realpath(input)
  if (!(await stat(input)).isFile()) throw Error('Input must be a local file')
  // Resolve the parent first so alternate path spellings cannot replace a source.
  output = join(await realpath(dirname(resolve(output))), resolve(output).split(/[\\/]/).pop())
  const receiptPath = output + '.media.json', lock = output + '.lock'
  const handle = await open(lock, 'wx')
  const temporary = join(dirname(output), `.music-${randomUUID()}${expected}`)
  let published = false
  try {
    for (const path of [output, receiptPath]) {
      try { await access(path); throw Error('Refusing to overwrite: ' + path) } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    const { ffmpeg, ffprobe } = await mediaBinaries(options)
    const source = await probe(ffprobe, input), before = Number(source.format.duration)
    if (!Number.isFinite(before) || before <= 0) throw Error('Cannot determine full input duration')
    const args = encodingArgs(mode, input, temporary, source)
    await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString(), input, output, ffmpeg, args }, null, 2))
    await run(ffmpeg, args)
    const result = await probe(ffprobe, temporary), after = Number(result.format.duration)
    if (!Number.isFinite(after) || Math.abs(after - before) > 0.25) throw Error('Duration changed unexpectedly; delivery copy was not published')
    if (mode === 'audio' && result.streams.find(s => s.codec_type === 'audio')?.codec_name !== 'mp3') throw Error('Expected MP3 output')
    if (mode === 'video' && (result.streams.find(s => s.codec_type === 'video')?.codec_name !== 'h264' || result.streams.find(s => s.codec_type === 'audio')?.codec_name !== 'aac')) throw Error('Expected H.264/AAC output')
    // Exclusive publication: a concurrent/new user file must never be replaced.
    try { await link(temporary, output) } catch (error) {
      if (!['EPERM', 'ENOTSUP', 'EXDEV'].includes(error.code)) throw error
      await copyFile(temporary, output, constants.COPYFILE_EXCL)
    }
    published = true
    const inputBytes = (await stat(input)).size, outputBytes = (await stat(output)).size
    const receipt = { mode, input, output, inputBytes, outputBytes, reductionPercent: Number((100 * (1 - outputBytes / inputBytes)).toFixed(2)),
      sourceDuration: before, duration: after, sourcePreserved: true, preset: mode === 'audio' ? 'mp3-192k-or-existing-mp3' : '720p-h264-crf24-aac160k',
      completedAt: new Date().toISOString(), streams: result.streams.map(({ codec_type, codec_name, width, height, sample_rate, channels, bit_rate, avg_frame_rate }) => ({ codec_type, codec_name, width, height, sample_rate, channels, bit_rate, avg_frame_rate })),
      ...(outputBytes >= inputBytes ? { warning: 'This copy is not smaller; prefer the existing compatible source or review the preset.' } : {}), receiptPath }
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' })
    return receipt
  } finally {
    await handle.close()
    await unlink(lock).catch(() => {})
    await unlink(temporary).catch(() => {})
    // A published result is retained even if writing its receipt fails.
    if (published) process.stderr.write(`Delivery copy: ${output}\n`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, input, output, ...flags] = process.argv.slice(2)
  try {
    if (!input || !output || flags.length % 2) throw Error('Usage: prepare-media.mjs audio|video <input> <new-output> [--ffmpeg <path>] [--ffprobe <path>]')
    const options = {}
    for (let i = 0; i < flags.length; i += 2) {
      if (!['--ffmpeg', '--ffprobe'].includes(flags[i]) || options[flags[i].slice(2)]) throw Error('Unknown or repeated option: ' + flags[i])
      options[flags[i].slice(2)] = flags[i + 1]
    }
    console.log(JSON.stringify(await prepareMedia({ mode, input, output, ...options })))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
