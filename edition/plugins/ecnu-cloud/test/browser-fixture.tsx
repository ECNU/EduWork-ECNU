import React from 'react'
import { createRoot } from 'react-dom/client'
import { CloudPage } from '../src/client'
let connected = true, listener: any, hold = false, release: any
const rows = [1, 2].map(i => ({ conversationID: `cloud-${i}`, title: `云端示例${i === 1 ? '一' : '二'}`, projectID: null, updatedAt: 1700000000000 }))
async function api(method: string, input?: any) {
  if (method === 'cloudState') return connected ? { state: 'available', lease: 'test-lease' } : { state: 'not_connected' }
  if (method === 'cloudList') return { state: 'available', lease: 'test-lease', items: rows, page: 1, hasMore: false }
  if (method === 'cloudPreview') {
    if (hold && input.conversationID === 'cloud-1') { hold = false; await new Promise(resolve => { release = resolve }) }
    return { state: 'available', lease: 'test-lease', summary: rows.find(r => r.conversationID === input.conversationID), total: 1, importable: true, messages: [{ messageID: 'm', role: 'user', supported: true, text: '可见正文 <script>alert(1)</script>', at: 1700000000000 }] }
  }
  return { state: 'available', bindingState: 'unbound', pending: false }
}
const watch = (callback: any) => { listener = callback; return () => { listener = null } }
window.fixture = { delayPreview() { hold = true }, releasePreview() { release?.() }, renew() { listener?.(false) }, logout() { connected = false; listener?.(false) } }
createRoot(document.getElementById('root')!).render(<CloudPage api={api} watch={watch} openSession={async () => {}} useWorkspaces={(select: any) => select({ items: [] })} renderFactorySlot={() => null} />)
