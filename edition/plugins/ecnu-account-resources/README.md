# ECNU 账户资源扩展

[English](README_EN.md)

此包只装入 ECNU 发行版。公版 `@eduwork/dsh-oidc` 不查询配额，也不识别额度字段；本包拥有既有 `/quota` 服务的请求、归一化、独立 RPC 和账户菜单内容。心跳仍由原机构心跳插件负责，本包不发送心跳。

Host 安装本包并配置 `profileIDs: ['ecnu']`（默认值）；发行方应传入其实际 ECNU Profile ID。显式空数组禁用所有机构，第三方组织和个人模型不会被查询。DSH 客户端模块需随此包加载，它占用公版官方插槽 `oidc.account.menu.details`；未匹配机构返回公版默认账户操作，不查询配额。`backend: desktop/web` 通过 OIDC 公共运输接口使用相同代码。

RPC 是本包的 `ecnuAccountResources.configuration()` 和 `quota(profileID)`，只回传白名单投影。Host 使用 `oidcAccounts.modelResourceFetch(profileID, '/quota', {signal})`，由公共账号层校验模型服务基址并用当前账号的 Access Token 发起 GET 请求，统一处理刷新、禁重定向、超时和账号切换。插件不读取或复制令牌，令牌也不进入客户端 RPC。账号事件/凭据事件、卸载与客户端组件生命周期阻止旧账号的迟到数据回显。没有跨账号缓存。

保留窗口实际剩余额度、进度、重置时间和资源包的剩余/已用/总量/到期/状态。没有有效总量时不构造百分比；资源包不与窗口盲目相加。详情仅允许无凭据的 HTTPS 地址。刷新失败仅影响额度展示，不删除登录状态或阻断模型。

接口字段见 `quota.openapi.yaml`。这些字段是 ECNU 机构协议，既不是 OIDC 标准，也不是公共 EduWork 资源必选能力。机构身份、Token 会话与模型目录仍由公共 OIDC 模块管理，本扩展不迁移或覆盖已存身份、个人 Key 和用户模型选择。

本地检查：使用锁定的 DSH 0.1.5-rc.1 一致依赖树构建，运行 `npm run test`；设置 `DSH_OIDC_PACKAGE_ROOT` 指向公版 OIDC 编译包根目录。公共与扩展编译浏览器联验见 `test/check-browser.mjs`，不宣称为生产 IdP 测试。打包用 `npm pack --ignore-scripts`。
