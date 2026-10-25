import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const core = process.env.EDUWORK_CORE_ROOT
if (!core) throw new Error('Set EDUWORK_CORE_ROOT to the pinned public core checkout')
const { validateMacUpdateConfig } = await import(pathToFileURL(resolve(core, 'scripts/macos-update-feed.mjs')))

test('school Mac packages select architecture-isolated channels and retain the existing ARM URLs', async () => {
  const raw = JSON.parse(await readFile(new URL('../desktop/mac-updates.json', import.meta.url)))
  const arm = validateMacUpdateConfig(raw, 'arm64')
  const intel = validateMacUpdateConfig(raw, 'x64')
  const base = 'https://ecnunic-data-cdn.oss-cn-shanghai.aliyuncs.com/chatecnu-work/releases/macos'
  for (const channel of ['stable', 'development']) {
    assert.equal(arm.feeds[channel], `${base}/${channel}/appcast.xml`)
    assert.equal(intel.feeds[channel], `${base}/x64/${channel}/appcast.xml`)
  }
  assert.equal(arm.publicEDKey, intel.publicEDKey)
  // A future config edit must not silently give an Intel client the ARM channel.
  assert.throws(() => validateMacUpdateConfig({ ...raw, feedsByArch: undefined }, 'x64'), /explicit/)
  assert.throws(() => validateMacUpdateConfig({ ...raw, feedsByArch: { x64: raw.feeds } }, 'x64'), /separate/)
})
