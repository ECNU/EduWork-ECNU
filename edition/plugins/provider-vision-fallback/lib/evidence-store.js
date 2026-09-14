import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const SCHEMA_VERSION = 1

function fileName(key) {
  return `${createHash('sha256').update(key).digest('hex')}.json`
}

function recordOf(key, analysis, metadata) {
  return {
    schemaVersion: SCHEMA_VERSION,
    key,
    analysis,
    metadata,
    createdAt: new Date().toISOString(),
  }
}

function validRecord(value, key) {
  return value?.schemaVersion === SCHEMA_VERSION && value.key === key &&
    typeof value.analysis === 'string' && value.analysis.length > 0
}

/**
 * Best-effort persistent cache for immutable attachment derivatives. Failures
 * never block a model request: the in-memory result remains usable and a
 * later request may regenerate the evidence.
 */
export class PersistentVisionEvidenceStore {
  constructor(root, logger) {
    if (typeof root !== 'string' || root.length === 0) throw new Error('vision evidence root must be a non-empty path')
    this.root = root
    this.logger = logger
  }

  pathFor(key) {
    return join(this.root, fileName(key))
  }

  warn(message, error) {
    this.logger?.warn?.(`provider-vision-fallback: ${message}`, { error })
  }

  async read(key) {
    try {
      const parsed = JSON.parse(await readFile(this.pathFor(key), 'utf8'))
      if (!validRecord(parsed, key)) {
        this.warn('ignored an invalid persisted vision-evidence record')
        return undefined
      }
      return parsed.analysis
    } catch (error) {
      if (error?.code !== 'ENOENT') this.warn('could not read persisted vision evidence', error)
      return undefined
    }
  }

  async write(key, analysis, metadata = {}) {
    const target = this.pathFor(key)
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`
    try {
      await mkdir(this.root, { recursive: true, mode: 0o700 })
      await writeFile(temporary, `${JSON.stringify(recordOf(key, analysis, metadata))}\n`, {
        encoding: 'utf8', flag: 'wx', mode: 0o600,
      })
      await rename(temporary, target)
    } catch (error) {
      try {
        await unlink(temporary)
      } catch (cleanupError) {
        if (cleanupError?.code !== 'ENOENT') this.warn('could not remove a temporary vision-evidence file', cleanupError)
      }
      this.warn('could not persist vision evidence', error)
    }
  }
}
