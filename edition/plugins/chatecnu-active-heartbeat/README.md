# ChatECNU 活跃心跳

[English](README_EN.md)

ChatECNU 专属机构能力。只上报随机安装标识、客户端元数据和前后台状态，不读取对话、工作区、文件内容或本地活动统计。EduWork 公版、通用 OIDC、Studio、Memory 不依赖本包。

## 调度和数据边界

- 浏览器每 25 秒向本机 DSH Host 更新前台租约；这不是向学校发心跳。Host 合并同一实例的页面，前台首次、恢复和登录完成立即调用，正常默认每 600 秒一次。租约 75 秒未续即停止前台上报。
- 后台尽力发送一次 `background`，随后停止周期请求；未实施可选的 idle 检测。页面退出时撤销租约，插件停用时清理计时器并终止未完成请求。
- 网络、5xx、429：15 秒起指数退避，最多 10 分钟加 20% 抖动；恢复网络可提前补发。其他 HTTP 错误、登录失效等停止重试，等待登录或插件配置重新装载。
- 随机安装 UUID 随数据目录移动、升级保留，不使用设备硬件序列号、主机名或浏览器指纹。只采用实际平台与架构，不猜操作系统版本。
- 请求使用 OAuth Access Token，绝不使用模型 API Key。账号层在请求前检查 Token 有效期；本包显式为可重复的心跳 POST 启用 401 后最多一次刷新重试，不复制刷新流程。浏览器只接触 presence 和归一化状态，不接触令牌、原始服务端响应或账号标识。

## Electron 与本机 Web 配置

Electron 和单机 Web 共用 DSH Host 的 OAuth 后端，配置名称沿用 `backend: "web"`，不表示客户端平台是 Web。学校发行默认启用并关联 `ecnu` 账号。当前桌面生效选项位于 `eduwork.jsonc` 的 `plugins["chatecnu-active-heartbeat"]`，可从设置打开配置文件修改；下面是该插件对象的示例。切换环境时同步修改 `baseURL`，心跳地址不会随登录发现地址自动切换：

```json
{
  "backend": "web",
  "enabled": true,
  "allowInsecureDevelopment": false,
  "profileID": "campus",
  "baseURL": "https://campus.example.edu",
  "endpoint": "/user/active",
  "productName": "EduWork@ECNU"
}
```

插件本身只有显式 `enabled: true` 才启用。未启用时不要求目标地址或 OIDC 服务，不访问远端。示例域名须替换为实际服务地址。

桌面平台自动上报为 `desktop`，从宿主 `EDUWORK_PRODUCT_ROOT/assembly.json` 读取当前安装版本；预发布版本对应 `channel: "dev"`，正式版本对应 `stable`。装配无需随每次发布改写插件版本字段。独立 Web 部署可显式指定 `version` 和 `platform: "web"`。此处的 `channel` 表示当前安装包，不是用户选择的更新订阅渠道。

启用时必须有已配置的 `profileID` 和显式 `baseURL`。`endpoint` 默认 `/user/active`，必须与 `baseURL` 同源。OIDC 插件提供 Host-only `ctx.oidcAccounts.authorizedFetch(profileID, endpoint, init)`，负责令牌、刷新及目标 origin 校验。默认只允许该 profile 的 发现结果中 issuer 和资源服务的精确 origin；跨服务域名由受信装配在 OIDC 配置的 `authorizedOrigins` 中显式添加 HTTPS origin。本包无修改此白名单或获取令牌的 RPC。

已登录但没有模型 Key 的身份账号也能上报。`oidc/accounts-changed` 事件只用于对应 profile 的启停；重新授权即使仍是“已连接”，也会解除旧错误导致的暂停，并丢弃旧请求的迟到结果。浏览器在下一次本机 presence 返回等待、成功或其他非登录失败状态时撤销旧提示；重新登录后的临时网络故障不会继续显示旧的登录失效提示。已主动退出的账号保持安静，失效账号交由 OIDC 登录流程处理。

安装标识默认保存在 `$DSH_HOME/state/chatecnu-active/installation-id`。也可显式设置绝对 `stateDirectory`，或提供非秘密的固定 `installationID`；不同独立安装不应共用固定值。为迁移旧版身份，可让 `stateDirectory` 指向已迁移的原生 `state/chatecnu` 目录，复用其中的 `installation-id`。文件损坏时报告本地错误，不悄悄覆盖原标识。

请求保持已有 `POST /user/active` 协议，wire 标识是 `client.installation_id`；OAuth `client_id` 在 OIDC profile 中配置，没有另造 `device_id` 或 `client_id` 请求字段。其他元数据为 name/version/platform/channel/device/os/arch/locale/timezone；超过协议长度的版本号会省略。服务端 `next_heartbeat_in` 默认 600 秒，限定在 60–3600 秒。

默认仅接受 HTTPS；HTTP 测试环境须显式将本插件和关联机构的 `allowInsecureDevelopment` 设为 `true`，同源及账号授权校验仍然生效。`client` 不包含用户名、OAuth `client_id`、令牌或文件路径。可选的 `os_version` 不上报；服务端自行获取 IP。HTTP 200 且 `status: "Success"` 即视为成功，`recorded: false` 或 `daily_recorded: false` 不会引起重试。

## 旧版原生适配

省略 `backend` 或使用 `backend: "native"` 保留现有桌面实现，动态依赖 `desktopBoundary`、`enterpriseAccounts`。仅机构 bundle 装载；可信机构 catalog 还需显式设置 `nativeExtensions["chatecnu.active-heartbeat"] = true`，默认关闭。`enabled: false` 可在插件侧一并停用。

此适配要求旧版 Go 宿主提供 `/v1/extensions/chatecnu-active-heartbeat`，供迁移兼容使用。当前 Electron 发行使用上述 OAuth Host 后端；不会依赖或启动旧版 Go 服务。

## 验证与维护

`lib/*.js` 是维护源码，无生成构建步骤。浏览器沿用 DSH 公共同源 Typert HTTP 接口，仅发送非秘密的 presence；Host 保留 typed RPC 描述，不增加 UI 或令牌 RPC。

运行 `node --test test/*.test.mjs`。Host 和客户端模块 Loader 测试默认使用`dist/dsh-cache/runtime-npm-0.1.5-rc.2`，可通过 `EDUWORK_TEST_RUNTIME` 指向另一套 DSH 0.1.5-rc.2 安装根目录。覆盖真实 Cordis 插件加载、动态服务依赖、停用清理、官方客户端 ModuleLoader（DOM 用事件模拟）、多页面前台合并，以及本地 HTTP 合成服务的 wire/错误映射/安装标识迁移。测试不访问真实 UAT，不使用真实凭据；OAuth 刷新和受信 origin 约束由 OIDC 插件的协议测试覆盖。

发行前应在装配结果上确认所配置环境的完整登录和心跳链路。
