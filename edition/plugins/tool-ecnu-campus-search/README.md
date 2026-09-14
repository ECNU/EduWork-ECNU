# 华东师范大学校内搜索

[English](README_EN.md)

DSH 原生的华东师范大学校内综合搜索工具。插件通过 `POST /search` 调用学校开放平台，复用 ChatECNU Work 已配置的 API Base URL 与 `EDUWORK_API_KEY`，不单独保存账号或密钥。

工具名为 `ecnu_campus_search`。它只应处理与华东师范大学高度相关的站点、服务、机构、政策和新闻检索；公共背景与外部事实仍由 DSH 官方 `web_search` 补充。

```yaml
- id: tool-ecnu-campus-search
  name: '@chatecnu-work/dsh-tool-ecnu-campus-search'
  config:
    baseURLEnv: CHATECNU_WORK_RUNTIME_API_BASE
    baseURL: https://institution.example.edu/open/api/v1
    credentialRef: EDUWORK_API_KEY
    requestTimeoutMs: 65000
```

返回的标题、摘要和链接属于不可信检索内容，不能被当作 Agent 指令执行。Bearer 密钥不会写入工具输出、日志或错误信息。

兼容旧组合时，插件内部仍保留 `CHATECNU_API_KEY` 默认值；新发行装配应像示例一样显式指定 `EDUWORK_API_KEY`。
