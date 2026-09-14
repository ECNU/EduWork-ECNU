# ECNU 发行构建与协作

[返回项目首页](../README.md)

本仓只维护 `edition/` 下的机构发行配置、服务适配器、品牌资源和集成测试。公共身份与资源协议、文件工具、Studio、预览、图像与云端 TTS 适配、本机语音和构建逻辑由公版或独立组件维护，不在这里复制一套。

## 锁定公共核心

[core.lock.json](../core.lock.json) 锁定公版的精确提交与源码文件集合。CI 检出该提交并调用共用构建流程，不跟随 `main`，也不从相邻开发工作区装配。新导出的公版提交必须先推送，托管 CI 才能获取；仅保存在本机的快照不能被远端 CI 读取。

## 本机装配

先将公版检出到独立目录，准备 Windows、PowerShell 7、Node.js 24 及公版 CI 指定的 Go。在本仓根目录执行：

```powershell
$CoreRoot = (Resolve-Path ../EduWork).Path
git -C $CoreRoot checkout (Get-Content core.lock.json -Raw | ConvertFrom-Json).commit
& "$CoreRoot/scripts/ci-eduwork-web.ps1" -CoreRoot $CoreRoot -EditionRoot . -DistributionConfig edition/distribution.json -Version (Get-Content core.lock.json -Raw | ConvertFrom-Json).version
```

默认调用公版 npm 装配链：DSH 和独立插件使用精确已发布版本，并校验 SHA-256/SRI；本仓只增加机构配置、服务插件和资源。缺失 npm 依赖时不回退到未发布开发包。官方桌面 Host 在当前基线没有 npm 包，按公版锁定源码构建。

此命令生成本机 Web 验证产物，不是完整桌面安装包。公共脚本、缓存模式和原生资源要求见锁定公版中的 `docs/BUILD.md`。桌面沿用相同 Web 成品，使用公版 `dsh-electron/README.md` 中的装配入口，不覆盖为开发快照。两种 Windows 桌面壳共用功能实现。

机构示例和模型策略测试位于本仓，读取公共核心实现，不在公版测试中依赖学校文件。可在本仓执行：

```powershell
$env:EDUWORK_CORE_ROOT = $CoreRoot
node --test edition/test/enterprise-config.test.mjs
```

GitHub 常规桌面 Release 聚焦 Electron。临时客户端、Go/Wails 过渡包和旧版本升级演练由维护者本地完成，不在本仓复制构建代码，也不增加临时双壳 CI 矩阵。旧 ECNU 用户的升级仍须通过本地实包验收，并沿用原兼容分发渠道；现有 Wails 功能候选不能直接当作过渡包下发。

Mac 贡献者先在公共核心完成路径、资源和签名适配，再由学校发行复用同一构建。按锁定公版的 `docs/MACOS.md` 验收真机；没有通过 Mac 验收，不能宣称已有 Mac 发行支持。

## 私有仓库与 CI

仓库私有时，推荐使用专用只读部署密钥。本仓自带的 `GITHUB_TOKEN` 不能读取另一个私有仓。

1. 为这一条 CI 连接生成独立 SSH 密钥，不复用个人登录密钥。
2. 在 EduWork 的 Settings → Deploy keys 添加公钥，不勾选写入权限。
3. 在 EduWork-ECNU 的 Settings → Secrets and variables → Actions 添加 `EDUWORK_CORE_SSH_KEY`，内容为对应私钥。
4. 工作流使用该密钥检出锁定提交，`persist-credentials: false` 避免将凭据留在检出的 Git 配置中。密钥只允许读取 EduWork，不授予写权限或其他私有仓权限。

已有细粒度只读令牌的部署，也可使用 `EDUWORK_CORE_READ_TOKEN`，范围仅限 EduWork 的 Contents: Read。两者任选一种；不要把个人广权限令牌放进 CI。配置方法参见 [GitHub 部署密钥说明](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)。

组织允许私有 Fork 时，Read 协作者可以通过私有 Fork 提交 PR。Fork PR 不接收这个 secret，因此跨私有仓构建会跳过；维护者审阅后在可信分支或本机运行。不要向外部 PR 暴露仓库凭据，也不使用真实学校账号运行公开 PR 检查。

