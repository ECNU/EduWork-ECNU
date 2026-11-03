import React from 'react'
import { createRoot } from 'react-dom/client'
import { MusicStudioView } from '../src/Studio'
import { type Adapter } from '../src/model'

const score = `X:1
T:Morning on Campus
C:Local interface demo
M:4/4
L:1/4
Q:1/4=88
K:C
"C"C E G G | "F"A G F2 | "Am"E F G E | "G"D C D2 |
"C"E G c B | "F"A G F2 | "G"G F E D | "C"C4 |]
`
const lyrics = '[verse]\n晨光轻轻照在书页上\n风把梦想带向远方\n你我并肩走过林荫路\n把青春写成明天的篇章\n\n[chorus]\n让歌声越过山海\n让希望在心中盛开'
const entries: any[] = [
  { request_id: '00000000-0000-4000-8000-000000000001', job_id: 'demo-choral', title: '晨光与远方 · 交响合唱', operation: 'generate', status: 'succeeded', created_at: '2026-10-30T01:00:00Z', input: { style: 'Mandarin Chinese, symphonic choir, noble brass, flowing strings, uplifting campus anthem.', lyrics, cot: 'full', n: 1 } },
  { request_id: '00000000-0000-4000-8000-000000000002', job_id: 'demo-folk', title: '晨光与远方 · 木吉他版', operation: 'cover', status: 'succeeded', parent_request_id: '00000000-0000-4000-8000-000000000001', created_at: '2026-10-29T05:00:00Z', input: { style: 'Warm campus folk, acoustic guitar, gentle vocals.', lyrics, audio: 'audio/reference.wav' } },
  { request_id: '00000000-0000-4000-8000-000000000003', job_id: 'demo-plan', title: '校园主题 · 旋律草稿', operation: 'plan', status: 'succeeded', created_at: '2026-10-29T02:00:00Z', input: { style: 'Lyrical, hopeful, piano and strings.', lyrics, n: 1, cot: 'melody' } },
]
const jobs = new Map(entries.map(row => [row.job_id, { id: row.job_id, status: 'succeeded', seed: '7353406091268106012' } as any]))
const downloads = new Map<string, string>()
const delay = () => new Promise(resolve => setTimeout(resolve, 180))
function wav() {
  const sampleRate = 22050, notes = [261.63, 329.63, 392, 392, 440, 392, 349.23, 349.23, 329.63, 349.23, 392, 329.63, 293.66, 261.63, 293.66, 293.66]
  const duration = .45, length = Math.floor(notes.length * duration * sampleRate), buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer)
  const ascii = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  ascii(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); ascii(8, 'WAVEfmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); ascii(36, 'data'); view.setUint32(40, length * 2, true)
  for (let i = 0; i < length; i++) { const t = i / sampleRate, at = t % duration, envelope = Math.min(1, at / .012) * Math.exp(-at * 5); view.setInt16(44 + i * 2, Math.sin(2 * Math.PI * notes[Math.floor(t / duration)] * at) * envelope * 7000, true) }
  const bytes = new Uint8Array(buffer); let raw = ''; for (let i = 0; i < bytes.length; i += 4096) raw += String.fromCharCode(...bytes.subarray(i, i + 4096)); return btoa(raw)
}
const adapter: Adapter = {
  demo: true,
  async execute(action, args = {}) {
    await delay()
    if (action === 'capabilities') return { operations: ['generate', 'plan', 'cover', 'transcribe'] }
    if (action === 'library') return { items: entries, skipped: 0 }
    if (action === 'submit') {
      const id = `demo-${crypto.randomUUID()}`
      entries.unshift({ request_id: args.request_id, job_id: id, title: args.title, operation: args.operation, input: args, status: 'queued', parent_request_id: args.parent_request_id, created_at: new Date().toISOString() })
      const job: any = { id, status: 'queued', seed: args.seed ?? '18249321843232194' }; jobs.set(id, job)
      if (args.n === 2) job.candidates = [1, 2].map(n => { const c = { id: `${id}-${n}`, status: 'queued', seed: String(n) }; jobs.set(c.id, c); return c })
      setTimeout(() => { if (job.status === 'queued') { job.status = 'running'; for (const c of job.candidates || []) c.status = 'running' } }, 1500)
      setTimeout(() => { if (job.status === 'running') { job.status = 'succeeded'; for (const c of job.candidates || []) c.status = 'succeeded' } }, 4500)
      return { request_id: args.request_id, submission: 'accepted', job: structuredClone(job) }
    }
    if (action === 'job') { const job = jobs.get(args.job_id); if (!job) throw Error('示例任务不存在'); return structuredClone(job) }
    if (action === 'cancel') { const job = jobs.get(args.job_id); if (job) { job.status = 'cancelled'; for (const c of job.candidates || []) c.status = 'cancelled' }; return { id: args.job_id, status: 'cancelled' } }
    if (action === 'artifacts') {
      const job = jobs.get(args.job_id)
      if (job?.status !== 'succeeded') throw Error('示例任务尚未完成，暂时没有产物。')
      const row = entries.find(x => x.job_id === args.job_id)
      return { artifacts: (['plan', 'transcribe'].includes(row?.operation) ? ['score.abc'] : ['audio.wav', 'score.abc']).map(name => ({ name })) }
    }
    if (action === 'download') { const path = `.eduwork/generated/music/${args.job_id}-${args.artifact}`; downloads.set(path, args.artifact); return { relativePath: path } }
    throw Error('未实现的示例操作')
  },
  async preview(path) { await delay(); const file = downloads.get(path); if (!file) throw Error('请先选择产物'); return file.endsWith('.abc') ? { encoding: 'utf8', data: score, mime: 'text/vnd.abc' } : { encoding: 'base64', data: wav(), mime: 'audio/wav' } },
}
createRoot(document.getElementById('app')!).render(<MusicStudioView adapter={adapter}/>)
