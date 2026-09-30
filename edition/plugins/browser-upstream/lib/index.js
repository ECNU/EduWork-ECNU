import { statSync } from 'node:fs'
import * as PlaywrightBrowser from '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp'

export const name = 'ecnu-browser-upstream'
export const inject = [...PlaywrightBrowser.inject, 'sandboxPolicy']

// Only bind the relocatable desktop resource. Browser tools, session ownership,
// MCP transport and navigation are all implemented by the official provider.
export function browserConfig(raw = {}, environment = process.env) {
  if (raw.headless !== undefined && typeof raw.headless !== 'boolean') throw new Error('browser headless must be a boolean')
  const executablePath = raw.executablePath || environment.DSH_MEDIA_BROWSER
  if (typeof executablePath !== 'string' || !statSync(executablePath, { throwIfNoEntry: false })?.isFile()) throw new Error('The bundled Chromium is missing; restore the complete EduWork package')
  const toolCallTimeoutMs = raw.toolCallTimeoutMs ?? 120000
  if (!Number.isSafeInteger(toolCallTimeoutMs) || toolCallTimeoutMs < 1000 || toolCallTimeoutMs > 300000) throw new Error('browser toolCallTimeoutMs must be between 1000 and 300000')
  return { mode: 'launch', headless: raw.headless ?? true, executablePath, toolCallTimeoutMs }
}

export function apply(ctx, config = {}) {
  ctx.on('tools/pre-execute', (exec, next) => {
    if (exec.name !== 'mcp__playwright-mcp__browser_run_code_unsafe') return next()
    if (exec.agent && ctx.sandboxPolicy.resolve({ session: exec.agent.session }).mode === 'danger-full-access') return next()
    return { kind: 'deny', reason: 'Browser host code requires full access. Use the regular browser tools for page navigation and interaction.' }
  })
  return ctx.plugin(PlaywrightBrowser, browserConfig(config))
}
