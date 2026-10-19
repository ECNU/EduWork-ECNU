# OSS 增量更新分发

OSS 的增量准备独立于 GitHub 桌面发布。GitHub 仍提供原始安装包与构建回执；本流程只比较已发布原包，生成供 OSS 使用的差分，不重新装配应用、不修改 GitHub Release 或标签。

## 准备差分

运行 **Prepare OSS delta delivery**，指定已发布版本。Windows 和 macOS 各取同一学校发行最近三个较旧版本作为基线，包含正式版与开发版；目标版本仍决定 stable/development 渠道。`latest` 按版本顺序选择最新已发布版本，不能用于发布一个尚未存在的版本。

该只读工作流下载带 GitHub SHA-256 的原包，调用 `core.lock.json` 锁定公版的差分实现：

- Windows 使用文件级增量，保持原始发布清单与文件内容。
- macOS 在原生 Mac 上使用锁定的 Sparkle BinaryDelta；生成后实际应用差分，并将还原目录与目标应用逐文件比较。
- 差分超过完整 ZIP 一半时省略，保留全量更新。更早版本或没有匹配基线的客户端仍获取完整包。

输出 `oss-deltas-windows` / `oss-deltas-macos` artifact，包含差分、校验和及 `delta-receipt.json`。发布人员应核对 Actions 来源提交、目标版本及 artifact 摘要，再接入 OSS 部署。工作流不持有 OSS 凭据或 Mac 签名私钥，也不上传 GitHub 附件。

本地可使用相同入口；Mac 差分必须在 macOS 执行。缓存中的原包每次按 GitHub 大小和 SHA-256 复核，已有内容不匹配会停止；输出目录必须是新目录。

```sh
node edition/release/oss-deltas.mjs --core ../EduWork \
  --version 0.4.6-dev.20261017.1 --platform windows \
  --cache /path/to/verified-archives --output /path/to/new-oss-deltas
```

## 接入 OSS 发布步骤

1. 保留原 CI ZIP、安装包和构建回执，验证原包与 GitHub 摘要一致。
2. 完成上述差分准备，检查差分回执中的 `target.archive` 与本次完整包一致。不能因目标是开发版而跳过此步骤。
3. 用 `oss-feed-inputs.mjs` 生成渠道清单输入；它再次检查完整包及差分大小、SHA-256，输出目录必须不存在。
4. 上传完整包和差分到同一不可变版本目录。对全部对象回读校验通过后，才提升渠道清单。
5. Windows 清单必须保留完整 artifact，同时带上 `deltas`；不能复制 GitHub 的原清单覆盖掉 OSS 新增的差分条目。
6. Mac 使用派生的 `macos-signing-receipt.json` 和同目录原 ZIP，通过公版 `scripts/macos-update-feed.mjs sign` 签署完整包与每个差分，独立验签后更新 appcast。更新已有版本时替换该版本的整个 item，保留其他版本 item；不要重复插入同版本条目。
7. 回读线上清单，验证匹配基线选择增量、不匹配基线回退全量，以及 stable/development 隔离。开发版发包不得覆盖 stable 清单；发布正式版时，development 的 Mac appcast 也应包含该正式版，以便开发用户正常转入正式版。
8. **正式版还必须同步官网指针。** 网站读取 `releases-bridge/stable/website/latest-windows-amd64.json` 和 `latest-macos-arm64.json`，不读取客户端更新清单。正式版的差分 artifact 同时提供这两个平台各自的指针，分别只引用原 CI Windows setup ZIP 和 macOS DMG。安装包及其校验文件回读验证后，上传两份指针并设置 `Cache-Control: no-cache`，保留站点跨域读取能力；开发版不生成或更新这些指针。
9. 发布完成前运行下述官网线上校验。仅四份客户端渠道清单成功，不代表正式版 OSS 交付完成；两份官网指针也必须版本一致、链接可用、大小与 SHA-256 匹配，否则发布状态仍应为未完成。

Windows 清单输入示例（`base-url` 是完整版本目录）：

```sh
node edition/release/oss-feed-inputs.mjs --core ../EduWork \
  --delta-directory /path/to/oss-deltas-windows \
  --archive-directory /path/to/original-archives \
  --full-receipt /path/to/windows-release-receipt.json \
  --full-manifest /path/to/update-windows-amd64.json \
  --base-url https://downloads.example.org/development/0.4.6-dev.20261017.1/ \
  --output /path/to/new-windows-feed-inputs
```

Mac 使用 Mac artifact、ZIP 目录与 `macos-release-receipt.json`，省略 `--full-manifest`。输出中的 `ossDerived` 表示额外生成的 OSS 差分签名输入，不是改写原始 CI 构建回执。签名私钥与 OSS 凭据保留在发行环境，不进入源码或 Actions artifact。

首次部署、更新器能力与授权边界继续遵循 [构建指南](BUILD.md)。直接下载 setup/DMG 仍是完整安装；增量用于应用内更新。

## 官网安装包指针

官网指针只包含安装包信息，不含客户端的增量条目，也不能覆盖 Windows 更新 ZIP 清单或 Mac appcast。无需为更换下载版本重新构建网站。

保存本次已发布 GitHub Release 的 JSON 后，可单独准备两份指针，再在部署后验证线上结果：

```sh
gh api repos/ECNU/EduWork-ECNU/releases/tags/v0.4.6 > release.json
node edition/release/website-pointers.mjs prepare --release release.json --output /path/to/new-website-pointers
# 获得 OSS 部署授权并完成原安装包校验后，上传上述两份指针。
node edition/release/website-pointers.mjs verify --release release.json
```

该入口不上传文件、不携带部署凭据。`verify` 检查两个平台的完整指针内容、缓存与 CORS、安装包可访问性和大小、SHA-256 校验文件；原安装包的完整字节哈希仍须按前述部署步骤验证。域名可通过 `--origin https://downloads.example.org` 指定，路径保持站点约定。校验失败时不要将正式版交付标记为完成。
