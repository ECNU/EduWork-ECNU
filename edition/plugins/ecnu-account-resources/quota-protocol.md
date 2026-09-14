# ECNU 配额接口

此接口仅属于机构扩展，已经从公共 OIDC 规范中移除；线协议保持兼容。机器可读规范见 quota.openapi.yaml。

### QUOTA-01：配额

```http
GET /open/api/v1/quota HTTP/1.1
Host: ai.example.edu
Authorization: Bearer <runtime-api-key>
Accept: application/json
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{
  "provider_id":"example-ai",
  "unit":"credits",
  "windows":[{"type":"fixed_168h","limit":1000,"used":250,"remaining":750,"reset_at":"2026-10-01T00:00:00Z"}],
  "resource_packs":[{"id":"pack-1","name":"示例资源包","total_credits":100,"used_credits":10,"remaining_credits":90,"expires_at":null,"status":"active"}],
  "ops_console_url":"https://ai.example.edu/usage"
}
```

| 字段 | 要求与显示语义 |
| --- | --- |
| `provider_id` | 必须与 Profile Provider ID 完全匹配 |
| `unit` | 显示单位；不要求 credits，缺失时不推测币种或计费规则 |
| `windows` | 必须是数组，最多 64 项；空数组表示没有周期窗口 |
| `type` | 窗口标识，如 `fixed_168h`；时间边界由服务器决定，不按自然周自行重置 |
| `limit/used/remaining` | 非负有限数字或 null；缺失按未知处理，0 是明确为零；客户端不从其中两个推算第三个 |
| `reset_at` | RFC 3339 时间或 null；无有效时间不显示重置时间 |
| `resource_packs` | 可选，最多 256 项；每项 `id/name/total_credits/used_credits/remaining_credits/expires_at/status` 含义见示例 |
| `ops_console_url` | 可选 HTTPS 详情链接，无 URL 用户名密码；兼容 `console_url` 旧别名 |

窗口与资源包可以是独立计费池，不得盲目相加。UI 的百分比只在有效 `limit>0` 和 `remaining` 时计算并限制在 0–100%；金额/次数仍显示服务端数值。返回 401/403/404/429/5xx 时配额独立标为不可用，不清除有效模型 Key。当前查询不会自动轮换模型 Key，也不依据配额不足阻止一次模型请求；实际授权与扣费必须由模型网关执行。

