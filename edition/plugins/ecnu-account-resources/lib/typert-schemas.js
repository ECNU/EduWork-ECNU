import { z } from 'zod'
const pkg = '@chatecnu-work/dsh-ecnu-account-resources'
const nullableNumber = z.number().nonnegative().nullable()
const strict = (name, schema) => ({ mode: 'strict', typeSymbol: `${pkg}#${name}`, schema })
export const configurationResult = strict('Configuration', z.object({ profileIDs: z.array(z.string().max(64)).max(64) }).strict())
export const quotaResult = strict('Quota', z.object({
  state: z.enum(['available', 'unavailable', 'not_connected', 'not_configured']),
  providerID: z.string().optional(), unit: z.string().optional(), consoleURL: z.string().url().optional(),
  windows: z.array(z.object({ type: z.string(), limit: nullableNumber, used: nullableNumber, remaining: nullableNumber, resetAt: z.string().nullable() }).strict()).max(64).optional(),
  resourcePacks: z.array(z.object({ id: z.string(), name: z.string(), total: nullableNumber, used: nullableNumber, remaining: nullableNumber, expiresAt: z.string().nullable(), status: z.string() }).strict()).max(256).optional(),
}).strict())
export const descriptors = [
  ['configuration', [], configurationResult],
  ['quota', [{ name: 'profileID', wire: 'profileID', source: 'json', codec: { mode: 'strict', schema: z.string().min(1).max(64), typeSymbol: `${pkg}#ProfileID` } }], quotaResult],
].map(([method, parameters, result]) => ({ id: `${pkg}#ecnuAccountResources/${method}`, service: 'ecnuAccountResources', namespace: 'ecnuAccountResources', method,
  invocation: { kind: 'direct' }, parameters, result, sourceLocation: { file: 'lib/index.js', line: 1, column: 1 } }))
