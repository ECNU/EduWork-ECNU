import { createHash } from 'node:crypto'
import { link, open, rm } from 'node:fs/promises'

// One caller-owned cancellation signal, separate response-header/idle clocks.
// There is deliberately no elapsed-time deadline on an active download.
export async function streamDownload({ fetchResponse, path, signal, requestTimeoutMs, idleTimeoutMs, maximum, assertCurrent, pdf }) {
  const controller = new AbortController(), started = Date.now(), partial = path + '.part'
  let timer, reader, file, ownsPartial = false, published = false, received = 0, prefix = Buffer.alloc(0)
  const digest = createHash('sha256')
  const cancel = () => controller.abort(new DOMException('Music download cancelled by caller', 'AbortError'))
  if (signal?.aborted) cancel()
  else signal?.addEventListener('abort', cancel, { once: true })
  let onAbort
  const interrupted = new Promise((_, reject) => {
    onAbort = () => reject(controller.signal.reason)
    if (controller.signal.aborted) onAbort()
    else controller.signal.addEventListener('abort', onAbort, { once: true })
  })
  // The signal can fire while a file write is draining between reads.
  interrupted.catch(() => {})
  const clear = () => { clearTimeout(timer); timer = undefined }
  const arm = (ms, phase) => {
    clear()
    timer = setTimeout(() => controller.abort(Object.assign(new Error(
      phase === 'headers'
        ? `Music download response timed out after ${ms} ms; no complete file was saved.`
        : `Music download stalled: no data for ${ms} ms after receiving ${received} bytes. No complete file was saved; check the connection before retrying this download.`,
    ), { code: phase === 'headers' ? 'MUSIC_DOWNLOAD_RESPONSE_TIMEOUT' : 'MUSIC_DOWNLOAD_IDLE_TIMEOUT' })), ms)
  }
  const wait = promise => Promise.race([promise, interrupted])
  try {
    controller.signal.throwIfAborted()
    arm(requestTimeoutMs, 'headers')
    const response = await wait(fetchResponse(controller.signal))
    clear()
    const rawLength = response.headers.get('content-length')
    const length = rawLength !== null && /^\d+$/.test(rawLength) ? Number(rawLength) : undefined
    if (length > maximum) { void response.body?.cancel().catch(() => {}); throw Error('Music response exceeds size limit') }
    if (!response.body) throw Error('Empty music artifact')
    reader = response.body.getReader()
    file = await open(partial, 'wx', 0o600)
    ownsPartial = true
    arm(idleTimeoutMs, 'body')
    for (;;) {
      controller.signal.throwIfAborted()
      let chunk
      try { chunk = await wait(reader.read()) }
      catch (error) {
        if (controller.signal.aborted) throw controller.signal.reason
        throw Object.assign(Error(`Music download connection interrupted after ${received} bytes; no complete file was saved.`), { code: 'MUSIC_DOWNLOAD_INTERRUPTED' })
      }
      if (chunk.done) break
      if (!chunk.value.byteLength) continue // Empty chunks do not count as progress.
      clear() // Disk backpressure is not network inactivity.
      received += chunk.value.byteLength
      if (received > maximum) throw Error('Music response exceeds size limit')
      assertCurrent()
      digest.update(chunk.value)
      if (prefix.length < 5) prefix = Buffer.concat([prefix, chunk.value.subarray(0, 5 - prefix.length)])
      await file.writeFile(chunk.value)
      controller.signal.throwIfAborted()
      arm(idleTimeoutMs, 'body')
    }
    clear()
    if (!received) throw Error('Empty music artifact')
    const encoding = response.headers.get('content-encoding')
    if ((!encoding || encoding === 'identity') && length !== undefined && received !== length) throw Error('Incomplete music artifact: received size does not match Content-Length')
    if (pdf && prefix.toString() !== '%PDF-') throw Error('Server returned a non-PDF score; use its actual artifact format')
    assertCurrent()
    controller.signal.throwIfAborted()
    await file.close(); file = undefined
    // Hard-link publication is atomic and refuses to replace an existing file.
    await link(partial, path); published = true
    assertCurrent()
    controller.signal.throwIfAborted()
    await rm(partial)
    ownsPartial = false
    return { bytes: received, mime: response.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream',
      sha256: digest.digest('hex'), elapsedMs: Date.now() - started }
  } catch (error) {
    controller.abort(error)
    void reader?.cancel().catch(() => {})
    if (file) await file.close()
    if (published) await rm(path, { force: true })
    if (ownsPartial) await rm(partial, { force: true })
    throw error
  } finally {
    clear()
    signal?.removeEventListener('abort', cancel)
    controller.signal.removeEventListener('abort', onAbort)
    reader?.releaseLock()
  }
}
