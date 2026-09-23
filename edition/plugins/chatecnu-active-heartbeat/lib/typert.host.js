import { z } from 'zod'
const pkg = '@chatecnu-work/dsh-chatecnu-active-heartbeat'
// Both Host generations use the same constraints; 0.1.7 requires a factory.
const strict = (name, schema) => ({ mode: 'strict', typeSymbol: `${pkg}#${name}`, schema, create: () => schema })
export const TYPERT = {
  package: pkg, face: 'host', schemas: [],
  invocations: [{
    id: `${pkg}#chatecnuActiveHeartbeat/presence`, service: 'chatecnuActiveHeartbeat', namespace: 'chatecnuActiveHeartbeat', method: 'presence',
    invocation: { kind: 'direct' },
    parameters: [{ name: 'request', wire: 'request', source: 'json', codec: strict('Presence', z.string().max(1024)) }],
    result: strict('Status', z.string().max(128)),
    sourceLocation: { file: 'lib/index.js', line: 1, column: 1 },
  }],
  model: { services: [], events: [], objects: [] },
}
