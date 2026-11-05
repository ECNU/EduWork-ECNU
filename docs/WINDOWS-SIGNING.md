# Windows 硬件签名与候选交付

[返回构建指南](BUILD.md)

本流程仅适用于 `ECNU/EduWork-ECNU`。应用仍由 `core.lock.json` 锁定的公共核心构建；学校仓负责签名策略、两轮分离签名和交付门禁，不要求公共仓安装学校证书或持有私钥。

## 输入与产物

- [证书策略](../edition/windows-signing.json) 只包含公开证书、固定发布者、指纹和时间戳地址。证书轮换须修改策略并重新审查候选。
- [Setup 工具锁](../edition/release/windows-signing/tools.lock.json) 单独固定支持 Authenticode 尾部证书表的解压器源码。它仅用于 Setup，业务核心、运行时、启动器和更新器仍来自 `core.lock.json`。
- 正式候选须通过源码快照、依赖、原始桌面启动和学校签名配置首次加载。签名结束后对实际解压的包再次执行首次启动、原生运行时及清单校验。
- 原始 CI 产物名为 `windows-unsigned`，保留原构建回执；它不能进入学校发布入口。只有最后一轮签名验收通过才产生 `windows-release`。
- 第三方原生文件按 DOS/PE 文件头识别 Windows PE 后检查原有签名；随依赖附带的 Mach-O/ELF 不调用 Authenticode。损坏或截断的 PE 仍拒绝，所有非自有文件继续参与完整 manifest 哈希比对，不重签第三方文件。
- 最终包含全量 ZIP、Setup ZIP、版本化 `EduWork-ECNU-<version>-windows-x64-setup.exe`、对应 SHA256、签名来源回执及从已发布旧版本生成的差分。更新器仍使用原全量 ZIP 和差分协议。

## 操作顺序

1. 合并审核过的源码、证书策略和已确认发布说明；运行 **Build ECNU desktop release candidates**，`platform=both`、`publish=false`。记录成功运行 ID 和精确提交。
2. 在相同提交运行 **Sign ECNU Windows candidates**，`stage=inner-request`，填写原构建的 `source_run_id`。托管机从经 GitHub artifact SHA256 验证的原包生成 4 个自有 EXE 的 `/dg` 请求，不接触私钥。
3. 下载 `windows-signing-request`，核对仓库、版本、提交、原构建、请求运行及请求 SHA256。维护者在接有 USB Key 的本机运行下面的脚本，重新校验实际 PE 内容与 CMS 摘要后执行 `/ds`。脚本默认只下载 `windows-signing-files` 中的签名目标，不下载整个程序目录。
4. 同一提交运行 `stage=outer-request`，`source_run_id` 不变，`parent_run_id` 为内层请求运行，`response_json` 填本机输出的公开签名 JSON。托管机执行 `/di`、SHA-256 时间戳及完整验签，再重算 manifest/全量 ZIP，用独立锁定的工具构建 Setup 并生成第二轮请求。
5. 本机按相同检查签署 Setup 请求；运行 `stage=finalize`，父运行改为第二轮请求。托管机回填并验签 Setup，实际解压、验证 4 个内部签名、逐文件比对未签名目标，重新首启并生成差分。最终 ZIP 直接来自该运行，不在本机重新装配。
6. 运行 **Publish ECNU desktop candidate**，同时提供原始 `source_run_id` 和最终 `windows_signing_run_id`，先令 `publish=false` 验证三平台及完整来源链。获得发布授权后在 main 以同一对 ID 设置 `publish=true`。发布器直接上传现有 CI 文件，不重建或从维护者电脑转传。

本机命令（PowerShell，路径和运行 ID 替换为已核对值）：

```powershell
$env:EDUWORK_CORE_ROOT = 'C:/path/to/pinned-public-core'
# GITHUB_TOKEN 由本机凭据入口提供，只需仓库及 Actions 读取权限；不要写入脚本或回执。
node edition/release/windows-signing/sign-request.mjs `
  --request C:/signing/request/request.json `
  --output C:/signing/unique-new-response-directory `
  --repository ECNU/EduWork-ECNU `
  --edition-commit <40位学校提交> --core-commit <40位核心提交> `
  --source-run <原构建ID> --request-run <本轮请求ID> `
  --request-sha256 <请求哈希> --policy-sha256 <策略哈希> --version <版本>
```

请求哈希为 `SHA256(JSON.stringify(request))`，策略哈希为 `SHA256(JSON.stringify(policy))`，不是带缩进 JSON 文件的原始字节哈希。请求生成运行的日志会打印请求哈希。所有字段必须与审核过的运行一致；不能只根据外来摘要调用 Key。可通过 `--payload-root` 复用已下载且逐项哈希一致的签名目标。

PIN 由 SafeNet 提供程序处理，脚本不接受 PIN、PFX 密码或私钥。GitHub 只接收公开证书和公开签名值。SignTool 必须具有有效微软签名；签名目标严格限定四个学校自有 EXE 和 Setup，第三方文件不重签。

## 门禁与重试

原始构建、内层请求、Setup 请求和最终回填是四个不同运行，必须位于同一学校提交；每层记录 artifact ID、字节数、传输 ZIP SHA256、请求与回复。回复须包含完整且唯一的目标，RSA 签名须与请求中的证书和摘要匹配。跨仓库、跨版本、跨提交或跨阶段回复都会拒绝。

`/dg` 可能规范化未签 PE 的证书区域，因此请求同时记录原始哈希和规范化后哈希。本机重新生成摘要时只操作独立副本；最终回填使用托管机的同一组字节。打包器只读检查已签更新器的权限清单，并验证操作前后哈希一致。

失败保留 Actions 日志和 artifact；不要用本机验收包替代正式产物。签名回复可复用于同一请求的回填重试；换请求、提交或输入后必须重新核对。新的运行 ID 不能冒充旧请求 ID。发布失败优先使用同一最终 artifact 重试，已有不同字节的 Release 附件拒绝覆盖；已有公开 Release 必须附件、标签和稳定版 Latest 全部匹配。

GitHub、程序 OSS 和官网指针的上线授权分别处理。OSS 若提供额外 EXE，必须复制 GitHub 同一版本的字节并校验 SHA256。文件名固定或可下载不等于 SmartScreen 信誉通过，发布者签名也不取消权限提示。

## 验证

```powershell
$env:EDUWORK_CORE_ROOT = 'C:/path/to/pinned-public-core'
node --test edition/test/windows-signing.test.mjs
```

单元测试使用临时合成证书，不调用硬件 Key。维护者可额外设置 `EDUWORK_SIGNED_UPDATER_FIXTURE` 为已签更新器副本，执行真实 PE 的打包只读验证；CI 最终签名流程会对真实完整包执行同一检查。不要将单元测试或本机小样视为正式候选验收。

参考：[Microsoft SignTool](https://learn.microsoft.com/en-us/windows/win32/seccrypto/signtool)、[GitHub Actions artifact API](https://docs.github.com/en/rest/actions/artifacts)。
