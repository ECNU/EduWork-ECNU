import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { createFeedbackService } from './service.js'
export const name = 'ecnu-feedback'
const initializers = []
export class EcnuFeedback extends TypertRemoteService {
  static inject = ['oidcAccounts', 'sessions', 'sessionPersistence']
  constructor(ctx, config) {
    super(ctx, 'ecnuFeedback')
    for (const initialize of initializers) initialize.call(this)
    this.feedback = createFeedbackService(ctx, config)
  }
  configuration() { return Promise.resolve(this.feedback.configuration()) }
  preview(sessionId, messageId) { return this.feedback.preview(sessionId, messageId) }
  read(sessionId, messageId) { return this.feedback.read(sessionId, messageId) }
  submit(sessionId, messageId, action) { return this.feedback.submit(sessionId, messageId, action) }
}
for (const method of ['configuration', 'preview', 'read', 'submit']) Remote(method)(EcnuFeedback.prototype[method], { kind: 'method', name: method, static: false, private: false, addInitializer(initialize) { initializers.push(initialize) } })
export default EcnuFeedback
