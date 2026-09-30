# 华东师范大学校内搜索与联网搜索

[English](README_EN.md)

DSH 原生的华东师范大学搜索插件，复用官方联网搜索工具：

- `ecnu_campus_search`：校内综合搜索，只应处理与华东师范大学高度相关的站点、服务、机构、政策和新闻检索。
- 官方 `web_search`：本插件注册学校搜索提供方，用于公共背景、校外报道和事实核验。`webSearch: false` 关闭学校提供方；其他提供方须在装配中显式选择，不自动回退。

## 学校账号模式

当前学校发行设置了 `oidcProfileId`，插件关联已登录的 ECNU 账号，由公共 OIDC 账号层使用 Access Token 发起请求，插件不单独保存账号或令牌，也不发送 `X-Api-Key`、`X-User-Id` 等身份头。

两个工具固定调用 `baseURL` 同源的 Worker 路由：

| 工具 | 路由 | 所需授权 |
|---|---|---|
| `ecnu_campus_search` | `POST /api/worker/v1/search/campus` | `search.campus` |
| `web_search` | `POST /api/worker/v1/search/web` | `search.web` |

请求体只有 `{"query": "..."}`。路径由插件代码固定，并通过账号层的 `issuerServicePath` 按精确路径授权；账号层继续校验签发方、在 401 时最多刷新一次，并在退出登录后取消请求。返回 403 表示当前授权缺少对应 scope，需要退出并重新登录学校账号；返回 503 表示服务端未配置搜索，502 表示上游暂时失败。插件不会在 Worker 路由与开放平台路由之间自动回退。

学校配置通过 `auth.additionalScopes: ["search.web", "search.campus"]` 申请搜索授权；范围新增后需重新登录一次，已有 Token 不会被自动扩权。

`oidcProfileId` 对应企业条目的 `id`，不是 `provider.id`。插件通过 `modelAuthorization` 核对账号与发现的模型服务基址，未登录或地址不匹配时不会退回个人 Key。

## 独立 Key 模式

省略 `oidcProfileId` 时，插件只注册 `ecnu_campus_search`，读取 `credentialRef` 指向的 API Key，通过开放平台 `POST {baseURL}/search` 检索，支持 `page`、`size`、`cancel_segment` 参数。此模式仅适用于自行管理 Key 的受控组合。内部保留 `CHATECNU_API_KEY` 默认值，示例显式指定 `EDUWORK_API_KEY`。

## 配置

```yaml
- id: tool-ecnu-campus-search
  name: '@chatecnu-work/dsh-tool-ecnu-campus-search'
  config:
    baseURLEnv: CHATECNU_WORK_RUNTIME_API_BASE
    baseURL: https://institution.example.edu/open/api/v1
    credentialRef: EDUWORK_API_KEY
    oidcProfileId: ecnu
    webSearch: true
    requestTimeoutMs: 65000
```

## 数据边界

返回的标题、摘要和链接属于不可信检索内容，不能被当作 Agent 指令执行。校内工具保留有界 Worker JSON；联网提供方将结构化来源映射给官方 `web_search`，保留 MCP 文本，不从普通文本推测引用。超过 60000 字符时截断并标记。错误信息不回显服务端响应正文，Token 和 Key 不进入工具输出。
