# 华东师范大学校内搜索

[English](README_EN.md)

DSH 原生的华东师范大学校内综合搜索工具。插件通过 `POST /search` 调用学校开放平台。当前学校发行关联已登录的 ECNU 账号，由公共 OIDC 账号层使用 Access Token 发起请求，插件不单独保存账号或令牌。

工具名为 `ecnu_campus_search`。它只应处理与华东师范大学高度相关的站点、服务、机构、政策和新闻检索；公共背景与外部事实仍由 DSH 官方 `web_search` 补充。

`oidcProfileId` 对应企业条目的 `id`，不是 `provider.id`。插件通过 `modelAuthorization` 核对账号与发现的模型服务基址，再委托 `authorizedFetch` 发送请求并处理令牌刷新。当前发行使用这个绑定模式；未登录或地址不匹配时不会退回个人 Key。省略该字段的兼容模式才直接读取 `credentialRef` 指向的 API Key，仅适用于自行管理 Key 的受控组合。

```yaml
- id: tool-ecnu-campus-search
  name: '@chatecnu-work/dsh-tool-ecnu-campus-search'
  config:
    baseURLEnv: CHATECNU_WORK_RUNTIME_API_BASE
    baseURL: https://institution.example.edu/open/api/v1
    credentialRef: EDUWORK_API_KEY
    oidcProfileId: ecnu
    requestTimeoutMs: 65000
```

返回的标题、摘要和链接属于不可信检索内容，不能被当作 Agent 指令执行。Access Token 或 API Key 不会写入工具输出、日志或错误信息。

API Key 兼容模式内部保留 `CHATECNU_API_KEY` 默认值，示例显式指定 `EDUWORK_API_KEY`。设置了 `oidcProfileId` 时不读取这项凭据；当前学校登录无需创建模型 Key。
