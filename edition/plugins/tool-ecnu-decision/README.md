# 学校决策模型

**简体中文** | [English](README_EN.md)

`@chatecnu-work/dsh-tool-ecnu-decision` 将学校 SystemOne 服务注册为 DSH 原生工具 `ecnu_decision`，配套 [ecnu-decision 技能](../../skills/ecnu-decision/SKILL.md)。适合按指定标签分流材料、核对明确条件、按量表评分；主 Agent 负责组织任务与解释结果。

使用学校账号登录并获得 `ecnu-decision` 模型分配后，可在对话中要求：“用学校决策模型，按校园卡、网络、财务、信息不足这几个标签对下面的请求分类”。也可由 Agent 在合适的任务中按需调用，不需要切换聊天模型。OAuth 授权需要 `llm:invoke`。

## 能力与配置

- `state` 接收文本或非空值 JSON，`questions` 接收 1–64 问；`choice` 是标签分类，`noul` 是判断成立的概率，`score` 是 2–10 档有序量表上的小数分值（从 0 起）。
- 可选 `images` 接收 PNG/JPEG/WebP Data URI；不读取本机路径或下载任意图片 URL。
- 原样保留结果中的概率、置信指标、评分说明及网关元数据。它们是模型估计，不代表确定事实或业务授权。
- 无自动业务动作，无启动时轮询，也不替换默认聊天模型。

发行清单将插件与技能一起装配。配置位于 `plugins.chatecnu-decision`：

```json
{
  "enabled": true,
  "baseURL": "https://chat.ecnu.edu.cn/open/api/v1",
  "model": "ecnu-decision",
  "oidcProfileId": "ecnu",
  "credentialRef": "EDUWORK_API_KEY",
  "requestTimeoutMs": 190000
}
```

学校账号模式复用 `@eduwork/dsh-oidc` 的 Host 接口，服务基地址必须匹配该账号授权资源。Token 不传给模型或前端；账号切换、退出及插件停用使旧请求失效。需要独立 API Key 时，将 `oidcProfileId` 显式设为空，并在凭据管理中填写 `credentialRef` 指向的 Key；学校登录失败不会自动切换到个人 Key。

客户端限制：材料 256 KiB，最多 8 张图片，整次请求 12 MiB，响应 512 KiB。服务端可能有更小上限。默认超时 190 秒（可配置 1–195000 毫秒），不自动重试 POST，不跟随重定向，不回退到旧模型。超时不代表服务端已取消推理。401 检查登录；403 检查模型分配/授权；422 检查请求结构与部署的模型别名；429 检查限流与额度。

## 插件边界

使用 DSH `defineTool`、原生结果卡片及技能机制；不修改 DSH runtime、桌面桥接或 OIDC 协议。此目录是独立插件源码，由学校发行版装配，目前未发布 npm 包。通用图片/TTS 仍走媒体与成果服务；本插件只适配 SystemOne 协议。

单元检查：在本目录运行 `node --test test/core.test.mjs`。实际 DSH 挂载检查：在仓库根设置 `EDUWORK_TEST_RUNTIME` 指向已装配的 `product/d`，运行 `node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/tool-ecnu-decision/test/*.test.mjs`。检查使用合成数据与本地模拟服务，不包含账号或线上请求。
