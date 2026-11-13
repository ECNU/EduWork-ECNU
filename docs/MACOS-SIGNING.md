# macOS 学校签名与公证

[返回构建指南](BUILD.md)

`Qualify ECNU macOS signing credentials` 使用 GitHub 托管的 macOS ARM 与 Intel runner，验证学校 Developer ID Application 身份。它只生成一个立即退出的合成测试程序，不装配 EduWork，也不发布 Release 或更新 OSS。

## 凭据配置

在学校仓建立 `macos-signing` Environment，部署分支策略只允许 `main`。工作流仅支持手动运行，PR 的合约测试不读取该 Environment。

| Environment Secret | 内容 |
| --- | --- |
| `ECNU_MACOS_CERTIFICATE_P12` | 包含签名证书和私钥的加密 P12，Base64 编码 |
| `ECNU_MACOS_CERTIFICATE_PASSWORD` | P12 的解密密码 |
| `ECNU_APPLE_ID` | 已加入学校开发者团队的 Apple 账号 |
| `ECNU_APPLE_APP_PASSWORD` | 该账号生成的 App 专用密码 |

签名策略位于 `edition/macos-signing.json`，包含学校 Team ID、证书身份与 SHA-256 指纹。更新证书时一并复核该策略。证书指纹属于公开校验信息；私钥、P12、密码不进入 Git、日志或 artifact。

Apple 专用密码可在 [Apple 账户](https://account.apple.com/) 的“登录与安全性 → App 专用密码”中生成，账号需要双重认证。请直接在 Secrets 或可信本地导入工具中输入。Apple 登录密码及签名私钥原密码不作为公证凭据。

## 运行与结果

在 `main` 手动运行 `macos-signing-preflight.yml`：

- `notarize_probe=false`：验证证书身份、有效期、macOS 代码签名信任、私钥可用性、可信时间戳、Hardened Runtime 和本机执行。
- `notarize_probe=true`：额外验证公证账号，向 Apple 提交合成 `.app`，要求返回 `Accepted`，装订票据并重建 ZIP；重新解压后检查签名、票据及 Gatekeeper 评估。

运行时将身份导入临时钥匙串；P12 导入后立即删除，结束时恢复原钥匙串搜索列表并删除临时钥匙串。工作流只上传不含凭据的 `preflight.json`，记录实际通过的检查、公证请求 ID 和失败阶段。关闭公证时回执明确记录 `not-requested`。

凭据检查通过不代表正式客户端已完成签名验收。正式包还需处理 Electron Helper、独立 Node/Python、原生扩展和 Sparkle 等嵌套代码。模型会话和学校登录仍按发布要求独立验收。

## 为现有 Release 补签名

这条流程用于已发布应用保持原版本与内容、仅补充 Developer ID 签名的场景。先复核 `edition/release/macos-signing/inputs/<版本>.json`，其中固定原 Release、源码提交、发布说明哈希及附件身份。原件发生变化时停止，不自动接受新的输入。

1. 在 `main` 手动运行 `macos-signing-release.yml`，选择已复核的版本。两种架构分别从 GitHub 下载原 ZIP，验证哈希，按嵌套顺序签署原生代码；非代码文件保持原样，只有 `release.json` 的三项签名状态更新。
2. 工作流公证并装订应用，重建 ZIP；从最终应用生成 DMG，再签名、公证和装订。随后验证应用启动、内置 Node/Python/浏览器等运行环境，并在 macOS 15 上检查相同文件的启动、票据和 Gatekeeper。回执明确区分重新执行的签名验收与继承的原始构建验收。
3. 全部检查成功后，另行手动运行 `publish-macos-signing.yml`，传入版本和上述成功运行的 ID。发布任务校验 CI 来源、双架构回执、原始文件与发布状态，将新文件全部暂存并核对哈希后替换原 Mac 文件。原件保留至十个替换附件全部验证成功；中断时使用同一来源运行 ID 重试即可恢复。

签名凭据只进入第一条工作流的临时钥匙串，实际应用启动验收前已清除。发布任务不读取签名凭据。大文件始终在 GitHub runner 与 Release 之间传输。

此流程不改变标签、版本号、发布说明、Windows 附件或 OSS。保持原文件名可保留 GitHub 下载链接，但文件大小与 SHA-256 会更新。同版本补签名不会主动通知已安装用户升级。

## 正式分发约束

应用完成学校签名及公证后，先装订 `.app` 的票据，再生成最终 ZIP；从同一应用生成 DMG，并完成 DMG 的签名、公证和装订。最终哈希、大小、发布回执和 Sparkle Ed25519 签名必须基于最终文件重新计算。

现有 Sparkle 公钥和双架构更新源继续保留。完整包与差分升级均需用真实旧版验证；本工作流不修改更新机制或渠道。

参考：[GitHub 的 Apple 签名凭据配置](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)、[Apple 公证流程](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)。
