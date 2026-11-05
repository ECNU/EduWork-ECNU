import { createReadStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'

export async function sha256File(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
export async function writeJSON(file, value) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' })
}
export function run(command, args, { cwd, capture = false, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' })
    let stdout = ''
    child.stdout?.on('data', chunk => { stdout += chunk; if (stdout.length > 8 * 1024 ** 2) child.kill() })
    child.once('error', reject)
    child.once('close', code => code === 0 ? resolve({ stdout }) : reject(Error(`${command} exited ${code}`)))
  })
}
export const runNode = (file, args = [], options) => run(process.execPath, [file, ...args], options)
