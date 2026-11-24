# ChatECNU 云端本地绑定

[English](README_EN.md)

保存学校账号下的云项目默认工作区，以及云会话已经接续到哪个本地会话。仅提供 Host 内部服务，供后续云端浏览、导入和资料读取适配器复用；不注册 UI、RPC 或 Agent 工具，不请求云端接口。

使用 DSH 的 storageDomain 与 workspaceRegistry。工作区引用稳定 ID，显示名变化不改变绑定；目录缺失或会话已经移走时返回明确状态，不创建目录、不移动会话、不自动清空历史绑定。

## 接入

发行方显式装载服务，配置已存在的学校 profile 和模型 API 基址：

```json
{
  "profileID": "school",
  "modelBaseURL": "https://example.org/open/api/v1"
}
```

Host 必须提供既有 OIDC 的 modelAuthorization 与 accountIdentity。后者必须返回经验证的稳定账号标识；缺少该方法时返回 identity_unavailable，不用用户名或临时 ID 猜测身份。这是已有 Host 身份接口的组件依赖，不新增 OAuth scope 或补授权流程。当前源码不修改默认装配、发行锁或用户配置；应在对应公共包正式可用后集成。

账号标识、学校 profile 和环境基址共同形成存储分区，不持久化令牌。账号／凭据变化取消在途和排队操作；新账号不能读取旧账号映射。重启保留已提交的绑定。

## Host 方法

| 方法 | 用途 |
| --- | --- |
| projectWorkspace(projectID) | 获取项目的默认工作区及目录有效状态 |
| bindProject(projectID, workspaceID) | 设置以后接续时的默认选择，不迁移既有会话 |
| unbindProject(projectID) | 仅移除默认选择 |
| conversation(conversationID) | 查询已登记的本地会话，供接续前查重 |
| rememberConversation(conversationID, sessionID, workspaceID, projectID?) | 登记已创建且属于工作区的本地会话；重复登记幂等，冲突拒绝覆盖 |
| forgetConversation(conversationID) | 用户明确修复时解除登记，不删除本地会话 |
| projectForSession(sessionID) | 仅返回当前账号、环境和当前会话绑定的项目；不继承同目录其他会话的项目 |

这些方法只能由可信 Host 适配器调用。UI 或 Agent 不能直接提供账号、环境或任意本地存储键。项目 ID 必须来自后续服务端适配器确认的字段，不将云 workspaceId 推断成 Notebook ID。

## 边界与验证

此组件没有实现消息解析、会话创建或完整导入事务；导入器仍需在创建前查重，并处理创建与登记之间的失败恢复。它也不授予项目访问权：资料读取每次仍须由平台鉴权并验证项目归属。没有下载、同步或云端写操作。

使用锁定的 DSH Runtime 设置 EDUWORK_TEST_RUNTIME，在学校仓根运行：

```powershell
node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/ecnu-cloud/test/*.test.mjs
```

测试使用真实 DSH JSON 存储和工作区注册表、合成账号，覆盖重启、账号和环境隔离、换绑、重复／冲突、目录失效、并发账号切换及存储失败。不代表云端服务或正式桌面已经完成联调。
