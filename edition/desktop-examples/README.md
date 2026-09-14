# 企业配置示例

[English](README_EN.md)

模型请求总并发默认 3 路，当前客户端的主会话、子代理和辅助模型请求共用上限，超出的请求排队。用户可在设置 → 通用设置 → 模型请求总并发中修改并保存，即时生效。顶层 `features.maxConcurrentRequests` 提供发行默认值（1–64），改文件需重启；用户已保存的并发偏好优先。旧 `maxParallelSubagents: 2` 兼容换算为总并发 3。更新设置可选择“公测版”或“开发版（含公测版）”；徽标按实际安装版本显示，切换更新渠道不会降级。

ECNU 示例中 `ecnu-max` 已按 DeepSeek V4.1 声明 `input: ["text", "image"]`。学校维护的完整配置随版本更新，无需用户修改或重新登录。学校管理的网关、模型目录与限制以新发行配置为准；个人 Provider、Key、默认模型选择和历史单独保留。ECNU 版可通过顶层 `"features": { "visionFallback": false }` 关闭纯文本模型的图片辅助，原生图片模型不受此开关影响。其他文本模型是否能使用辅助，取决于它是否在辅助插件所配置的企业 Provider 中。

ECNU Electron 企业配置从与程序版本对应的 `config/eduwork.<产品版本>.jsonc` 读取，设置页展示当前企业、登录状态和模型详情，不提供添加或修改企业的表单。配额由 ECNU 发行扩展提供，不属于公版 OIDC。

`ecnu-max` 默认上下文为 **512K（524,288 tokens）**，最大输出保留 **384K（393,216 tokens）**。学校维护的上下文和输出限制以当前发行配置为准；个人模型不受影响。标准模式默认由 DSH 在约 80% 上下文压力时自动压缩，继续旧会话也按新上限处理，无需清空历史。

以下步骤面向发行维护者，普通学校用户直接使用学校配置好的发行包，无需修改文件。ECNU Electron 生效文件为 `<客户端目录>/config/eduwork.<产品版本>.jsonc`，示例目录为 `<客户端目录>/config/examples/`。公版仍使用 `config/eduwork.jsonc` 并保留其内容，赛尔等公版部署不启用学校配置接管。源码阅读者可查看本仓 [ecnu.jsonc](ecnu.jsonc)、[cernet.jsonc](cernet.jsonc) 和[默认配置](../desktop/eduwork.jsonc)；通用 [organization.jsonc](https://github.com/ecnu/EduWork/blob/main/config/desktop/examples/organization.jsonc) 与 [updates.jsonc](https://github.com/ecnu/EduWork/blob/main/config/desktop/examples/updates.jsonc) 由公版提供，装配时合入安装包的 examples。

1. 在客户端的 `config/examples/` 中选择 `ecnu.jsonc`（华师现有服务）、`cernet.jsonc`（赛尔式部署模板，域名为占位符）或 `organization.jsonc`（第三方学校/企业完整协议示例）。
2. 在仓库之外准备完整私有配置，由管理员填写真实 Client ID 等部署参数；占位符不能直接登录。下载 GitHub CI 安装包后，用锁定公版的 `scripts/configure-desktop-archive.ps1` 加入实际配置；脚本同时填写兼容的 `config/eduwork.jsonc` 和本版本配置，更新清单与摘要，并核验程序字节与 CI 一致。实际配置不提交仓库、不注入 CI。所有示例都是可解析的 JSONC，支持中文注释和尾逗号。
3. 如需更换界面 Logo，需另行装配并校验品牌资源（上述配置装配脚本不增加 Logo 文件）。将文件放在 `config/assets/`，在 `product` 中填写 `"logoFile": "assets/logo.png"`。路径相对于配置文件，不依赖源码目录；支持 PNG/WebP/SVG，最大 256 KiB。
4. 从系统托盘选择“退出”，再启动应用。仅关闭窗口默认不会退出，因而不会重读配置。

ECNU 设置只展示学校信息与登录状态，不提供编辑发行配置的入口。机构 CI 默认配置的 `organizations` 留空；维护者必须在本机完成私有配置装配，并分别验证全新安装和已有用户升级。完整字段示例位于 `config/examples/`。

现有部署的 `provider.id` 必须与资源服务 `bootstrap.provider.id` 一致：ECNU 和赛尔当前都为 `chatecnu`，不能为了显示名称任意改写。本地企业条目的 `id` 分别仍为 `ecnu` / `cernet`；名称在 `displayName` 中修改。已经复制过旧赛尔示例的用户仅修正 `provider.id` 后重启，不需要清除登录或其他配置。

`organizations` 可以是空数组，也可以填写多个不同 `id` 的企业。托管模型的 `provider.id` 路由也必须唯一；现有 ECNU 和赛尔示例都使用 `chatecnu`，是替代部署方案，不能按原样同时启用。不要只改客户端 Provider ID；需要服务端提供不同的匹配标识，或使用分开的客户端配置。没有企业时仍可在原生模型设置中使用个人 API Key。只需要身份登录时，同时省略企业条目的 `keyBinding` 和 `provider`；自动取 Key 和模型目录需要服务端实现相应资源协议。

Client ID 虽不是 OAuth 密钥，仍按部署信息管理，示例仅提供占位符。密码、API Key、client_secret 和登录令牌不写入示例或公开安装包。桌面使用 PKCE 和本机 loopback 回调；服务器管理员需允许公共桌面客户端的相应回调方式。照搬示例不代表第三方服务器已实现协议或授予了用户权限。

新示例统一使用 `EDUWORK_API_KEY`：企业登录写入，已装配的模型、语音、图像及机构搜索服务读取同一引用。它是本机凭据名称，不是 API Key 明文，也不属于 ECNU 专用字段。个人在模型设置中另行配置的其他 Provider Key 仍独立管理。旧版本已保存的凭据与配置应通过兼容迁移衔接，不要为了改名清空凭据或把 Key 复制到配置文件中。

界面名称和 Logo 可以通过文件修改；exe 图标、应用 ID 和签名由发行版构建确定。更新地址可参考 `updates.jsonc` 配置，实际安装能力以所用壳的更新器为准。公版不会因为配置了华师地址就安装校内专属插件。绿色发行包可解压运行，配置与本地历史位于程序目录下的 `config/` 和 `data/`；身份凭据由系统凭据保护机制保管。

ECNU Electron 更新加入与新程序版本对应的完整学校配置；旧配置保留用于失败回退。个人设置、模型、Key 和历史保留。旧 `eduwork.jsonc` 不再作为新版学校发行的生效配置；公版仍保持原来的用户配置策略。服务器发现模式的目录仍以服务器为准，跨机器导入不复制登录凭据。

图像与云端 TTS 现在使用公版 `media` 配置，不再追加学校媒体插件。两个部署示例均包含模型、尺寸和音色目录；赛尔模型 ID 为 `cernet-image` / `cernet-tts`。旧华师配置省略 `media` 时保留发行默认服务；显式 `media.providers: []` 可关闭云端媒体。本机 TTS 始终独立。
