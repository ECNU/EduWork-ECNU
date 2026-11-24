import { z } from 'zod'
const pkg = '@chatecnu-work/dsh-ecnu-account-resources'
const nullableNumber = z.number().nonnegative().nullable()
// Keep schema for 0.1.5 and provide the codec factory required by 0.1.7.
const strict = (name, schema) => ({ mode: 'strict', typeSymbol: `${pkg}#${name}`, schema, create: () => schema })
export const configurationResult = strict('Configuration', z.object({ profileIDs: z.array(z.string().max(64)).max(64), pointsProfileID: z.string().max(64).nullable().optional() }).strict())
const serviceState = z.enum(['available', 'unavailable', 'not_connected', 'not_configured', 'permission_denied', 'expired'])
export const pointsResult = strict('Points', z.object({ state: serviceState, currentPoints: z.number().nonnegative().optional(), nextExpiryAt: z.string().nullable().optional(), nextExpiryPoints: nullableNumber.optional(), expiryNotice: z.string().max(2000).optional() }).strict())
export const invitationResult = strict('Invitation', z.object({ state: serviceState, referralCode: z.string().max(256).optional(), expiresAt: z.string().optional(), inviteURL: z.string().url().max(4096).optional() }).strict())
export const quotaResult = strict('Quota', z.object({
  state: z.enum(['available', 'unavailable', 'not_connected', 'not_configured']),
  providerID: z.string().optional(), unit: z.string().optional(), consoleURL: z.string().url().optional(),
  windows: z.array(z.object({ type: z.string(), limit: nullableNumber, used: nullableNumber, remaining: nullableNumber, resetAt: z.string().nullable() }).strict()).max(64).optional(),
  resourcePacks: z.array(z.object({ id: z.string(), name: z.string(), total: nullableNumber, used: nullableNumber, remaining: nullableNumber, expiresAt: z.string().nullable(), status: z.string() }).strict()).max(256).optional(),
}).strict())
export const descriptors = [
  ['configuration', [], configurationResult],
  ['quota', [{ name: 'profileID', wire: 'profileID', source: 'json', codec: strict('ProfileID', z.string().min(1).max(64)) }], quotaResult],
  ...[['points', pointsResult], ['invitation', invitationResult]].map(([method, result]) => [method, [{ name: 'profileID', wire: 'profileID', source: 'json', codec: strict('ProfileID', z.string().min(1).max(64)) }], result]),
].map(([method, parameters, result]) => ({ id: `${pkg}#ecnuAccountResources/${method}`, service: 'ecnuAccountResources', namespace: 'ecnuAccountResources', method,
  invocation: { kind: 'direct' }, parameters, result, sourceLocation: { file: 'lib/index.js', line: 1, column: 1 } }))
