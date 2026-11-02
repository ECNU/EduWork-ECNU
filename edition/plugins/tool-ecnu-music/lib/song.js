import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { writeMusicArtifactDirectory } from './core.js'
import { copyWorkspaceAsset } from './artifact-files.js'
import { escapeHTML, jsonData, rendererAssets, scoreSource } from './score.js'

const audioTypes = { '.flac': 'audio/flac', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg' }
function textField(value, name, max, optional = false) {
  if (optional && value === undefined) return ''
  if (typeof value !== 'string' || !value.trim() || [...value].length > max) throw Error(`${name} must contain 1–${max} characters`)
  return value
}
function isAudio(bytes, extension) {
  const magic = bytes.subarray(0, 4).toString('ascii')
  if (extension === '.flac') return magic === 'fLaC'
  if (extension === '.ogg') return magic === 'OggS'
  if (extension === '.wav') return magic === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WAVE'
  return bytes.subarray(0, 3).toString('ascii') === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224)
}

export async function exportMusicSong({ root, args, signal }) {
  signal?.throwIfAborted()
  for (const key of Object.keys(args)) if (!['title', 'lyrics', 'style', 'audio_path', 'abc', 'abc_path'].includes(key)) throw Error(`Unsupported song parameter: ${key}`)
  const title = textField(args.title ?? '音乐作品', 'title', 120)
  const lyrics = textField(args.lyrics, 'lyrics', 16000), style = textField(args.style, 'style', 2000, true)
  const abc = await scoreSource(root, args, signal)
  if (typeof args.audio_path !== 'string') throw Error('audio_path is required')
  const extension = extname(args.audio_path).toLowerCase(), mime = audioTypes[extension]
  if (!mime) throw Error('audio_path must be a workspace FLAC, MP3, WAV or OGG file')
  const [[renderer, license], template] = await Promise.all([
    rendererAssets(), readFile(new URL('./song-page.html', import.meta.url), 'utf8'),
  ])
  const name = `song-${randomUUID()}`
  const { path: directory, result } = await writeMusicArtifactDirectory(root, name, async directory => {
    const audioBytes = await copyWorkspaceAsset(root, args.audio_path, join(directory, 'audio' + extension), 128 * 1024 * 1024, signal,
      header => { if (!isAudio(header, extension)) throw Error('Audio file header does not match its extension') })
    const replacements = {
      NONCE: randomUUID().replaceAll('-', ''), TITLE: escapeHTML(title),
      LYRICS: lyrics.split(/\r?\n/).map(line => /^\s*\[[^\]]+\]\s*$/.test(line) ? `<h3>${escapeHTML(line.trim())}</h3>` : line.trim() ? `<p>${escapeHTML(line)}</p>` : '<div class="lyric-break" aria-hidden="true"></div>').join('\n'),
      STYLE: escapeHTML(style), STYLE_HIDDEN: style ? '' : 'hidden',
      FORMAT: extension.slice(1).toUpperCase(), AUDIO_SIZE: (audioBytes / (1024 * 1024)).toFixed(1),
      AUDIO_FILE: 'audio' + extension, AUDIO_MIME: mime,
      DATA: jsonData({ title, lyrics, abc, extension }),
      ABCJS: renderer.replace(/<\/script/gi, '<\\/script'), LICENSE: escapeHTML(license),
    }
    const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
      if (!(key in replacements)) throw Error('Unknown song template field: ' + key)
      return replacements[key]
    })
    for (const [file, content] of [['index.html', html], ['score.abc', abc], ['lyrics.txt', lyrics]]) {
      signal?.throwIfAborted()
      await writeFile(join(directory, file), content, { flag: 'wx', mode: 0o600 })
    }
    return { bytes: Buffer.byteLength(html), audioBytes }
  })
  return { path: join(directory, 'index.html'), directory, relativePath: `.eduwork/generated/music/${name}/index.html`, mime: 'text/html', title,
    ...result, audioFormat: extension.slice(1), offline: true, portable: 'Copy the entire song directory, not index.html alone.',
    includes: ['original audio', 'supplied lyrics', 'ABC source', 'SVG notation'],
    message: 'Offline song directory created with relative audio and download links. Open index.html to verify playback and notation. Lyrics are supplied text, not verified transcription; audio, lyrics and notation are not time-aligned.' }
}
