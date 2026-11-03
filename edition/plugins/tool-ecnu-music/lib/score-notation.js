// abcjs wrapping counts Z4 as one visual measure. Expand parsed multi-measure
// rests for engraving, while synthesis and external cue offsets keep the source.
export function prepareScoreNotation(source, abcjs) {
  const originals = abcjs.parseOnly(source), edits = new Map()
  if (originals.length !== 1) return { abc: source, expandedRests: 0, sourceOffset: offset => offset, apply: tunes => tunes }
  let measures = 0
  for (const tune of originals) for (const line of tune.lines || []) for (const staff of line.staff || []) for (const voice of staff.voices || []) for (const element of voice) {
    if (element.rest?.type !== 'multimeasure' || element.rest.text <= 1) continue
    const count = element.rest.text, start = element.startChar, end = element.endChar
    if (!Number.isSafeInteger(count) || !Number.isInteger(start) || !Number.isInteger(end)) throw Error('无法定位多小节休止符')
    const token = /Z(\d+)\s*$/.exec(source.slice(start, end))
    if (!token || Number(token[1]) !== count) throw Error('多小节休止符与原谱不匹配')
    const at = start + token.index
    if (edits.has(at)) continue
    measures += count
    if (measures > 8192) throw Error('多小节休止符超出排版限制')
    edits.set(at, { start: at, end: at + token[1].length + 1, text: Array(count).fill('Z').join('|') })
  }
  let abc = '', cursor = 0
  const spans = []
  for (const edit of [...edits.values()].sort((a,b) => a.start-b.start)) {
    abc += source.slice(cursor, edit.start)
    const from = abc.length
    abc += edit.text
    spans.push({ from, to: abc.length, start: edit.start, end: edit.end })
    cursor = edit.end
  }
  abc += source.slice(cursor)
  function sourceOffset(offset, end = false) {
    let delta = 0
    for (const span of spans) {
      if (offset < span.from) break
      if (offset < span.to) return end ? span.end : span.start
      delta = span.to-span.end
    }
    return offset-delta
  }
  return { abc, expandedRests: spans.length, sourceOffset, apply(tunes) {
    for (const [i, tune] of tunes.entries()) {
      for (const line of tune.lines || []) for (const staff of line.staff || []) for (const voice of staff.voices || []) for (const element of voice) {
        if (Number.isInteger(element.startChar)) element.startChar = sourceOffset(element.startChar)
        if (Number.isInteger(element.endChar)) element.endChar = sourceOffset(element.endChar, true)
      }
      // Added barlines must not change abcjs chord rhythm, dynamics, or duration.
      if (originals[i]) tune.setUpAudio = options => originals[i].setUpAudio(options)
    }
    return tunes
  } }
}
