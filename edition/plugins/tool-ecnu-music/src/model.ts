export const modes = {
  generate: { label: '创作歌曲', hint: '从歌词与风格出发，也可加入 ABC 旋律。', action: '生成音乐' },
  cover: { label: '翻唱改编', hint: '以工作区中的音频为参考，重新演绎风格与配器。', action: '开始改编' },
  plan: { label: '旋律规划', hint: '先生成音乐规划与乐谱，确认后再创作歌曲。', action: '生成规划' },
  transcribe: { label: '音频转谱', hint: '把音频转成可检查、可编辑的乐谱。', action: '开始转谱' },
}
export type Operation = keyof typeof modes
export type Form = { title: string; operation: Operation; lyrics: string; style: string; abc: string; audio: string; seed: string; cfg: string; n: string; cot: string; mode: string; parent_request_id?: string }
export const emptyForm = (): Form => ({ title: '', operation: 'generate', lyrics: '', style: '', abc: '', audio: '', seed: '', cfg: '', n: '1', cot: 'full', mode: 'full' })
export const statusName = (s?: string) => ({ queued: '排队中', running: '创作中', succeeded: '已完成', truncated: '输出被截断', failed: '失败', cancelled: '已取消', partial_failed: '部分失败', pending_refresh: '待刷新', unknown: '提交待核实' })[s || ''] || s || '待刷新'
export const isActive = (s?: string) => s === 'queued' || s === 'running'
export function submission(form: Form, request_id: string) {
  const args: any = { operation: form.operation, request_id }
  if (form.title.trim()) args.title = form.title.trim()
  if (form.parent_request_id) args.parent_request_id = form.parent_request_id
  if (form.operation !== 'transcribe') {
    if (!form.style.trim() || !form.lyrics.trim()) throw Error('请填写风格描述和歌词。')
    args.style = form.style; args.lyrics = form.lyrics
    if (form.seed.trim()) {
      const seed = Number(form.seed)
      if (!/^\d+$/.test(form.seed) || !Number.isSafeInteger(seed)) throw Error('Seed 需为 0–9007199254740991 的整数；留空即随机。')
      args.seed = seed
    }
    if (form.cfg.trim()) {
      const value = Number(form.cfg)
      if (!Number.isFinite(value) || value < 0 || value > 20) throw Error('引导强度需为 0–20。')
      args.cfg_scale = value
    }
  }
  if (form.operation === 'generate' || form.operation === 'plan') {
    args.n = form.operation === 'plan' ? 1 : Number(form.n)
    args.cot = form.operation === 'plan' && form.cot === 'off' ? 'full' : form.cot
    if (form.abc.trim()) args.abc = form.abc
  }
  if (form.operation === 'cover' || form.operation === 'transcribe') {
    if (!form.audio.trim()) throw Error('请填写工作区内的参考音频路径。')
    args.audio = form.audio.trim()
  }
  if (form.operation === 'transcribe') args.mode = form.mode
  return args
}
export function fromItem(row: any): Form {
  const input = row.input || {}
  return { ...emptyForm(), operation: row.operation || 'generate', title: `${row.title || '未命名作品'} · 新版本`.slice(0, 120),
    style: input.style || '', lyrics: input.lyrics || '', abc: input.abc || '', audio: input.audio || '',
    seed: input.seed == null ? '' : String(input.seed), cfg: input.cfg_scale == null ? '' : String(input.cfg_scale),
    n: String(input.n || 1), cot: input.cot || 'full', mode: input.mode || 'full', parent_request_id: row.request_id }
}
export type Adapter = {
  demo?: boolean
  execute(action: string, args?: any): Promise<any>
  preview(relativePath: string): Promise<{ encoding: string; data: string; mime: string }>
  openFile?(relativePath: string): Promise<any>
}
