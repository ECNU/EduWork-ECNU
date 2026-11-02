// Shared, DOM-free time model. HTML uses audio.currentTime; a video adapter uses frame / fps.
export const timelineSchema = 'eduwork.music.timeline.v1'
export function emptyTimeline(audioSha256, abcSha256) {
  return {schema:timelineSchema,audioSha256,abcSha256,durationMs:null,lyrics:{status:'draft',source:'',cues:[]},score:{status:'draft',source:'',cues:[]}}
}
export function validateTimeline(value, identity = {}) {
  if (!value || value.schema !== timelineSchema) throw Error('时间轴格式不受支持')
  for (const key of ['audioSha256','abcSha256']) {
    if (!/^[a-f0-9]{64}$/.test(value[key] || '')) throw Error('时间轴缺少作品指纹')
    if (identity[key] && identity[key] !== value[key]) throw Error('时间轴与当前音频或乐谱不是同一版本')
  }
  if (value.durationMs !== null && (!Number.isFinite(value.durationMs) || value.durationMs <= 0 || value.durationMs > 3600000)) throw Error('时间轴时长无效')
  if (identity.durationMs && value.durationMs !== null && Math.abs(identity.durationMs-value.durationMs)>300) throw Error('时间轴时长与实际音频不符')
  const result = emptyTimeline(value.audioSha256,value.abcSha256)
  result.durationMs = identity.durationMs || value.durationMs
  for (const kind of ['lyrics','score']) {
    const track=value[kind]
    if (!track || !['draft','reviewed'].includes(track.status) || typeof track.source!=='string' || track.source.length>300 || !Array.isArray(track.cues) || track.cues.length>4000) throw Error('时间轴轨道无效')
    let previousEnd=0
    result[kind]={status:track.status,source:track.source,cues:track.cues.map(cue=>{
      if (!cue || !Number.isFinite(cue.startMs)||!Number.isFinite(cue.endMs)||cue.startMs<previousEnd||cue.endMs<=cue.startMs||cue.endMs>3600000) throw Error('时间段必须有序、不重叠且结束晚于开始')
      if (result.durationMs && cue.endMs>result.durationMs+1) throw Error('时间段超过音频末尾')
      previousEnd=cue.endMs
      if (kind==='lyrics') {
        if(typeof cue.text!=='string'||!cue.text.trim()||cue.text.length>1000)throw Error('字幕内容为空或过长')
        return {text:cue.text,startMs:cue.startMs,endMs:cue.endMs,timestampMs:null,confidence:null}
      }
      if(!Number.isInteger(cue.startChar)||!Number.isInteger(cue.endChar)||cue.startChar<0||cue.endChar<=cue.startChar||(identity.abcLength && cue.endChar>identity.abcLength))throw Error('乐谱映射范围无效')
      return {startMs:cue.startMs,endMs:cue.endMs,startChar:cue.startChar,endChar:cue.endChar}
    })}
    if(track.status==='reviewed'&&!track.cues.length)throw Error('空时间轴不能标为已核对')
  }
  return result
}
export function sampleTimeline(timeline, timeMs, durationMs = timeline.durationMs || 0) {
  const time=Number.isFinite(timeMs)?Math.max(0,timeMs):0
  const find=cues=>{let lo=0,hi=cues.length;while(lo<hi){const mid=(lo+hi)>>>1;if(cues[mid].startMs<=time)lo=mid+1;else hi=mid}return lo>0&&time<cues[lo-1].endMs?lo-1:-1}
  const lyricIndex=find(timeline.lyrics.cues),scoreIndex=find(timeline.score.cues)
  const nextIndex=timeline.lyrics.cues.findIndex(cue=>cue.startMs>time)
  const enterProgress=lyricIndex<0?1:Math.min(1,(time-timeline.lyrics.cues[lyricIndex].startMs)/300)
  return {timeMs:time,progress:durationMs>0?Math.min(1,time/durationMs):0,lyricIndex,scoreIndex,nextIndex,
    enterProgress,
    lyric:lyricIndex<0?null:timeline.lyrics.cues[lyricIndex],score:scoreIndex<0?null:timeline.score.cues[scoreIndex]}
}
export function parseSubtitles(text, format, durationMs) {
  const clock=s=>{const p=s.replace(',','.').split(':').map(Number);if(p.slice(1).some(n=>n>=60))throw Error('字幕时间的分秒必须小于 60');return Math.round(p.reduce((v,n)=>v*60+n,0)*1000)}
  if(format==='srt')return text.replace(/^\uFEFF/,'').trim().split(/\r?\n\s*\r?\n/).map(block=>{
    const lines=block.split(/\r?\n/),i=lines.findIndex(line=>line.includes('-->'))
    const match=lines[i]?.match(/^(\d{2,}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(\d{2,}:\d{2}:\d{2}[,.]\d{3})\s*$/)
    if(!match)throw Error('SRT 时间格式无效')
    return {text:lines.slice(i+1).join('\n'),startMs:clock(match[1]),endMs:clock(match[2])}
  })
  if(format==='lrc') {
    const rows=[]
    for(const line of text.split(/\r?\n/)) {
      if(/^\[offset:/i.test(line))throw Error('请先将 LRC offset 合并到实际时间')
      const stamps=[...line.matchAll(/\[(\d+:\d{2}(?:\.\d{1,3})?)\]/g)],words=line.replace(/\[[^\]]*\]/g,'').trim()
      for(const stamp of stamps)rows.push({startMs:clock(stamp[1]),text:words})
    }
    rows.sort((a,b)=>a.startMs-b.startMs)
    if(!rows.length||!Number.isFinite(durationMs)||durationMs<=0)throw Error('请先载入音频，LRC 需至少一个时间标记')
    return rows.map((row,i)=>({...row,endMs:rows[i+1]?.startMs??durationMs})).filter(row=>row.text)
  }
  const value=JSON.parse(text)
  if(!Array.isArray(value))throw Error('字幕 JSON 应为 Caption 数组，或导出的完整时间轴')
  return value
}
