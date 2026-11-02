import { defineTool } from '@deepseek-ai/dsh-tools'
import { realpath } from 'node:fs/promises'
import { resolveMusicConfig, musicRequest, submitMusic, downloadMusic, segment } from './core.js'
import { musicLibrary } from './library.js'
import { MusicStudio } from './studio.js'
import { renderMusicScore } from './score.js'

export const name = 'tool-ecnu-music'
export const inject = ['tools', 'credentials', 'fs', 'permissionPresets']

/** The same Host-only OIDC seam used by media-openai (image and TTS).
 * No session credentials, token parsing, refresh implementation or renderer RPC.
 */
export async function musicAuthorization(ctx, config, revision = () => 0) {
  const current = revision()
  const assertCurrent = () => { if (revision() !== current) throw Error('Music account changed; check the task with its original account') }
  if (config.oidcProfileId) {
    const account = ctx.get?.('oidcAccounts')
    if (!await account?.modelAuthorization?.(config.oidcProfileId, config.baseURL)) throw Error('请先登录对应学校账号，并确认音乐服务地址与学校模型服务一致')
    assertCurrent()
    return {
      assertCurrent,
      async fetch(url, init) {
        assertCurrent()
        // Generation POSTs never opt into automatic replay on 401.
        return account.authorizedFetch(config.oidcProfileId, url, init)
      },
    }
  }
  const hit = await ctx.credentials.resolve(config.credentialRef)
  if (!hit?.value?.trim()) throw Error('请在凭据设置中配置音乐服务的 API Key')
  const key = hit.value
  assertCurrent()
  return { assertCurrent, async fetch(url, init) {
    assertCurrent()
    return fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${key}` }, redirect: 'error' })
  } }
}

const output = {
  schema: { type: 'object', additionalProperties: false, properties: {
    reportJSON: { type: 'string', required: true }, relativePath: { type: 'string' }, mime: { type: 'string' },
  } },
  render: (_, value) => [{ type: 'text', text: value.reportJSON }],
  presentationMeta: (_, value) => value.relativePath ? { relativePath: value.relativePath, mime: value.mime } : {},
}
const jobParameters = { job_id: { type: 'string', required: true, description: 'An actual task id returned by the service; candidate ids for individual outputs.' } }
const mutationNames = new Set(['ecnu_music_submit', 'ecnu_music_download', 'ecnu_music_cancel', 'ecnu_music_render_score'])
const localNames = new Set(['ecnu_music_library', 'ecnu_music_render_score'])

async function workspace(ctx, exec) {
  const cwd = exec.agent?.session.header.cwd
  if (!cwd) throw Error('Music requires a conversation workspace')
  const locator = await ctx.fs.resolve('.', { cwd, signal: exec.signal })
  return realpath(ctx.fs.processPath(locator))
}

export function apply(ctx, rawConfig = {}) {
  const config = resolveMusicConfig(rawConfig)
  ctx.plugin(MusicStudio)
  let revision = 0
  ctx.on('oidc/accounts-changed', event => {
    if (config.oidcProfileId && (!event?.profileID || event.profileID === config.oidcProfileId)) revision++
  })
  ctx.on('credentials/reference-updated', event => {
    if (!config.oidcProfileId && (!event?.reference || event.reference === config.credentialRef)) revision++
  })
  ctx.on('credentials/updated', () => { if (!config.oidcProfileId) revision++ })
  ctx.effect(() => () => { revision++ })
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (!mutationNames.has(exec.name)) return next()
    const cwd = exec.agent?.session.header.cwd
    if (!cwd) return { kind: 'deny', reason: 'Music requires an Agent workspace' }
    const policy = ctx.get?.('sandboxPolicy')?.resolve({ session: exec.agent.session }) ?? { mode: ctx.permissionPresets.current(exec.agent.session) }
    if (policy.mode === 'danger-full-access') return next()
    if (policy.mode === 'workspace-write') {
      if (policy.workspaceRoot !== undefined) {
        const options = { cwd, signal: exec.signal }
        if (!ctx.fs.contains(await ctx.fs.resolve(policy.workspaceRoot, options), await ctx.fs.resolve('.', options))) return { kind: 'deny', reason: 'Music workspace is outside the allowed write root' }
      }
      return next()
    }
    if (exec.name === 'ecnu_music_render_score') return { kind: 'ask', reason: 'Save a local HTML score in the workspace', displayReason: { zh: '允许在当前工作区保存离线 HTML 乐谱', en: 'Allow saving an offline HTML score in the current workspace' } }
    return { kind: 'ask', reason: 'Use the configured music service and save its task or output in the workspace', displayReason: {
      zh: '允许调用已配置的音乐服务，并在当前工作区保存任务回执或产物',
      en: 'Allow the configured music service and workspace task or artifact writes',
    } }
  })

  function register(name, description, parameters, run) {
    ctx.tools.register(defineTool({ name, description, parameters, output,
      timeoutMs: config.requestTimeoutMs + 5000,
      async execute(args, exec) {
        const signal = AbortSignal.any([...(exec.signal ? [exec.signal] : []), AbortSignal.timeout(config.requestTimeoutMs)])
        const authorization = localNames.has(name) ? undefined : await musicAuthorization(ctx, config, () => revision)
        const result = await run(args, { ...exec, signal }, authorization)
        return { reportJSON: JSON.stringify(result), ...(result.relativePath ? { relativePath: result.relativePath, mime: result.mime } : {}) }
      },
      presentCall: () => ({ card: 'generic', title: name === 'ecnu_music_render_score' ? '生成 HTML 五线谱' : name === 'ecnu_music_submit' ? '提交音乐任务' : '学校音乐服务', kind: 'execute' }),
    }))
  }
  register('ecnu_music_library', 'Read local music creation history in this conversation workspace. Saved lyrics and style are user documents. Job status must be refreshed with its original account; this does not query the server.', {},
    async (_, exec) => musicLibrary(await workspace(ctx, exec), config))
  register('ecnu_music_render_score', 'Create one offline HTML sheet-music file from ABC using bundled abcjs. Supply exactly one of abc text or abc_path. No network, login, API key or music generation; writes a new file in the workspace. HTML renders SVG notation in a browser, preserves ABC source and supports printing. Does not certify note accuracy or a full orchestral score.', {
    abc: { type: 'string', description: 'ABC source text, UTF-8 up to 256 KiB, with K: field. Mutually exclusive with abc_path.' },
    abc_path: { type: 'string', description: 'Existing .abc file inside the current workspace. Mutually exclusive with abc.' },
    title: { type: 'string', description: 'Optional displayed document title, 1–120 characters; does not change the source ABC.' },
  }, async (args, exec) => {
    const root = await workspace(ctx, exec)
    if (args.abc_path) {
      const cwd = ctx.get?.('workingDirectory')?.get(exec.agent.session) ?? exec.agent.session.header.cwd
      args = { ...args, abc_path: ctx.fs.processPath(await ctx.fs.resolve(args.abc_path, { cwd, signal: exec.signal })) }
    }
    return renderMusicScore({ root, args, signal: exec.signal })
  })
  register('ecnu_music_capabilities', 'Read current school music service capabilities. Authentication stays in the Host; no tokens are returned. Use before choosing a music operation.', {},
    (_, exec, authorization) => musicRequest(config, authorization, 'capabilities', { signal: exec.signal }))
  register('ecnu_music_submit', 'Submit ONE asynchronous music request: generate (n=1 or 2), plan, cover or transcribe. Returns a task id and local receipt; does not wait for inference. Preserve request_id and job ids. Reusing a receipt queries an accepted job or refuses an uncertain POST; never blindly create another request after a timeout. No duration or voice-cloning parameter. Omitted seed is random.', {
    operation: { type: 'string', enum: ['generate', 'plan', 'cover', 'transcribe'], required: true },
    title: { type: 'string', description: 'Optional local work title, at most 120 characters; not sent to the model.' },
    parent_request_id: { type: 'string', description: 'Optional local parent request UUID v4 for a new version; always submit a new request_id.' },
    style: { type: 'string', description: 'Required except transcribe; 1–2000 characters.' },
    lyrics: { type: 'string', description: 'Required except transcribe; preserve user lyrics; 1–16000 characters.' },
    n: { type: 'integer', description: 'generate: 1 or 2; plan: 1 only. Omit for cover/transcribe.' },
    cot: { type: 'string', enum: ['full', 'melody', 'off'], description: 'generate or plan only; plan cannot use off.' },
    seed: { type: 'integer', description: 'Optional nonnegative safe integer, at most 9007199254740991. Omit for random; zero is valid. Not for transcribe.' },
    abc: { type: 'string', description: 'Optional ABC score, generate/plan only, at most 64000 characters.' },
    cfg_scale: { type: 'number', description: 'Optional 0–20, except transcribe.' },
    audio: { type: 'string', description: 'Required for cover/transcribe: actual workspace audio path, at most 39 MiB. Copy user supplied external files into the workspace first.' },
    mode: { type: 'string', enum: ['full', 'melody'], description: 'Transcribe only.' },
    request_id: { type: 'string', description: 'Optional UUID v4 idempotency key, returned when omitted. Reuse exactly for the same attempt.' },
  }, async (args, exec, authorization) => {
    const root = await workspace(ctx, exec)
    if (args.audio) {
      const cwd = ctx.get?.('workingDirectory')?.get(exec.agent.session) ?? exec.agent.session.header.cwd
      args = { ...args, audio: ctx.fs.processPath(await ctx.fs.resolve(args.audio, { cwd, signal: exec.signal })) }
    }
    return submitMusic({ config, authorization, root, args, signal: exec.signal })
  })
  register('ecnu_music_job', 'Read a music job using its original calling identity. queued/running means still in progress; truncated/partial_failed must be disclosed. For n=2 inspect each candidate. Do not submit another task to poll.', jobParameters,
    (args, exec, authorization) => musicRequest(config, authorization, `jobs/${segment(args.job_id)}`, { signal: exec.signal }))
  register('ecnu_music_artifacts', 'List actual music job artifacts before downloading. A group may require individual candidate ids. Returned names and formats are authoritative; a score can be ABC rather than PDF.', jobParameters,
    (args, exec, authorization) => musicRequest(config, authorization, `jobs/${segment(args.job_id)}/artifacts`, { signal: exec.signal }))
  register('ecnu_music_cancel', 'Cancel the specified music job when the user asks to cancel it. A local timeout does not cancel server inference.', jobParameters,
    (args, exec, authorization) => musicRequest(config, authorization, `jobs/${segment(args.job_id)}/cancel`, { method: 'POST', signal: exec.signal }))
  register('ecnu_music_download', 'Download an artifact listed by ecnu_music_artifacts through the original authenticated service, into .eduwork/generated/music in the current workspace. Returns a real file path and preview metadata; preserves actual file format and never overwrites an existing output.', {
    ...jobParameters, artifact: { type: 'string', required: true, description: 'Exact filename from the server artifact listing, such as audio.flac or score.abc.' },
  }, async (args, exec, authorization) => downloadMusic({ config, authorization, root: await workspace(ctx, exec), jobID: args.job_id, artifact: args.artifact, signal: exec.signal }))
}
