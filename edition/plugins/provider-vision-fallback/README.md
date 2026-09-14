# 企业模型图片辅助

[English](README_EN.md)

在 Provider 边界为纯文本企业模型补充聚合 `image` 输入能力。DSH 会话保留原始附件，只改写最终模型请求：配置的视觉模型观察图片，主模型收到明确标记为不可信的文字证据。

## 开关与原生图片输入

ECNU `ecnu-max` 基于 DeepSeek V4.1，内置目录声明 `input: [text, image]`；`ecnu-plus` 同样直接收图。原生图片模型不调用辅助模型，也不会在原生调用失败后悄悄改用文字转述。

辅助默认只对配置 Provider 下的纯文本模型生效。桌面 `config/eduwork.jsonc` 设置 `"features": { "visionFallback": false }` 后，从托盘退出并重启可关闭；`true` 恢复。两壳使用同一配置；公版未装配插件时，此开关不会安装能力。辅助开关不影响模型自身图片输入。

直接装配 DSH/Web 时，可设置 `config.enabled: false` 或 `EDUWORK_VISION_FALLBACK=false`。辅助模型由 `config.model`（默认 `ecnu-plus`）、服务地址和 `credentialRef`（默认 `EDUWORK_API_KEY`）决定；`config.provider` 限定被辅助的企业适配器路由，不接管任意第三方 Provider。

ECNU 客户端启动时将已知旧企业目录中 `ecnu-max` 的文本输入修正为文本加图片，再交给 OIDC Provider。仅机构 ID、issuer、Provider ID、官方网关、适配器和模型全部匹配时同步；不改配置文件原文、个人模型或自定义网关，无需重新登录。两壳共用入口。公版或独立插件不携带 ECNU 目录修正规则，部署方须提供正确的原生 `input` 声明。

## 处理边界

- 每个机构 bundle 注册一次，位于 Agent、Skill 和 Tool 之下，仅按选定模型的原生 `inputModalities` 判断。
- 原生多模态模型接收未改动的图片；纯文本模型接收辅助证据，不新增 Agent 可见工具。
- 每个不可变附件、辅助模型和分析策略版本的组合，在 `DSH_HOME` 下保存一份独立于上下文的观察结果，供重试、重启和会话分支复用。
- 进度只写日志，不追加 `user/message`，避免操作提示在后续上下文中变成用户指令。
- 单图输出和累计证据均有上限；超出文本预算时优先保留新证据，旧图片变为确定性的重新附加提示。
- 只读取 DSH 规范消息与富工具结果内容块，不扫描项目路径，也不向调用者暴露内部辅助路由。
