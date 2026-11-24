# ECNU 账户资源扩展

[English](README_EN.md)

此包只装入 ECNU 发行版。公版 `@eduwork/dsh-oidc` 不查询配额，也不识别额度字段；本包拥有既有 `/quota` 服务的请求、归一化、独立 RPC 和账户菜单内容。心跳仍由原机构心跳插件负责，本包不发送心跳。

Host 安装本包并配置 `profileIDs: ['ecnu']`（默认值）；发行方应传入其实际 ECNU Profile ID。显式空数组禁用所有机构，第三方组织和个人模型不会被查询。DSH 客户端模块需随此包加载，它占用公版官方插槽 `oidc.account.menu.details`；未匹配机构返回公版默认账户操作，不查询配额。`backend: desktop/web` 通过 OIDC 公共运输接口使用相同代码。

RPC 是本包的 `ecnuAccountResources.configuration()` 和 `quota(profileID)`，只回传白名单投影。Host 使用 `oidcAccounts.modelResourceFetch(profileID, '/quota', {signal})`，由公共账号层校验模型服务基址并用当前账号的 Access Token 发起 GET 请求，统一处理刷新、禁重定向、超时和账号切换。插件不读取或复制令牌，令牌也不进入客户端 RPC。账号事件/凭据事件、卸载与客户端组件生命周期阻止旧账号的迟到数据回显。没有跨账号缓存。

保留窗口实际剩余额度、进度、重置时间和资源包的剩余/已用/总量/到期/状态。没有有效总量时不构造百分比；资源包不与窗口盲目相加。详情仅允许无凭据的 HTTPS 地址。刷新失败仅影响额度展示，不删除登录状态或阻断模型。

接口字段见 `quota.openapi.yaml`。这些字段是 ECNU 机构协议，既不是 OIDC 标准，也不是公共 EduWork 资源必选能力。机构身份、Token 会话与模型目录仍由公共 OIDC 模块管理，本扩展不迁移或覆盖已存身份、个人 Key 和用户模型选择。

可选的“AIConsole 查询权限”入口复用此账号菜单。发行方显式设置 `queryAccessProfileID`，其值必须在 `profileIDs` 中，并与 AIConsole 只读插件的账号一致；省略时不显示入口。它依赖公版 `oidcClientAccounts.authorization/requestAuthorization` 能力。旧 Host 缺少该能力时仍保留配额功能；本源码不修改发行锁、默认装配或用户配置。

用户在入口选择需要的查询用途，默认不勾选新权限；已授权项保留为只读状态。候选仅限个人资料、用量配额、积分流水、权益目录、订单、Key 元数据、运行请求、云端会话这八组读权限，并与服务端开放范围取交集。发行方还需在 OIDC Profile 的 `auth.optionalScopes` 中配置允许申请的候选；这不会自动授予权限，也不应加入首次登录的必选权限。功能入口不会申请 Key 修改、停止请求、反馈或邀请权限。

点击“授权所选查询”才复用学校 OAuth 登录进行补授权，提交前重新读取权限状态；原有授权由公共账号层保留。取消、关闭或账号身份变化会取消待完成的客户端流程，旧登录继续可用。授权成功后请重新发起查询，不自动重放 Agent 调用。此窗口不支持撤销已有授权；账号写操作由用户在 AIConsole 办理。云端会话读权限也不代表已经实现本地导入或同步。

本地检查：以发行锁中的 DSH 依赖树为准，使用 `build-client.ps1` 编译，运行 `npm run test`；设置 `DSH_OIDC_PACKAGE_ROOT` 指向公版 OIDC 编译包根目录。`npm run check:browser` 检查既有配额，`npm run check:query-access` 检查含补授权能力的公版与扩展编译产物。浏览器使用合成账号，不代表生产 IdP 已联调。打包用 `npm pack --ignore-scripts`。
