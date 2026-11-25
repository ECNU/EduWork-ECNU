import { z } from 'zod'
const pkg = '@chatecnu-work/dsh-ecnu-cloud'
const codec = (name, schema) => ({ mode: 'strict', typeSymbol: `${pkg}#${name}`, schema, create: () => schema })
const id = z.string().min(1).max(256)
const summary = z.object({ conversationID: id, title: z.string().max(300), updatedAt: z.number(), projectID: id.nullable() }).strict()
const message = z.object({ messageID: id, role: z.enum(['user', 'assistant', 'unsupported']), text: z.string().max(1048576), at: z.number(), supported: z.boolean() }).strict()
const input = codec('Input', z.object({ lease: z.string().uuid(), page: z.number().int().min(1).max(10000).optional(), conversationID: id.optional() }).strict())
const result = codec('Result', z.object({ state: z.string().max(64), lease: z.string().uuid().optional(), items: z.array(summary).max(20).optional(), page: z.number().int().optional(), hasMore: z.boolean().optional(), summary: summary.optional(), messages: z.array(message).max(1000).optional(), importable: z.boolean().optional(), total: z.number().int().optional() }).strict())
const importInput = codec('ImportInput', z.object({ lease: z.string().uuid(), conversationID: id, workspaceID: id.optional(), snapshot: z.string().length(64).optional(), rememberProject: z.boolean().optional() }).strict())
const importResult = codec('ImportResult', z.object({ state: z.string().max(64), bindingState: z.string().max(64).optional(), sessionID: id.optional(), workspaceID: id.optional(), pending: z.boolean().optional(), rememberProject: z.boolean().optional(), projectID: id.nullable().optional(), reused: z.boolean().optional() }).strict())
export const descriptors = ['cloudState', 'cloudList', 'cloudPreview', 'cloudDestination', 'cloudImport'].map(method => ({
  id: `${pkg}#ecnuCloud/${method}`, service: 'ecnuCloud', namespace: 'ecnuCloud', method, invocation: { kind: 'direct' },
  ...(method === 'cloudImport' ? { cancellation: { parameter: 'signal' } } : {}),
  parameters: method === 'cloudState' ? [] : [{ name: 'input', wire: 'input', source: 'json', codec: ['cloudDestination', 'cloudImport'].includes(method) ? importInput : input }], result: ['cloudDestination', 'cloudImport'].includes(method) ? importResult : method === 'cloudPreview' ? codec('Preview', result.schema.extend({ snapshot: z.string().length(64).optional() })) : result,
  sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
}))
