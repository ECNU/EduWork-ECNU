import { randomUUID } from 'node:crypto'
import { realpath } from 'node:fs/promises'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { previewMusic } from './library.js'

const initializers = []
const actions = new Set(['capabilities', 'library', 'submit', 'job', 'artifacts', 'download', 'cancel'])
export class MusicStudio extends TypertRemoteService {
  static inject = ['tools', 'agents', 'fs']
  constructor(ctx) {
    super(ctx, 'ecnuMusicStudio')
    for (const initialize of initializers) initialize.call(this)
    this.abort = new AbortController()
    ctx.effect(() => () => this.abort.abort())
  }
  async agent(sessionId) {
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 256) throw Error('Invalid music session')
    const agent = await this.ctx.agents.get(sessionId)
    if (!agent?.session?.header?.cwd) throw Error('请先打开带工作区的对话，再使用音乐工作室')
    return agent
  }
  async execute(sessionId, action, argumentsJSON) {
    if (!actions.has(action)) throw Error('Unsupported music action')
    if (typeof argumentsJSON !== 'string' || argumentsJSON.length > 300000) throw Error('Invalid music arguments')
    const args = JSON.parse(argumentsJSON)
    if (!args || Array.isArray(args) || typeof args !== 'object') throw Error('Music arguments must be an object')
    const agent = await this.agent(sessionId)
    // Never call tool.execute directly: keep the native approval / sandbox /
    // audit pipeline shared with conversational calls.
    const result = await this.ctx.tools.execute({ callId: randomUUID(), agent,
      signal: this.abort.signal, name: `ecnu_music_${action}`, arguments: args })
    if (result.isError) throw Error(result.error?.message || '音乐工具调用失败')
    if (typeof result.value?.reportJSON !== 'string') throw Error('Invalid music tool response')
    return result.value.reportJSON
  }
  async preview(sessionId, relativePath) {
    const agent = await this.agent(sessionId)
    const locator = await this.ctx.fs.resolve('.', { cwd: agent.session.header.cwd, signal: this.abort.signal })
    const root = await realpath(this.ctx.fs.processPath(locator))
    return JSON.stringify(await previewMusic(root, relativePath))
  }
}
for (const method of ['execute', 'preview']) Remote(method)(MusicStudio.prototype[method], {
  kind: 'method', name: method, static: false, private: false, addInitializer(initialize) { initializers.push(initialize) },
})
