import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { PersistentVisionEvidenceStore } from '../lib/evidence-store.js'

test('persistent evidence survives a new store instance', async () => {
  const temporary = resolve(await mkdtemp(join(tmpdir(), 'chatecnu-vision-evidence-')))
  try {
    const first = new PersistentVisionEvidenceStore(temporary)
    await first.write('attachment+model+policy', '持久视觉证据', { attachmentId: 'image-1' })

    const second = new PersistentVisionEvidenceStore(temporary)
    assert.equal(await second.read('attachment+model+policy'), '持久视觉证据')
    assert.equal(await second.read('different-key'), undefined)
  } finally {
    // The target is the explicit absolute directory returned by mkdtemp.
    await rm(temporary, { recursive: true, force: true })
  }
})
