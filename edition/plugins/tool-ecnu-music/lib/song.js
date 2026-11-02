import { randomUUID, createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { writeMusicArtifactDirectory } from './core.js'
import { copyWorkspaceAsset, readWorkspaceAsset } from './artifact-files.js'
import { emptyTimeline, validateTimeline } from './song-timeline.js'
import { escapeHTML, jsonData, rendererAssets, scoreSource } from './score.js'
import { scorePianoAssets } from './score-piano.js'

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
  for (const key of Object.keys(args)) if (!['title', 'lyrics', 'style', 'audio_path', 'abc', 'abc_path', 'timeline_path'].includes(key)) throw Error(`Unsupported song parameter: ${key}`)
  const title = textField(args.title ?? '音乐作品', 'title', 120)
  const lyrics = textField(args.lyrics, 'lyrics', 16000), style = textField(args.style, 'style', 2000, true)
  const abc = await scoreSource(root, args, signal)
  const piano = await scorePianoAssets(abc)
  if (typeof args.audio_path !== 'string') throw Error('audio_path is required')
  const extension = extname(args.audio_path).toLowerCase(), mime = audioTypes[extension]
  if (!mime) throw Error('audio_path must be a workspace FLAC, MP3, WAV or OGG file')
  const [[renderer, license], template, timelineRuntime, playback, playbackScript, readingStyle, readingScript, scoreAudioScript] = await Promise.all([
    rendererAssets(), readFile(new URL('./song-page.html', import.meta.url), 'utf8'),
    ...['song-timeline.js','song-playback.html','song-playback.js','song-reading.css','song-reading.js','score-audio.js'].map(file=>readFile(new URL(file,import.meta.url),'utf8')),
  ])
  const suppliedTimeline=args.timeline_path?JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readWorkspaceAsset(root,args.timeline_path,1024*1024,signal))):null
  const name = `song-${randomUUID()}`
  const { path: directory, result } = await writeMusicArtifactDirectory(root, name, async directory => {
    const audioBytes = await copyWorkspaceAsset(root, args.audio_path, join(directory, 'audio' + extension), 128 * 1024 * 1024, signal,
      header => { if (!isAudio(header, extension)) throw Error('Audio file header does not match its extension') })
    const hash=createHash('sha256');for await(const chunk of createReadStream(join(directory,'audio'+extension),{signal}))hash.update(chunk)
    const audioSha256=hash.digest('hex'),abcSha256=createHash('sha256').update(abc).digest('hex')
    const timeline=suppliedTimeline?validateTimeline(suppliedTimeline,{audioSha256,abcSha256,abcLength:abc.length}):emptyTimeline(audioSha256,abcSha256)
    const replacements = {
      NONCE: randomUUID().replaceAll('-', ''), TITLE: escapeHTML(title),
      LYRICS: lyrics.split(/\r?\n/).map(line => /^\s*\[[^\]]+\]\s*$/.test(line) ? `<h3>${escapeHTML(line.trim())}</h3>` : line.trim() ? `<p>${escapeHTML(line)}</p>` : '<div class="lyric-break" aria-hidden="true"></div>').join('\n'),
      STYLE: escapeHTML(style), STYLE_HIDDEN: style ? '' : 'hidden',
      FORMAT: extension.slice(1).toUpperCase(), AUDIO_SIZE: (audioBytes / (1024 * 1024)).toFixed(1),
      AUDIO_FILE: 'audio' + extension, AUDIO_MIME: mime,
      DATA: jsonData({ title, lyrics, abc, extension, timeline, piano: piano.samples }),
      PLAYBACK: playback, TIMELINE_JS: timelineRuntime.replace(/^export /gm,''), PLAYBACK_JS:playbackScript,
      READING_CSS: readingStyle, READING_JS: readingScript, SCORE_AUDIO_JS:scoreAudioScript.replace(/^export /gm,''),
      ABCJS: renderer.replace(/<\/script/gi, '<\\/script'), LICENSE: escapeHTML(license + '\n\n' + piano.license),
    }
    const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => {
      if (!(key in replacements)) throw Error('Unknown song template field: ' + key)
      return replacements[key]
    })
    for (const [file, content] of [['index.html', html], ['score.abc', abc], ['lyrics.txt', lyrics],['timeline.json',JSON.stringify(timeline,null,2)],['song-timeline.js',timelineRuntime]]) {
      signal?.throwIfAborted()
      await writeFile(join(directory, file), content, { flag: 'wx', mode: 0o600 })
    }
    return { bytes: Buffer.byteLength(html), audioBytes, audioSha256, abcSha256, timelineStatus:timeline.lyrics.cues.length?timeline.lyrics.status:'missing' }
  })
  return { path: join(directory, 'index.html'), directory, relativePath: `.eduwork/generated/music/${name}/index.html`, mime: 'text/html', title,
    audioPath: join(directory, 'audio' + extension), audioRelativePath: `.eduwork/generated/music/${name}/audio${extension}`, audioMime: mime,
    ...result, audioFormat: extension.slice(1), offline: true, portable: 'Copy the entire song directory, not index.html alone.',
    includes: ['original audio', 'supplied lyrics', 'ABC source', 'SVG notation','timeline JSON','shared time model'],
    message: 'Song page created with complete readable lyrics, background, manual/automatic reading and offline ABC score audition. Automatic reading follows total duration, NOT sung lyric timing. Optional subtitle import and timing editor remain available. Provide HTML and standalone audio. Serve this directory on loopback HTTP or open index.html externally; built-in HTML file preview does not resolve sibling audio. No alignment is inferred: empty tracks stay pending and imported draft timings require listening review. Export does not verify playback or timing. Share the entire directory.' }
}
