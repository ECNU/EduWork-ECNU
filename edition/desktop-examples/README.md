# 企业配置示例

[English](README_EN.md) · [配置文件说明](https://github.com/ecnu/EduWork/blob/main/docs/CONFIGURATION.md)

ECNU 与公版 Electron 都读取一份 `config/eduwork.jsonc`。Windows 位于程序目录，Mac 位于 `~/Library/Application Support/eduwork-chatecnu-electron/`。设置中的“打开配置文件”指向这份文件；编辑后从托盘退出再启动。旧版本配置会迁到统一入口，成功启动后清理旧入口，只保留 `data/configuration/eduwork.previous.jsonc` 一份回退备份。

学校包可以直接分发 GitHub CI 原包：首次启动下载签名学校配置并写入该文件，无需本地装配。后续配置更新修改未改动的默认字段，保留手工修改，冲突显示在更新面板。公版默认不启用学校配置源，赛尔等部署仍可自行配置。

## 应用配置与 UAT

参考 [ecnu.jsonc](ecnu.jsonc)、[cernet.jsonc](cernet.jsonc) 和公版 [organization.jsonc](https://github.com/ecnu/EduWork/blob/main/config/desktop/examples/organization.jsonc)。占位 Client ID 必须由管理员替换，真实部署参数保存在仓库外。

直接在生效文件中修改机构登录、模型和媒体参数即可进行 UAT 联调。将已有 `contentUpdates.configuration` 设为 `false` 可以固定本地配置，同时保留 Skills 更新；再将 `skills` 设为 `false` 可关闭全部内容更新。软件的开发版／公测版渠道与服务端 UAT／生产环境是两回事。长期测试建议使用独立安装和数据目录。

静态配置部署可使用公版 `scripts/configure-desktop-archive.ps1` 加入 `config/eduwork.jsonc`，保持其他程序字节与 CI 原包一致。新包不再生成版本化配置文件。所有改动都需退出程序后重新启动，关闭窗口到托盘不等于退出。

## 模型与功能默认值

- 支持 `provider.chatModelIds` 的客户端使用示例中的 `ecnu-max`、`ecnu-plus` 对话白名单，与服务器授权目录取交集。embedding、rerank、生图和 TTS 不注册到对话选择器；独立服务仍使用各自的配置。此字段需先升级公共 OIDC 插件并完成客户端装配验收，再面向兼容客户端下发；旧客户端会拒绝未知字段。
- 模型请求总并发默认 3；`features.maxConcurrentRequests` 范围为 1–64。设置中保存的个人并发偏好优先，旧 `maxParallelSubagents: 2` 兼容换算为总并发 3。
- 示例中 `ecnu-max` 为纯文本模型，上下文 512K（524,288 tokens），最大输出 384K（393,216 tokens）。默认用 `ecnu-plus` 辅助观察图片；`features.visionFallback: false` 可关闭辅助，不影响原生读图模型。
- 图像与云端 TTS 通过公版 `media` 配置。赛尔模型 ID 为 `cernet-image` / `cernet-tts`；可用 `media.providers: []` 关闭云端媒体。本机 TTS 独立。
- 会话、登录凭据、个人模型和界面偏好不属于学校默认配置，不随配置更新清空。

## 接口约束

机构 `id` 标识账户配置，`provider.id` 命名本地模型路由。ECNU 和赛尔示例都使用 `chatecnu` 路由，不能按原样同时启用；合并两份配置时须为它们分配不同的本地 Provider ID。

没有机构条目时仍可配置个人 API Key。模型授权采用 `auth.discoveryUrl` 发现的 oidc-llm 协议，直接用 Access Token 调用；旧 `keyBinding` 配置需要迁移并重新登录。纯身份登录仍使用公版 identity-only 示例。配额和心跳是 ECNU 扩展。

Client ID 是部署参数，示例仅提供占位符。密码、API Key、Client Secret 和登录令牌不写入配置或公开安装包。桌面使用 PKCE 和本机 loopback 回调。企业 Token 保存在系统凭据存储中，服务插件只委托 Host 发起授权请求。`credentialRef` 仅用于不配置 `oidcProfileId` 的独立 API Key 模式。个人 Provider 的凭据仍独立。

校内搜索、读图辅助和心跳地址也在 ECNU 示例的 `plugins` 中配置。切换 UAT 时与登录、媒体地址一起修改。仅用于 HTTP 开发环境时，将企业对象里的 `allowInsecureDevelopment` 改为 `true`；HTTP 心跳也将其插件选项中的同名开关改为 `true`。默认均为 `false`，不再填写 `insecureDevelopmentOrigin`。

生效的 `eduwork.jsonc` 直接列出心跳、校内搜索、辅助读图等插件的默认开关、服务地址、账户关联与请求参数。心跳地址不由 OIDC 自动发现，切换环境时必须一起修改。

所有可配置项（包括公版插件和机构插件）都在同一文件中有中文说明；互斥、自动定位或需要真实服务参数的可选项以注释示例列出。已有配置在下次程序升级时补齐缺少的默认值和说明，手工值与注释保留，仍只留一份回退备份。
