# 学校回答反馈

[English](README_EN.md)

为学校模型的已完成回答提供点赞、点踩、改评和撤回。复用 DSH 的 `conversation.chat.assistant-actions` 插槽；逐条按已记录的模型提供方判断，切换当前模型不会改变历史回答的归属。个人模型、流式回答与中断回答不显示入口。ChatECNU 是反馈状态来源，原 DSH 反馈日志和遥测不因此启用。

界面参考 DSH 原反馈流程，直接使用锁定 RC3 的 `Modal`、`Button`、`Tooltip`、`Toast` 和官方赞踩图标，学校层只适配文案、配置认可的分类和接口。沿用官方弹窗焦点管理、Escape 取消和深浅色主题。问答正文默认折叠，提交说明始终可见，明确告知本轮可见问题、最终回答和反馈将发送给 ChatECNU 用于评估。宿主从 DSH 原始可见消息读取正文并校验预览摘要，不接受客户端自行拼接问答。不包含推理块、工具结果、注入上下文或附件二进制。超过接口长度限制时拒绝提交，不静默截断。撤回发送 `favorite=0`，不再次上传正文；已上传正文的保留规则由平台决定。

直接复用现有学校登录和 Host 鉴权请求，不依赖按功能补授权或共享客户端账号服务。服务端仍校验 `feedback.read` 和 `feedback.write`；发行方在启用前核实客户端注册、现有登录范围及旧登录兼容。用户预览后点击提交，不再单独申请反馈权限；拒绝访问时显示错误，不自动重新授权。插件默认不装配，不注册 Agent 工具。

Host 配置示例：

```json
{
  "profileID": "school",
  "providerID": "school-ai",
  "modelBaseURL": "https://example.org/open/api/v1",
  "workerBaseURL": "https://example.org/api/worker/v1",
  "reasons": []
}
```

模型基址必须与学校登录一致，Worker 必须同源；写请求使用 OIDC Host 已支持的精确 issuer 路径能力，因此 Worker 的反馈路径也应位于 issuer 的 origin。默认要求 HTTPS；HTTP 联调需在本插件与登录 Profile 中显式设置 `allowInsecureDevelopment: true`，并使用支持精确服务地址校验的 OIDC Host。该选项不放宽同源限制。`reasons` 仅填写平台已经确认接受的分类，空数组表示只提供赞踩和选填说明。说明最多 1,000 字符，问题最多 50,000 字符，回答最多 100,000 字符。服务仅允许固定的反馈 GET/POST 路径，不接受任意方法、URL 或令牌。

同一回答改评沿用本地会话和消息 ID；重新打开时读取平台状态。Host 用随机的 `accountBinding` 修订标识绑定当前账号会话，使用已有 `accountIdentity` 在请求前后校验身份；同账号自动续期保留草稿，退出、换账号、新登录和 Host 重启使旧草稿失效。旧 OIDC 缺少身份方法时，继续保守地在凭据事件后失效。客户端只比较随机修订标识，不接收账号标识或令牌。复核失败时保留输入并禁用提交，可重试；提交失败也保留草稿。写操作串行执行，账号变化与卸载阻止旧请求结果回显，预览变化阻止提交。取消草稿不发送反馈；已提交的请求不能通过关闭弹窗撤销，需使用撤回操作。源码编译和合成测试不代表生产权限、分类取值或正文保留政策已验收。

构建沿用学校插件 `build-client.ps1`，测试使用锁定的 DSH 0.2.2-rc.3 Runtime。客户端将 UI primitives 作为桌面预加载外部模块，薄布局随 JS 注入，无额外 CSS 装配。`test/feedback.test.mjs` 验证真实 DSH 会话事件、宿主边界及公共 OIDC 配合合成 IdP 的登录和续期；`test/check-browser.mjs` 用实际安装 RC3 包发布的组件源码和主题样式验证编译后的控件、预览、服务拒绝、改评、撤回、焦点、窄窗和草稿恢复。设置 `DSH_OIDC_PACKAGE_ROOT` 指向公共 OIDC 编译包，`EDUWORK_TEST_RUNTIME` 指向装配的 Runtime；测试还需 `playwright-core`、React 18、Runtime 中的 `esbuild` 及组件构建依赖 `clsx`，后者可由 `EDUWORK_UI_TEST_DEPS` 指向隔离的 `node_modules`。该 fixture 验证组件交互和主题，不替代真实桌面模块装配验收。
