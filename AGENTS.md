# Institution integration guidance

- Release notes 必须先与项目负责人讨论确认，不得自行编写或自动生成。CI 只复制已确认的说明文件。GitHub 桌面 Release 仅发布 Electron；Go/Wails 过渡包在本地构建，经旧更新器验收后走原 OSS 渠道。

- 文档默认使用中文；所有自有目录的 `README.md` 使用中文，配套英文统一命名 `README_EN.md`；保留第三方 vendor 原文。两份入口保持功能边界、命令与示例一致，并保留语言切换链接。
- README 面向用户，按项目介绍与功能、安装和快速上手、详细文档入口组织。构建命令、依赖锁、CI 与验收细节放入对应指南，不把首页写成开发交接记录。
- This repository owns institution configuration, optional service adapters, brand assets and tests under `edition/`.
- Reuse the public core pinned in `core.lock.json`; do not copy its implementation or build scripts. Identity/key/model contracts belong to the generic OIDC package. Quota and activity heartbeats belong to this institution edition.
- Preserve personal API Key and alternative model-provider access. Institution services are optional, with explicit credentials and capability configuration.
- Keep deployment secrets, user data and internal endpoints in private local configuration. Use synthetic examples for public source and CI.
- Coordinate changes to shared contracts with the core and independent package maintainers. The latest task controls scope; older planning documents are historical context.
- Local Web validation artifacts are not desktop installers. Desktop shell, migration, updater and Release behavior require separate acceptance.

- CI 默认只检查源码/依赖、构建与必要的启动冒烟；Release 额外校验 ZIP 完整性。模型会话、OIDC 登录/重启、Office 与音视频全流程由维护者在提交前本地验收，不恢复为每次 CI 的重复门槛。回执只记录实际执行的检查。

- 开源文档面向用户与贡献者。README 只保留项目功能、安装使用和文档入口；内部讨论、工作日志、阶段交接、本地验收流水账与账户操作记录保存在仓库外，不加入公开源码或未发布提交的历史。
