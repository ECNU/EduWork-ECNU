// Test-only resolution against the exact assembled product, never an adjacent
// checkout's node_modules. This module is not part of the shipped plugins.
import { registerHooks } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
if (!process.env.EDUWORK_TEST_RUNTIME) throw Error('Set EDUWORK_TEST_RUNTIME to the assembled product d directory')
const runtime = pathToFileURL(resolve(process.env.EDUWORK_TEST_RUNTIME, 'package.json')).href
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@eduwork/dsh-academic-calendar') && process.env.EDUWORK_CORE_ROOT) {
    const name = specifier === '@eduwork/dsh-academic-calendar' ? 'index' : specifier.split('/').pop()
    return { url: pathToFileURL(resolve(process.env.EDUWORK_CORE_ROOT, 'packages/dsh-academic-calendar/lib', name + '.js')).href, shortCircuit: true }
  }
  if (specifier.startsWith('@deepseek-ai/') || specifier.startsWith('@eduwork/') || specifier === 'zod') return next(specifier, { ...context, parentURL: runtime })
  return next(specifier, context)
} })
