# ChatECNU 云端

[English](README_EN.md)

在侧栏提供「ChatECNU 云端」，分页浏览学校账号的会话并查看完整文本历史。复用学校账户只读服务的固定查询，登录和服务配置由发行方提供。项目默认工作区与会话绑定仍是 Host 内部能力，不直接暴露给 UI 或 Agent。

预览仅展示用户和助手的可见文本，不渲染云端 HTML、不加载外部图片、不执行工具。遇到尚不支持的消息会明确提示；首期单次预览最多 1,000 条消息、1 MB 文本。

选择会话后点击「在 EduWork 继续」，通过现有工作区选择器选择或新建工作区，再导入历史。后续消息保存在本地，不同步回云端。再次打开同一云会话会复用已导入的本地会话。可以记住项目的默认工作区，仅影响以后的导入；不移动已有会话，也不自动下载项目资料。

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

账号标识、学校 profile 和环境基址共同形成存储分区，不持久化令牌。正常令牌续期保留绑定；重新登录、换号与退出使旧页面的选择凭据失效。新账号不能读取旧账号映射，重启保留已提交的绑定。浏览 RPC 只供本机所有者使用。

浏览能力同时需要同一学校 profile 的 `ecnuAiconsole` 只读服务；它与 Agent 查询共用 reader，不另建鉴权或 HTTP 客户端。缺少服务或读取权限时显示明确状态。使用 DSH 0.2.2-rc.3 的侧栏、主面板、按钮与图标组件。

模型基址默认要求 HTTPS。隔离的 HTTP 联调须在本插件与学校登录 Profile 中显式设置 `allowInsecureDevelopment: true`；服务地址仍须通过 OIDC Host 校验。HTTP 与 HTTPS 基址形成不同存储分区，不能借此访问另一环境的绑定。

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

导入复用官方 Session 校验、sessionPersistence 持久化和 workspaceRegistry 登记，不启动模型。用户确认后保存本地恢复记录；中断重试复用同一个会话 ID，校验已写入前缀并补齐，禁止覆盖不同历史。离开页面会请求取消，已写入的数据保留供下次恢复。原目录失效或会话被移动时提示修复，不生成重复会话。

导入前重新读取会话摘要与消息，核对预览快照；来源的项目字段只能作为本次会话的显式绑定，不推断 Notebook ID。导入历史不会包含云端 system、工具执行、思考过程或计费记录，使用独立来源标记。此绑定不授予资料访问权，资料读取仍须由平台鉴权。没有下载、双向同步或云端写操作。

使用锁定的 DSH Runtime 设置 EDUWORK_TEST_RUNTIME，在学校仓根运行：

```powershell
node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/ecnu-cloud/test/*.test.mjs
```

测试使用真实 DSH JSON 存储和工作区注册表、合成账号，覆盖重启、账号和环境隔离、换绑、重复／冲突、目录失效、并发账号切换及存储失败。不代表云端服务或正式桌面已经完成联调。
