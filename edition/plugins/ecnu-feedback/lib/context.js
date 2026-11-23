import { createHash } from 'node:crypto'
import { deriveEventMessage, isAppendSurfaceEvent } from '@deepseek-ai/dsh-session/surface'
export const validID = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value)
const visibleText = message => message.content.filter(block => block.type === 'text' && typeof block.text === 'string').map(block => block.text).join('\n')
/** Read append-origin transcript text, never model context, tool results or reasoning. */
export function feedbackTarget(events, sessionID, messageID, providerID) {
  let question = '', candidate, turn, closed = false
  for (const event of events) {
    if (event.type === 'turn/start') { turn = event.data.turn; candidate = undefined; closed = false }
    if (event.type === 'user/message' && isAppendSurfaceEvent(event)) {
      const message = deriveEventMessage(event)
      if (message?.source?.kind === 'user') question = visibleText(message)
    }
    if (event.type === 'assistant/message' && isAppendSurfaceEvent(event)) {
      const message = deriveEventMessage(event)
      if (message && visibleText(message).trim()) candidate = { message, question, turn: event.data.turn }
    }
    if (event.type === 'turn/end' && event.data.turn === turn) {
      closed = event.data.reason?.kind === 'completed'
      if (candidate?.message.id !== messageID) continue
      const { message } = candidate
      if (!closed || candidate.turn !== turn || message.source?.kind !== 'model' || message.source.provider !== providerID || message.content.some(block => block.type === 'tool-call')) return { state: 'ineligible' }
      const answer = visibleText(message)
      if (!candidate.question.trim()) return { state: 'ineligible' }
      if (candidate.question.length > 50000 || answer.length > 100000) return { state: 'too_large' }
      const digest = createHash('sha256').update(JSON.stringify([sessionID, messageID, candidate.question, answer])).digest('hex')
      return { state: 'available', question: candidate.question, answer, digest }
    }
  }
  return { state: 'ineligible' }
}
export async function readFeedbackTarget(ctx, sessionID, messageID, providerID) {
  if (!validID(sessionID) || !validID(messageID)) return { state: 'ineligible' }
  const live = ctx.sessions.get(sessionID)
  if (live) return feedbackTarget(live.snapshotEvents(), sessionID, messageID, providerID)
  if (!await ctx.sessionPersistence.stat(sessionID)) return { state: 'ineligible' }
  const handle = await ctx.sessionPersistence.open(sessionID, 'read')
  try { return feedbackTarget((await handle.read()).events, sessionID, messageID, providerID) }
  finally { await handle.close() }
}
