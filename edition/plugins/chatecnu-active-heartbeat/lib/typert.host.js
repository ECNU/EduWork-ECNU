import { z } from 'zod'
const pkg = '@chatecnu-work/dsh-chatecnu-active-heartbeat'
export const TYPERT = {
  package: pkg, face: 'host', schemas: [],
  invocations: [{
    id: `${pkg}#chatecnuActiveHeartbeat/presence`, service: 'chatecnuActiveHeartbeat', namespace: 'chatecnuActiveHeartbeat', method: 'presence',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: { mode: 'strict', typeSymbol: `${pkg}#Presence`, schema: z.string().max(1024) } }],
    result: { mode: 'strict', typeSymbol: `${pkg}#Status`, schema: z.string().max(128) },
    sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
  }],
  model: { services: [], events: [], objects: [] },
}
