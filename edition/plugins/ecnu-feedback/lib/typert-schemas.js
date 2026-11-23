import { z } from 'zod'
const pkg = '@chatecnu-work/dsh-ecnu-feedback'
const codec = (name, schema) => ({ mode: 'strict', typeSymbol: `${pkg}#${name}`, schema, create: () => schema })
const id = codec('ID', z.string().regex(/^[A-Za-z0-9_-]{1,256}$/))
const state = z.enum(['available', 'ineligible', 'too_large', 'unavailable', 'not_connected', 'permission_denied', 'authorization_required', 'preview_changed'])
const preview = codec('Preview', z.object({ state, question: z.string().max(50000).optional(), answer: z.string().max(100000).optional(), digest: z.string().length(64).optional() }).strict())
const result = codec('Rating', z.object({ state, favorite: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(), accountID: z.string().max(128).optional() }).strict())
const action = codec('Action', z.object({ favorite: z.union([z.literal(-1), z.literal(0), z.literal(1)]), confirmed: z.literal(true), digest: z.string().length(64), accountID: z.string().min(1).max(128), reason: z.array(z.string().max(80)).max(20), desc: z.string().max(1000) }).strict())
const args = ['sessionId', 'messageId'].map(name => ({ name, wire: name, source: 'json', codec: id }))
export const descriptors = [
  ['configuration', [], codec('Config', z.object({ profileID: z.string(), reasons: z.array(z.string()) }).strict())],
  ['preview', args, preview], ['read', args, result], ['submit', [...args, { name: 'action', wire: 'action', source: 'json', codec: action }], result],
].map(([method, parameters, result]) => ({ id: `${pkg}#ecnuFeedback/${method}`, service: 'ecnuFeedback', namespace: 'ecnuFeedback', method, invocation: { kind: 'direct' }, parameters, result, sourceLocation: { file: 'lib/index.js', line: 1, column: 1 } }))
