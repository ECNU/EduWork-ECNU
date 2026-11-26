# ECNU 账户资源扩展

[English](README_EN.md)

此包只装入 ECNU 发行版。公版 `@eduwork/dsh-oidc` 不查询配额，也不识别额度字段；本包拥有既有 `/quota` 服务的请求、归一化、独立 RPC 和账户菜单内容。心跳仍由原机构心跳插件负责，本包不发送心跳。

Host 安装本包并配置 `profileIDs: ['ecnu']`（默认值）；发行方应传入其实际 ECNU Profile ID。显式空数组禁用所有机构，第三方组织和个人模型不会被查询。DSH 客户端模块需随此包加载，它占用公版官方插槽 `oidc.account.menu.details`；未匹配机构返回公版默认账户操作，不查询配额。`backend: desktop/web` 通过 OIDC 公共运输接口使用相同代码。

RPC 是本包的 `ecnuAccountResources.configuration()` 和 `quota(profileID)`，只回传白名单投影。Host 使用 `oidcAccounts.modelResourceFetch(profileID, '/quota', {signal})`，由公共账号层校验模型服务基址并用当前账号的 Access Token 发起 GET 请求，统一处理刷新、禁重定向、超时和账号切换。插件不读取或复制令牌，令牌也不进入客户端 RPC。账号事件/凭据事件、卸载与客户端组件生命周期阻止旧账号的迟到数据回显。没有跨账号缓存。

额度响应的 `provider_id` 是服务端额度命名空间；默认与该 Profile 的本地模型 `provider.id` 严格匹配。若同一服务在客户端使用不同路由 ID，可显式配置 `quotaProviderIDs: { "school-test": "school-service" }`，键必须属于 `profileIDs`，值必须为接口确认的服务端标识。该映射只替换预期的额度标识，仍严格拒绝其他标识，RPC 的 `providerID` 保持本地模型路由 ID。请求仍受既有学校账号与模型服务地址约束，不改变 OIDC 配置、登录范围或已有会话。配置/状态查询或额度接口暂时失败时显示不可用，可手动刷新恢复。

保留窗口实际剩余额度、进度、重置时间和资源包的剩余/已用/总量/到期/状态。没有有效总量时不构造百分比；资源包不与窗口盲目相加。详情仅允许无凭据的 HTTPS 地址。刷新失败仅影响额度展示，不删除登录状态或阻断模型。

接口字段见 `quota.openapi.yaml`。这些字段是 ECNU 机构协议，既不是 OIDC 标准，也不是公共 EduWork 资源必选能力。机构身份、Token 会话与模型目录仍由公共 OIDC 模块管理，本扩展不迁移或覆盖已存身份、个人 Key 和用户模型选择。

头像附近可选显示积分与邀请入口。余额通过 `ecnuAiconsole.read('account_get_points')` 共用只读账户实现；打开弹窗不创建邀请码，用户点击“获取邀请链接”后使用现有学校登录获取链接，不增加逐项授权步骤。邀请不注册为 Agent 工具。奖励与资格由 ChatECNU 决定；无时区的业务日期按北京时间解释，未知余额不显示为零。

账户读取服务通过可选依赖装载；缺少或卸载该服务时，积分和邀请返回未配置，既有配额仍可使用。依赖卸载也会取消在途积分和邀请结果，重新装载后可恢复。

支持 Host-only `oidcAccounts.accountIdentity` 时，普通 Token 续期保持积分、额度和邀请请求，退出、切换账号及重新授权则丢弃旧请求。积分/邀请显示结果包含可选随机 `accountRevision`；只读 `accountState(profileID)` 用相同修订号复核当前状态，不查询积分或创建邀请。修订号不包含账号身份，不跨进程持久化，也不是授权凭据。客户端通过标准凭据事件复核，修订号不变时保留打开的邀请；变化时清除。旧 OIDC 缺少稳定身份接口时仍可使用，但保守地让凭据变化使在途结果失效。网络超时显示暂不可用，可刷新重试，不提示重新登录。

启用时需要同一 Profile 的 `ecnu-aiconsole` 服务，以及支持 `oidc.account.footer.details` 的 OIDC 客户端，不依赖可选补授权机制。缺少插槽时保持现有配额功能；积分默认关闭。发行方在确认对应组件可用后设置本插件的配置：

```json
{
  "profileIDs": ["school"],
  "points": {
    "profileID": "school",
    "modelBaseURL": "https://example.org/open/api/v1",
    "workerBaseURL": "https://example.org/api/worker/v1"
  }
}
```

接口仍由服务端校验 `points.read` 和 `invitations.write`。发行方在启用前核实学校客户端注册、现有登录范围与旧登录兼容，沿用已有鉴权配置；UI 不申请或扩大 scope，拒绝访问时显示不可用。额外 RPC `points(profileID)` 和 `invitation(profileID)` 只回传有限的显示字段，不接受任意地址或方法。模型服务基址必须匹配当前学校登录，Worker 与模型服务必须同源。默认要求 HTTPS；HTTP 联调须在本插件和学校登录 Profile 中显式设置 `allowInsecureDevelopment: true`，并由 OIDC Host 核验精确请求地址。邀请链接只允许该服务同源地址，保留返回的环境、路由与邀请码。账号变化与卸载丢弃在途结果。

本地检查使用锁定的 DSH 0.2.2-rc.3 Runtime，运行 `npm run test`；设置 `DSH_OIDC_PACKAGE_ROOT` 指向公版 OIDC 编译包根目录。浏览器检查同时设置 `EDUWORK_TEST_RUNTIME` 为该 Runtime 目录；如其未安装组件源码依赖，可用 `EDUWORK_UI_TEST_DEPS` 指向补充依赖目录。`test/check-browser.mjs` 验证现有配额，`test/check-points-browser.mjs` 使用具备上述插槽的公共包验证积分、邀请、服务拒绝与账号切换；均使用合成数据，不代表生产 IdP 验收。打包用 `npm pack --ignore-scripts`。


头像下的紧凑工具行提供模型额度圆环和积分与邀请入口。圆环悬浮显示主要周期的剩余比例，点击查看各周期、重置时间和资源包余额；明细按需展开，管理入口使用服务端给出的账户页面。积分余额在图标悬浮提示中显示，点击查看积分详情和邀请操作。积分与模型额度分开显示，不相加；未知总量不生成百分比。进入额度面板、主动刷新或回到窗口时按需读取，不轮询。具备页脚插槽时，账户菜单只保留账户操作；旧客户端仍使用原有菜单额度详情。
