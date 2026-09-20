# ECNU 发行构建与协作

[返回项目首页](../README.md)

本仓只维护 `edition/` 下的机构发行配置、服务适配器、品牌资源和集成测试。公共身份与资源协议、文件工具、Studio、预览、图像与云端 TTS 适配、本机语音和构建逻辑由公版或独立组件维护，不在这里复制一套。

学校版默认采用红色配色，并复用锁定公版的红色应用图标（Windows ICO、macOS ICNS 和窗口／托盘 PNG），不另存一份学校图标。用户主动保存的蓝色或红色界面偏好继续保留；应用图标始终使用统一的红色。品牌资源说明见公版 `assets/eduwork/README.md`。

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

此命令生成本机 Web 验证产物，不是完整桌面安装包。公共脚本、缓存模式和原生资源要求见锁定公版中的 `docs/BUILD.md`。完整 Electron 测试包使用公版 [BUILD.md](https://github.com/ecnu/EduWork/blob/main/docs/BUILD.md#从-web-到桌面) 的机构命令，复用 CI 配方自动准备锁定资源；它只产出本地测试包。分阶段调试见公版 `dsh-electron/README.md`，不覆盖为开发快照。两种 Windows 桌面壳共用功能实现。

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

当前两仓均为公开仓库，PR 验证工作流直接通过只读 `GITHUB_TOKEN` 检出锁定的公共核心，不依赖 `EDUWORK_CORE_PUBLIC` 变量，也不使用跨仓 secret。外部 Fork 的构建仍须遵守维护者审批设置，不使用学校账号。日常开发构建仅保留 CI 产物；发布工作流须由维护者显式触发，不改变仓库可见性。

## 发行

两版使用同一产品版本，版本、升级和共同发行要求以锁定公版的 `docs/RELEASE.md` 为准。历史数据导入、Windows 下载进度、GitHub 来源适配与安装功能已进入共用核心；每个新包仍须验收实际升级，代码签名另行推进。

旧 ChatECNU Work 用户先通过原更新渠道进入 Go 过渡包，再迁移到更高版本的 Electron。第二跳要求 `wails-host-v1` 契约，并从过渡版实际数据目录导入。当前 CI 的开发包和公测包均写入该契约；维护者必须验收具体 ZIP 的兼容性，不能将 Electron 直接下发给未支持该契约的 0.2 更新器。该过渡在本地制作和管理，不要求 GitHub 提供临时 Go Release。

公版使用 GitHub Releases；学校发行可增加机构分发渠道。程序文件必须来自 CI，不为学校渠道重新编译。学校配置通过签名内容源下发；程序 ZIP 保持 CI 原包不变，学校更新清单使用 CI 原包的实际大小和 SHA-256。依赖沿用各自许可证，共享组件沿用公版第三方声明和装配记录。

更新源部署与 GitHub 接入要求见锁定公版的 `docs/UPDATES.md`。OSS 是可选托管方式，其他静态 HTTPS 服务也可使用；学校仓只维护自己的渠道与发行配置，更新器和 GitHub 来源适配均归公版。当前 CI 的开发包和公测包均含包内更新契约；公测和获批开发 Release 均生成 `update-windows-amd64.json`。普通开发构建只保留 artifact，推送 GitHub 开发渠道仍需获批发布 prerelease 及配套清单。学校静态更新清单以 CI 原包的实际哈希和大小生成。配置学校登录的公版仍走公版更新，不因机构名称切换到 ECNU 包。

## Electron 开发候选与发行

`Build ECNU desktop release candidates` 工作流在 Windows x64 与 macOS arm64 上分别构建同版本候选，只保留经检查的 artifact，不自动发布。版本号与 `docs/releases/<version>.md` 内容须事先确认。维护者下载产物完成学校配置与登录验收后，才将原包发布到 GitHub 和 OSS；两处 ZIP 的 SHA-256 必须一致。Mac 当前限 macOS 15+ Apple Silicon，只有 ad-hoc 签名，尚未 Apple 公证或实现整包自动安装更新。不得把 Windows 更新包配置到 Mac 渠道。

本地分发与验收直接下载 GitHub CI 的 ZIP，校验 SHA-256 后即可使用。`edition/desktop/configuration-policy.json` 声明发行方管理配置，`edition/desktop/publisher-bootstrap.json` 内置软件与内容更新源、验签公钥；不包含实际 Client ID、模型目录或个人凭据。默认配置的机构列表为空，首次启动下载签名学校配置。无需在 Windows 本机重新装配，也无需为 Mac 另做配置 PKG。完整格式见公版 [首次启动获取配置](https://github.com/ecnu/EduWork/blob/main/docs/PUBLISHER_BOOTSTRAP.md)。

学校通过公版 `scripts/create-content-update.mjs` 在私有发行目录生成签名配置与 Skills 包。先上传不可变内容包并验证，再更新对应渠道的 `latest.json`，最后开放应用下载。首次发布前，确保每个支持的渠道均有兼容程序版本、DSH、插件能力和平台的内容清单；仅支持 Windows 的内容包不能作为 Mac 的首次配置。必须验证新用户完整登录流程、断网重启、旧用户配置迁移和失败回退，不能仅凭旧安装能启动就认定新安装可用。

学校 OSS 提供与 GitHub CI 字节一致的应用 ZIP。更新清单采用该原包的 SHA-256 与大小。开发包默认使用开发渠道，公测包默认使用公测渠道，用户已经保存的选择优先。旧 Go 过渡渠道仍单独维护。

Windows 生效配置为安装目录的 `config/eduwork.jsonc`；Mac 为 `~/Library/Application Support/eduwork-chatecnu-electron/config/eduwork.jsonc`。配置可以直接编辑，重启生效；签名更新保留手工修改，只保留 `data/configuration/eduwork.previous.jsonc` 一份回退备份。旧版实际生效的配置会迁入该入口，成功启动后清理未修改的旧入口。应用不修改 `.app`、个人模型、登录凭据和历史。全新安装无法下载时可以重试或导入签名离线包。参见公版[配置文件](https://github.com/ecnu/EduWork/blob/main/docs/CONFIGURATION.md)。
