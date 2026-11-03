import { z } from 'zod'
const pkg = '@chatecnu-work/dsh-tool-ecnu-music'
const codec = (name, schema) => ({ mode: 'strict', typeSymbol: `${pkg}#${name}`, schema, create: () => schema })
const parameter = (name, max) => ({ name, wire: name, source: 'json', codec: codec(name, z.string().min(1).max(max)) })
export const descriptors = [
  ['execute', [parameter('sessionId', 256), parameter('action', 32), parameter('argumentsJSON', 300000)]],
  ['preview', [parameter('sessionId', 256), parameter('relativePath', 512)]],
].map(([method, parameters]) => ({ id: `${pkg}#ecnuMusicStudio/${method}`, service: 'ecnuMusicStudio', namespace: 'ecnuMusicStudio', method,
  invocation: { kind: 'direct' }, parameters, result: codec(`${method}Result`, z.string()),
  sourceLocation: { file: 'lib/studio.js', line: 1, column: 1 } }))
