import React, { useEffect, useId, useRef, useState } from 'react'
import abcjs from '../vendor/abcjs/abcjs.cjs'
import styles from './styles'
import { type Adapter, type Form, type Operation, emptyForm, fromItem, isActive, modes, statusName, submission } from './model'

export function MusicIcon({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13M9 8l11-2"/><ellipse cx="6" cy="18" rx="3" ry="2.5"/><ellipse cx="17" cy="16" rx="3" ry="2.5"/></svg>
}
function Score({ abc }: { abc: string }) {
  const element = useRef<HTMLDivElement>(null), [warning, setWarning] = useState(''), [width, setWidth] = useState(640)
  useEffect(() => {
    if (!element.current) return
    const observer = new ResizeObserver(entries => { const width = Math.floor(entries[0].contentRect.width); if (width > 0) setWidth(width) })
    observer.observe(element.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!element.current) return
      try {
        if (!/^K:/m.test(abc)) throw Error('ABC 需要包含 K: 调性字段。')
        const result = abcjs.renderAbc(element.current, abc, { responsive: 'resize', staffwidth: Math.max(260, width - 24), paddingtop: 10, paddingbottom: 10, add_classes: true,
          wrap: { minSpacing: 1.8, maxSpacing: 2.7, preferredMeasuresPerLine: 4 } })
        const warnings = result.flatMap((t: any) => t.warnings || [])
        setWarning(warnings.length ? `乐谱存在 ${warnings.length} 处解析提示，请核对 ABC 与音符。` : '')
      } catch (error) { element.current.replaceChildren(); setWarning((error as Error).message || '无法排版此 ABC，请检查内容。') }
    }, 300)
    return () => clearTimeout(timer)
  }, [abc, width])
  return <><div ref={element} className="ms-score" aria-label="ABC 五线谱预览" role="img"/>{warning && <p className="ms-alert" role="status">{warning}</p>}</>
}
function saveText(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime })), link = document.createElement('a')
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const date = (value: string) => new Date(value).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
const filenameRows = (value: any): string[] => (Array.isArray(value) ? value : value?.artifacts || []).map((r: any) => typeof r === 'string' ? r : r.name).filter(Boolean)