公版公开后设置机构仓 Actions 变量 `EDUWORK_CORE_PUBLIC=true`，删除专用 secret 并撤销对应部署公钥（或只读令牌），即可对 Fork PR 运行不需要学校账号的构建。日常开发构建仅保留 CI 产物；维护者可显式运行 release-windows.yml，为有读取权限的协作者创建私有仓库 Release，不改变仓库可见性。

## 发行

两版使用同一产品版本，版本、升级和共同发行要求以锁定公版的 `docs/RELEASE.md` 为准。历史数据导入、Windows 下载进度与安装功能已进入共用核心；签名、GitHub 更新源接入和每次新包的升级验收仍须分别完成。

旧 ChatECNU Work 用户先通过原更新渠道进入 Go 过渡包，再迁移到更高版本的 Electron。第二跳要求 `wails-host-v1` 契约，从过渡版实际数据目录导入，不能直接使用普通 CI Electron ZIP。该过渡在本地制作和管理，不要求 GitHub 提供临时 Go Release。

公版使用 GitHub Releases；学校发行可增加机构分发渠道。程序文件必须来自 CI，不为学校渠道重新编译。学校配置由维护者在本机加入，装配后的 ZIP 与 CI 原包哈希不同，必须重新生成文件清单、ZIP 的 SHA-256 和更新清单；不能沿用 CI 原包的大小或哈希。依赖沿用各自许可证，共享组件沿用公版第三方声明和装配记录。

更新源部署与 GitHub 接入要求见锁定公版的 `docs/UPDATES.md`。OSS 是可选托管方式，其他静态 HTTPS 服务也可使用；学校仓只维护自己的渠道与发行配置，更新器和 GitHub 来源适配均归公版。当前 CI 只发布新装包，不生成客户端更新清单。配置学校登录的公版仍走公版更新，不因机构名称切换到 ECNU 包。

## Windows Electron Release

本地分发与验收直接下载 GitHub CI 的 Release ZIP，校验 SHA-256 后解压，再单独加入管理员提供的 `config/eduwork.jsonc` 和品牌文件。仓库默认配置不启用实际机构，示例中的 Client ID 是占位符；不得将实际配置提交仓库或注入 CI 安装包。不重新编译或替换公共核心、插件、资源文件，保证与 GitHub 发行的逻辑一致。

学校 OSS 提供的是本机完成配置装配后的发行包，新用户解压后即可使用学校账号登录。发布前必须检查实际企业配置已启用、Client ID 不是占位符，并在全新目录验证配置加载；仅验证旧用户升级不够，因为升级会保留旧配置，无法发现下载包中的默认配置缺失。开发包默认使用开发更新渠道，公测包默认使用公测渠道，已有用户主动选择的渠道和配置继续保留。

本机装配只能修改配置和相应校验清单，保留 CI 原包及其回执，并记录装配包与原包的关联。先上传不可变版本的 ZIP 与校验文件并核验，再更新对应渠道的 latest 清单。旧 Go 过渡渠道单独维护，不随 Electron 新用户下载入口一起切换。

先确认 core.lock.json 的版本、提交及源文件哈希，再在 Actions → Release EduWork@ECNU Windows Electron 手动填写相同的 X.Y.Z。CI 只负责源码/依赖与构建、ZIP 完整性、客户端启动冒烟；完整业务验收在提交前本地完成。构建与发布代码全部复用锁定核心的 scripts/ci-eduwork-windows-release.ps1 与 scripts/publish-windows-release.mjs；本仓只提供发行配置和薄工作流。

发布说明先与项目负责人讨论确认，再存为本仓 `docs/releases/<版本>.md`。触发时填写 `release_notes` 文件路径并确认 `notes_approved`；CI 原样复制该文件并验证摘要，不自动撰写。没有确认的说明时不发布。GitHub 只发 Electron，Go 过渡包由维护者在本地验收后通过原 OSS 升级渠道提供。

验证通过后创建 vX.Y.Z，发布 EduWork-ECNU-X.Y.Z-windows-x64-electron.zip、SHA-256 和回执。私有仓的 Release 仍需要读取权限。此操作不改变仓库可见性、OSS 或老用户升级渠道。原生运行、模拟 OIDC 与学校真实登录分别验收；macOS 与旧 Go 升级另按相应平台和更新契约验证。
