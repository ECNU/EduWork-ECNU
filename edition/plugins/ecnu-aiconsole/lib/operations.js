// Registration and dispatch share this closed list. Token scopes never add tools.
export const CONSOLE_URL = 'https://aiconsole.ecnu.edu.cn'
const page = { page: { type: 'integer', description: 'One-based page, default 1.' }, page_size: { type: 'integer', description: 'Page size 1–100, default 20.' } }
const conversations = { page: page.page, limit: { type: 'integer', description: 'Page size 1–100, default 20.' } }
const specs = {
  account_get_profile: { path: '/profile', scope: 'account.read', title: '查询账户资料' },
  account_get_usage: { path: '/usage', scope: 'usage.read', title: '查询账户用量', parameters: {
    ...page,
    start: { type: 'string', description: 'Start date YYYY-MM-DD, Asia/Shanghai. Omit dates for the server default (last 30 days).' },
    end: { type: 'string', description: 'End date YYYY-MM-DD, Asia/Shanghai.' },
    model: { type: 'string', description: 'Exact model ID, if filtering.' },
    credential_id: { type: 'string', description: 'Credential ID from key metadata or usage; includes primary, oauth, unattributed and deleted keys.' },
  } },
  account_get_quota: { path: '/quota', scope: 'usage.read', title: '查询账户配额' },
  account_get_points: { path: '/points', scope: 'points.read', title: '查询积分余额' },
  account_list_points_records: { path: '/points/records', scope: 'points.read', title: '查询积分流水', parameters: page },
  account_list_entitlements: { path: '/entitlements', scope: 'entitlements.read', title: '查询账户权益', parameters: page },
  account_list_orders: { path: '/orders', scope: 'orders.read', title: '查询账户订单', parameters: page },
  account_get_catalog: { path: '/catalog', scope: 'entitlements.read', title: '查询可用资源目录' },
  account_list_keys: { path: '/keys', scope: 'tokens.read', title: '查询 Key 掩码和状态', parameters: page },
  account_list_conversations: { path: '/conversations', scope: 'conversation.read', title: '查询云端会话', parameters: conversations },
  account_get_messages: { path: '/conversations/{conversation_id}/messages', scope: 'conversation.read', title: '读取云端会话消息', parameters: {
    ...conversations,
    conversation_id: { type: 'string', required: true, description: 'Exact conversation ID returned by the conversation list.' },
  } },
  account_list_running_requests: { path: '/requests', scope: 'requests.read', title: '查询本人运行中的 Open LLM 请求', parameters: page },
}
function freeze(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child)
  return Object.freeze(value)
}
export const READ_OPERATIONS = freeze(specs)

export class AccountReadError extends Error {
  constructor(code, message) { super(message); this.name = 'AccountReadError'; this.code = code }
}
export function operationSpec(operation) {
  if (typeof operation !== 'string' || !Object.hasOwn(READ_OPERATIONS, operation)) {
    throw new AccountReadError('operation_not_allowed', `此插件只提供账户查询。需要操作账户，请自行打开 ${CONSOLE_URL}`)
  }
  return READ_OPERATIONS[operation]
}
const invalid = () => { throw new AccountReadError('invalid_arguments', '查询参数无效，请按工具参数说明填写。') }
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid()
  const parsed = new Date(`${value}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid()
}
export function readRequest(baseURL, operation, args = {}) {
  const spec = operationSpec(operation)
  if (!args || typeof args !== 'object' || Array.isArray(args) || ![Object.prototype, null].includes(Object.getPrototypeOf(args))) invalid()
  const parameters = spec.parameters ?? {}
  if (Reflect.ownKeys(args).some(key => typeof key !== 'string' || !Object.hasOwn(parameters, key))) invalid()
  const values = {}
  for (const [key, definition] of Object.entries(parameters)) {
    let value = args[key]
    if (value === undefined && definition.required) invalid()
    if (['page', 'page_size', 'limit'].includes(key)) {
      if (value === undefined) value = key === 'page' ? 1 : 20
      if (!Number.isSafeInteger(value) || value < 1 || value > (key === 'page' ? 1_000_000 : 100)) invalid()
    } else if (value !== undefined) {
      if (typeof value !== 'string' || !value.trim() || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value)) invalid()
      if (key === 'start' || key === 'end') date(value)
      // Keep a path component a component, including after proxy decoding.
      if (key === 'conversation_id' && (!/^[\p{L}\p{N}_-]+$/u.test(value))) invalid()
    }
    if (value !== undefined) values[key] = value
  }
  if (values.start && values.end && values.start > values.end) invalid()
  const path = spec.path.replace('{conversation_id}', encodeURIComponent(values.conversation_id ?? ''))
  const url = new URL(`${baseURL}/account${path}`)
  for (const [key, value] of Object.entries(values)) if (key !== 'conversation_id') url.searchParams.set(key, String(value))
  return { url: url.href, spec, parameters: values, coverage: Object.hasOwn(parameters, 'page') ? 'page' : 'response' }
}