export function MusicStudioView({ adapter, active = true }: { adapter: Adapter; active?: boolean }) {
  const id = useId(), [form, setForm] = useState<Form>(emptyForm), [rows, setRows] = useState<any[]>([]), [jobs, setJobs] = useState<Record<string, any>>({}), [selected, setSelected] = useState('')
  const [page, setPage] = useState('create'), [filter, setFilter] = useState(''), [capabilities, setCapabilities] = useState<any>(null), [capError, setCapError] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [pollEpoch, setPollEpoch] = useState(0)
  const [busy, setBusy] = useState(''), [attempt, setAttempt] = useState(false), [candidate, setCandidate] = useState(''), [files, setFiles] = useState<string[]>([]), [abc, setABC] = useState(''), [audio, setAudio] = useState<{ url: string; name: string } | null>(null), [saved, setSaved] = useState('')
  const submitLock = useRef(false), selectedRef = useRef(''), fileGeneration = useRef(0), live = useRef(true), audioElement = useRef<HTMLAudioElement>(null)
  const item = rows.find(row => row.request_id === selected), job = item?.job_id ? jobs[item.job_id] : undefined
  const status = job?.status || item?.status
  const candidates: any[] = Array.isArray(job?.candidates) ? job.candidates : []
  const artifactJob = candidate || (!candidates.length ? item?.job_id : '')
  const chosenJob = candidates.find(c => (typeof c === 'string' ? c : c.id) === candidate) || job
  const set = (key: keyof Form, value: string) => setForm(old => ({ ...old, [key]: value }))
  useEffect(() => { live.current = true; return () => { live.current = false; fileGeneration.current++ } }, [])
  useEffect(() => () => { if (audio) URL.revokeObjectURL(audio.url) }, [audio])
  useEffect(() => { if (!active) audioElement.current?.pause() }, [active])

  async function library() {
    const result = await adapter.execute('library')
    if (!live.current) return
    setRows(result.items || [])
    if (!selectedRef.current && result.items?.[0]) { selectedRef.current = result.items[0].request_id; setSelected(result.items[0].request_id) }
    if (result.skipped || result.truncated) setNotice('部分历史回执无法读取，或已达到作品库大小限制；本次列表不完整。')
  }
  async function checkCapabilities() {
    setCapError('')
    try { const result = await adapter.execute('capabilities'); if (!Array.isArray(result?.operations)) throw Error('无法识别音乐服务能力，请检查服务版本。'); if (live.current) setCapabilities(result) }
    catch (e) { if (live.current) { setCapabilities(null); setCapError((e as Error).message) } }
  }
  useEffect(() => { void library().catch(e => setError(e.message)); void checkCapabilities() }, [adapter])
  useEffect(() => {
    let stopped = false, timer: any
    async function poll() {
      if (stopped || !active || !item?.job_id) return
      if (document.hidden) { timer = setTimeout(poll, 5000); return }
      try {
        const latest = await adapter.execute('job', { job_id: item.job_id })
        if (!stopped && live.current) {
          setJobs(old => ({ ...old, [item.job_id]: latest }))
          if (isActive(latest.status)) timer = setTimeout(poll, 5000)
        }
      } catch (e) { if (!stopped) setError((e as Error).message) }
    }
    void poll()
    return () => { stopped = true; clearTimeout(timer) }
  }, [adapter, item?.job_id, active, pollEpoch])
  useEffect(() => {
    fileGeneration.current++; setFiles([]); setABC(''); setAudio(null); setSaved('')
  }, [selected, artifactJob])
  function choose(row: any) { selectedRef.current = row.request_id; setSelected(row.request_id); setCandidate(''); setPage('detail'); setError(''); setNotice('') }
  async function run(label: string, work: () => Promise<any>) {
    if (busy) return
    setBusy(label); setError('')
    try { await work() } catch (e) { if (live.current) setError((e as Error).message) }
    finally { if (live.current) setBusy('') }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitLock.current || attempt || !capabilities) return
    let args: any
    try { args = submission(form, crypto.randomUUID()) } catch (e) { setError((e as Error).message); return }
    submitLock.current = true; setBusy('提交中'); setError(''); setNotice('')
    try {
      const result = await adapter.execute('submit', args)
      if (!live.current) return
      setAttempt(true)
      const row = { request_id: args.request_id, title: form.title, operation: form.operation, input: args, created_at: new Date().toISOString(), parent_request_id: form.parent_request_id,
        job_id: result.job?.id, status: result.job?.status || 'unknown' }
      setRows(old => [row, ...old.filter(x => x.request_id !== row.request_id)])
      if (result.job) setJobs(old => ({ ...old, [result.job.id]: result.job }))
      choose(row)
      if (result.submission === 'unknown') setNotice('提交结果尚未确认，任务可能已在服务端开始。已保留请求编号，请核实后再创建新任务。')
      else if (result.warning) setNotice(result.warning)
    } catch (e) {
      // An RPC transport failure can happen after the Host accepted the request.
      // Keep this attempt blocked and recover via the local receipt, never POST again.
      if (live.current) { setAttempt(true); setError(`${(e as Error).message}\n请求编号：${args.request_id}。请刷新作品库核对回执；此按钮不会再次提交。`) }
    } finally { submitLock.current = false; if (live.current) setBusy('') }
  }
  function newWork(next = emptyForm()) { if (submitLock.current) return; setForm(next); setAttempt(false); setError(''); setNotice(''); setPage('create') }
  async function listArtifacts() {
    if (!artifactJob) throw Error('请先选择一个候选版本。')
    const generation = fileGeneration.current
    const result = await adapter.execute('artifacts', { job_id: artifactJob })
    if (generation === fileGeneration.current && live.current) setFiles(filenameRows(result))
  }
  async function download(name: string) {
    const generation = fileGeneration.current
    const result = await adapter.execute('download', { job_id: artifactJob, artifact: name })
    if (generation !== fileGeneration.current || !live.current) return
    setSaved(result.relativePath)
    if (!/\.(abc|wav|mp3|flac|ogg)$/i.test(name)) { setNotice('产物已保存到当前工作区。'); return }
    const preview = await adapter.preview(result.relativePath)
    if (generation !== fileGeneration.current || !live.current) return
    if (preview.encoding === 'utf8') setABC(preview.data)
    else {
      const bytes = Uint8Array.from(atob(preview.data), c => c.charCodeAt(0))
      setAudio({ url: URL.createObjectURL(new Blob([bytes], { type: preview.mime })), name })
    }
  }
  const supported = capabilities?.operations
  const knownOperations = Array.isArray(supported) ? supported.filter((s: string) => Object.hasOwn(modes, s)) : []
  const supportedMode = knownOperations.includes(form.operation)
  const filtered = rows.filter(row => `${row.title} ${row.input?.style || ''}`.toLowerCase().includes(filter.toLowerCase()))

  return <div className="ms-root"><style>{styles}</style>
    <header className="ms-header"><div className="ms-brand"><MusicIcon size={30}/><div><div className="ms-kicker">Create · Listen · Refine</div><h1>Music Studio <span className="ms-muted">音乐工作室</span></h1></div></div><span className="ms-header-tag">YuE2 · ECNU</span></header>
    {adapter.demo && <div className="ms-note">交互预览 · 示例数据，不调用线上模型。试听为本地合成旋律。</div>}
    <nav className="ms-nav" aria-label="音乐工作室视图">{[['create', '创作'], ['library', '作品库'], ['detail', '作品详情']].map(([key, label]) => <button key={key} aria-current={page === key ? 'page' : undefined} onClick={() => setPage(key)}>{label}</button>)}</nav>
    <div className="ms-grid">
      <section className="ms-pane ms-create" data-current={page === 'create'} aria-label="创作音乐">
        <div className="ms-pane-head"><div><div className="ms-step">01 / CREATE</div><h2>把灵感写成音乐</h2></div><button disabled={!!busy} onClick={() => newWork()}>新建</button></div>
        <form onSubmit={submit}>
          <fieldset disabled={!!busy || attempt} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><legend className="ms-muted" style={{ marginBottom: 8 }}>创作方式</legend>
          <div className="ms-modes">{Object.entries(modes).map(([key, mode]) => <button type="button" key={key} aria-pressed={form.operation === key} onClick={() => set('operation', key)}>{mode.label}</button>)}</div>
          <p className="ms-text">{modes[form.operation].hint}</p>
          <label className="ms-field">作品名称<input maxLength={120} value={form.title} onChange={e => set('title', e.target.value)} placeholder="给这次创作取个名字"/></label>
          {(form.operation === 'cover' || form.operation === 'transcribe') && <label className="ms-field">参考音频<input aria-label="参考音频" required value={form.audio} onChange={e => set('audio', e.target.value)} placeholder="例如 audio/reference.mp3"/><small>填写当前工作区内的音频路径，最大 39 MiB。可先在对话中提供文件，请助手放入工作区。</small></label>}
          {form.operation !== 'transcribe' ? <>
            <label className="ms-field">歌词<textarea aria-label="歌词" required maxLength={16000} rows={6} value={form.lyrics} onChange={e => set('lyrics', e.target.value)} placeholder={'[verse]\n写下第一句歌词…\n\n[chorus]\n让旋律从这里展开'}/></label>
            <label className="ms-field">风格与编曲<textarea aria-label="风格与编曲" required maxLength={2000} rows={4} value={form.style} onChange={e => set('style', e.target.value)} placeholder="音乐风格、演唱方式、乐器、情绪与语言…"/></label>
            <div className="ms-presets" aria-label="风格起点">{[['交响合唱', 'Mandarin Chinese symphonic choral music, mixed SATB choir, acoustic symphony orchestra, majestic and uplifting, clear diction, concert hall acoustics.'], ['校园民谣', 'Mandarin Chinese campus folk song, warm natural vocals, acoustic guitar and piano, gentle and hopeful.'], ['古典抒情', 'Mandarin Chinese classical lyrical song, expressive legato vocals, strings and piano, elegant and reflective.']].map(([label, value]) => <button type="button" key={label} onClick={() => set('style', value)}>{label}</button>)}</div>
          </> : <label className="ms-field">转谱范围<select aria-label="转谱范围" value={form.mode} onChange={e => set('mode', e.target.value)}><option value="full">完整转录</option><option value="melody">旋律转录</option></select></label>}
          {(form.operation === 'generate' || form.operation === 'plan') && <details open={!!form.abc}><summary>使用 ABC 乐谱作为创作条件</summary><label className="ms-field">ABC 乐谱<textarea aria-label="ABC 乐谱" className="ms-code" maxLength={64000} rows={7} value={form.abc} onChange={e => set('abc', e.target.value)} placeholder={'X:1\nT:我的旋律\nM:4/4\nL:1/4\nK:C\nC D E G | A G E2 |'}/></label>{form.abc && <Score abc={form.abc}/>}</details>}
          {form.operation !== 'transcribe' && <details><summary>生成设置 · {form.seed ? `Seed ${form.seed}` : '随机种子'}</summary>
            {(form.operation === 'generate' || form.operation === 'plan') && <div className="ms-inline"><label className="ms-field">候选数量<select aria-label="候选数量" value={form.operation === 'plan' ? '1' : form.n} disabled={form.operation === 'plan'} onChange={e => set('n', e.target.value)}><option value="1">1 首</option><option value="2">2 首候选</option></select></label><label className="ms-field">规划方式<select aria-label="规划方式" value={form.cot === 'off' && form.operation === 'plan' ? 'full' : form.cot} onChange={e => set('cot', e.target.value)}><option value="full">完整规划</option><option value="melody">旋律规划</option>{form.operation === 'generate' && <option value="off">关闭规划</option>}</select></label></div>}
            <label className="ms-field">随机种子 Seed<input aria-label="随机种子 Seed" inputMode="numeric" value={form.seed} onChange={e => set('seed', e.target.value)} placeholder="留空，每次随机"/><small>填写则使用指定值，0 也有效。</small></label>
            <label className="ms-field">引导强度<input type="number" min="0" max="20" step="any" value={form.cfg} onChange={e => set('cfg', e.target.value)} placeholder="使用服务默认值"/></label>
          </details>}
          </fieldset>
          {form.parent_request_id && <p className="ms-text">基于已有作品的新版本；提交会创建独立任务。</p>}
          <button className="ms-primary ms-submit" disabled={!!busy || attempt || !capabilities || !supportedMode} type="submit">{busy === '提交中' ? '正在提交…' : attempt ? '本次已提交 · 可新建版本' : modes[form.operation].action}</button>
          <p className="ms-submit-note">{!supportedMode ? '当前服务未开放此能力。' : '时长由模型与内容决定。生成结果与乐谱需要试听、校对。'}</p>
        </form>
        {capError ? <div className="ms-alert ms-error" role="alert">音乐服务尚未就绪：{capError}<p><button onClick={checkCapabilities}>重新连接</button></p></div> : !capabilities && <p className="ms-text" role="status">正在连接音乐服务…</p>}
      </section>
      <section className="ms-pane" data-current={page === 'library'} aria-label="作品库">
        <div className="ms-pane-head"><div><div className="ms-step">02 / LIBRARY</div><h2>我的作品 <span className="ms-muted">{rows.length}</span></h2></div><button disabled={!!busy} onClick={() => run('刷新', library)}>刷新</button></div>
        <input className="ms-search" aria-label="搜索作品" value={filter} onChange={e => setFilter(e.target.value)} placeholder="搜索名称、风格…"/>
        <div className="ms-list">{filtered.map(row => <button className="ms-track" key={row.request_id} aria-pressed={row.request_id === selected} onClick={() => choose(row)}><div className="ms-cover"><MusicIcon size={21}/></div><div className="ms-track-body"><div className="ms-track-title">{row.title || '未命名作品'}</div><div className="ms-track-meta">{modes[row.operation as Operation]?.label || row.operation} · {date(row.created_at)}{row.parent_request_id ? ' · 衍生版本' : ''}</div><span className="ms-status" data-status={jobs[row.job_id]?.status || row.status}>{statusName(jobs[row.job_id]?.status || row.status)}</span></div></button>)}</div>
        {!filtered.length && <div className="ms-empty">{filter ? '没有匹配的作品' : '第一首作品，从一句歌词开始。'}<p className="ms-text">当前工作区的创作记录会保存在这里。</p></div>}
      </section>
      <section className="ms-pane ms-detail" data-current={page === 'detail'} aria-label="作品详情">
        <div className="ms-step">03 / LISTEN & REFINE</div>
        {!item ? <div className="ms-empty"><MusicIcon size={40}/><h2 style={{ marginTop: 16 }}>听见灵感的另一种可能</h2><p className="ms-text">选择一首作品，试听音频、检查乐谱，<br/>或以它为起点创作新版本。</p></div> : <>
          <h2 className="ms-work-title">{item.title || '未命名作品'}</h2>
          <div className="ms-work-meta"><span className="ms-status" data-status={status}>{statusName(status)}</span><span className="ms-muted">{modes[item.operation as Operation]?.label} · {date(item.created_at)}</span></div>
          <div className="ms-toolbar"><button disabled={!!busy} onClick={() => newWork(fromItem(item))}>基于此创作</button>{item.job_id && <button disabled={!!busy} onClick={() => { setError(''); setPollEpoch(value => value + 1) }}>刷新状态</button>}{isActive(status) && <button disabled={!!busy} onClick={() => run('取消任务', async () => { await adapter.execute('cancel', { job_id: item.job_id }); const value = await adapter.execute('job', { job_id: item.job_id }); setJobs(old => ({ ...old, [item.job_id]: value })) })}>取消任务</button>}</div>
          {isActive(status) && <p className="ms-alert" role="status">{status === 'queued' ? '任务已进入队列。' : '模型正在创作。'} 本页会自动刷新；离开页面不会取消任务。</p>}
          {['unknown', 'truncated', 'partial_failed', 'failed'].includes(status) && <p className="ms-alert" role="status">{status === 'unknown' ? '提交结果待核实，请保留请求编号并检查服务端记录，避免重复提交。' : status === 'truncated' ? '模型输出已截断，请试听结尾，不能视为完整成品。' : status === 'partial_failed' ? '部分候选失败，请逐个检查可用版本。' : '本次任务失败。可查看任务详情；重新创作会创建新任务。'}</p>}
          {candidates.length > 0 && <div className="ms-candidates">{candidates.map((c, i) => { const key = typeof c === 'string' ? c : c.id; return <button key={key} aria-pressed={candidate === key} onClick={() => setCandidate(key)}>候选 {i + 1} · {statusName(c.status)}</button> })}</div>}
          <p className="ms-text">{item.input?.style}</p>
          <div className="ms-toolbar"><button disabled={!!busy || !artifactJob} onClick={() => run('读取产物', listArtifacts)}>查看可下载产物</button>{chosenJob?.seed != null && <span className="ms-muted">Seed {String(chosenJob.seed)}</span>}</div>
          <div className="ms-files">{files.map(name => <button key={name} disabled={!!busy} onClick={() => run(`下载 ${name}`, () => download(name))}>{name} ↓</button>)}</div>
          {audio && <div className="ms-audio"><div className="ms-muted">{adapter.demo ? '示例试听 · 本地合成' : '生成音频'} · {audio.name}</div><audio id={`${id}-audio`} controls preload="metadata" src={audio.url} ref={audioElement} onPlay={e => { document.querySelectorAll<HTMLAudioElement>('.ms-root audio').forEach(el => { if (el !== e.currentTarget) el.pause() }) }} onError={() => setError('此浏览器无法播放该音频，可在工作区打开原文件。')}/></div>}
          {saved && <p className="ms-text">{adapter.demo ? '示例路径（未写入磁盘）：' : '已保存：'}<span className="ms-id">{saved}</span>{adapter.openFile && <button style={{ marginLeft: 6 }} onClick={() => run('打开文件', () => adapter.openFile!(saved))}>打开文件</button>}</p>}
          {abc && <><div className="ms-score-label"><h3>五线谱</h3><span className="ms-muted">由 ABC 排版</span></div><Score abc={abc}/><p className="ms-text">这是乐谱预览；不代表已生成完整管弦乐总谱或完成音符校对。</p><details><summary>编辑 ABC</summary><label className="ms-field">乐谱内容<textarea aria-label="乐谱内容" rows={9} className="ms-code" maxLength={64000} value={abc} onChange={e => setABC(e.target.value)}/></label></details><div className="ms-toolbar"><button onClick={() => saveText('score.abc', abc, 'text/vnd.abc')}>导出 ABC</button><button disabled={!!busy} onClick={() => newWork({ ...fromItem(item), operation: 'generate', abc })}>用这份谱创作</button></div></>}
          {item.input?.lyrics && <details open={!abc && !audio}><summary>歌词</summary><div className="ms-lyrics">{item.input.lyrics}</div></details>}
          {job?.warnings?.length > 0 && <p className="ms-alert">{Array.isArray(job.warnings) ? job.warnings.map((w: any) => typeof w === 'string' ? w : JSON.stringify(w)).join('\n') : String(job.warnings)}</p>}
          <details><summary>任务详情与请求编号</summary><div className="ms-id">Request: {item.request_id}<br/>Job: {item.job_id || '待核实'}{item.parent_request_id && <><br/>来源: {item.parent_request_id}</>}</div>{job && <pre className="ms-code" style={{ maxHeight: 240 }}>{JSON.stringify(job, null, 2)}</pre>}</details>
        </>}
      </section>
    </div>
    {(error || notice || busy) && <div style={{ flexShrink: 0, maxHeight: '25%', overflow: 'auto', padding: '0 14px 12px' }}><div className={`ms-alert ${error ? 'ms-error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice || `${busy}…`}</div></div>}
  </div>
}
