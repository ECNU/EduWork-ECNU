// Presentation and selection policy for the read-only account plugin only.
export const QUERY_ACCESS = Object.freeze([
  ['account.read', '个人资料', '读取当前学校账号的个人资料'],
  ['usage.read', '用量与配额', '查询使用量、配额，以及按 Key 统计的用量'],
  ['points.read', '积分与流水', '读取积分余额、到期信息和积分记录'],
  ['entitlements.read', '权益与目录', '查询已获权益和可用产品目录'],
  ['orders.read', '订单', '查询本人订单'],
  ['tokens.read', 'Key 清单', '仅查询名称、状态、有效期等信息；工具不返回完整 Key'],
  ['requests.read', '运行中的请求', '查询本人正在运行的请求'],
  ['conversation.read', '云端会话', '读取本人 ChatECNU 会话和消息'],
].map(([scope, title, description]) => Object.freeze({ scope, title, description })))
export function selectQueryScopes(selected, authorization) {
  if (!Array.isArray(selected) || !authorization?.supported || !Array.isArray(authorization.available) || !Array.isArray(authorization.granted)) return []
  return QUERY_ACCESS.filter(item => selected.includes(item.scope) && authorization.available.includes(item.scope) && !authorization.granted.includes(item.scope)).map(item => item.scope)
}
