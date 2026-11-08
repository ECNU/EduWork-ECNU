import abcjs from '../vendor/abcjs/abcjs.cjs'
import { readFile } from 'node:fs/promises'

const root = new URL('../vendor/piano/', import.meta.url)
let inventory
function pitch(name) {
  const [, note, flat, octave] = /^([A-G])(b?)(\d)\.mp3$/.exec(name)
  return (Number(octave) + 1) * 12 + { C:0,D:2,E:4,F:5,G:7,A:9,B:11 }[note] - (flat ? 1 : 0)
}
export async function scorePianoAssets(abc) {
  inventory ??= Promise.all([readFile(new URL('manifest.json', root), 'utf8'), readFile(new URL('LICENSE.txt', root), 'utf8')])
  const [manifest, license] = await inventory
  const available = JSON.parse(manifest).files.map(file => ({ ...file, pitch: pitch(file.name) }))
  const wanted = new Set()
  for (const tune of abcjs.parseOnly(abc)) for (const track of tune.setUpAudio({ chordsOff:false }).tracks) for (const note of track) {
    if (note.cmd !== 'note' || !Number.isFinite(note.pitch)) continue
    const closest = available.reduce((a,b) => Math.abs(a.pitch-note.pitch) <= Math.abs(b.pitch-note.pitch) ? a : b)
    wanted.add(closest.name)
  }
  // Embed only the notes this score uses. No network request or full-song audio embedding.
  const samples = await Promise.all(available.filter(file => wanted.has(file.name)).map(async file => ({ pitch: file.pitch, data: (await readFile(new URL(file.name, root))).toString('base64') })))
  return { samples, license }
}
