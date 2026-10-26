# 音乐创作接入

音乐技能由 `edition/skills/ecnu-music` 和 Host 插件 `tool-ecnu-music` 配合提供。仅导入技能目录不会安装原生工具；需要装配包含该插件的华师版客户端。

用户在 EduWork 登录学校账号后即可使用，无需再次输入 Key。学校需给调用主体分配 `ecnu-music`，OAuth 需包含 `llm:invoke`。图像、TTS 和音乐共享 `oidcAccounts.modelAuthorization` / `authorizedFetch`，Token 保存、到期刷新、退出登录失效和请求目标检查均由现有 OIDC Host 实现。音乐插件不读取学校凭据，不向技能或模型暴露 Token。

## 配置

发行默认值在 `edition/distribution.json`，个人覆盖放在同一份 `eduwork.jsonc`：

```json
{
  "plugins": {
    "chatecnu-music": {
      "baseURL": "https://chat.ecnu.edu.cn/open/api/v1",
      "oidcProfileId": "ecnu",
      "credentialRef": "EDUWORK_API_KEY",
      "requestTimeoutMs": 120000
    }
  }
}
```

`baseURL` 是学校模型 API 根地址，不带 `/music`；必须与该学校账号发现的模型 API 地址一致。音乐适配器在其下调用 `/music/*`，不会扩大 OIDC 的可访问范围。学校账号模式中 `credentialRef` 不会被读取；未登录、授权不足或地址不一致时不回退到个人 Key。

独立 Key 部署可显式将 `oidcProfileId` 设为 `""`，通过凭据管理器保存 `credentialRef` 对应 Key；不要把明文 Key 写入 JSONC。这种部署的技能元数据也需去掉学校 `oidcProfileId` 绑定，保留 `credentialRef`，才能按独立凭据显示。默认华师版保持学校登录绑定。

## 原生工具

| 工具 | 用途 | HTTP 路由（相对模型 API 根） |
| --- | --- | --- |
| `ecnu_music_capabilities` | 查询当前能力 | GET `/music/capabilities` |
| `ecnu_music_submit` | `generate`、`plan`、`cover`、`transcribe` | POST `/music/generations`、`plans`、`covers`、`transcriptions` |
| `ecnu_music_job` | 续查任务或候选 | GET `/music/jobs/{id}` |
| `ecnu_music_cancel` | 用户主动取消 | POST `/music/jobs/{id}/cancel` |
| `ecnu_music_artifacts` | 列出实际产物 | GET `/music/jobs/{id}/artifacts` |
| `ecnu_music_download` | 下载并保存命名产物 | GET `/music/jobs/{id}/artifacts/{name}` |

工具输出 `reportJSON`；下载另提供 `relativePath` 和 `mime`，沿用现有媒体工具的工作区预览约定。所有音频输入、回执和输出限定在当前工作区；外部附件先复制进工作区。音频上传上限 39 MiB，下载上限 128 MiB。提交、取消和下载遵循 Host 当前权限模式；只读模式通过原生审批入口请求授权。

音乐服务采用异步任务：提交 HTTP 202 后立即返回任务 ID，不将长时间推理塞进一次工具调用。客户端请求超时只限制 HTTP 调用，不终止服务器推理。每次提交前将 UUID 幂等键和参数摘要保存到 `.eduwork/generated/music/request-*.json`，接受后另存任务 ID；相同回执只续查已接受任务，未知结果不自动重放 POST。若提交结果丢失且尚未持久化任务 ID，需要服务管理员按幂等键确认；不假定重登录或换账号后仍可安全重试。

任务归属由线上网关校验，查询与下载使用创建时的身份。音乐只在华师版增加协议适配，不修改 image/TTS 的 Provider 注册，不把静态背景音乐库当作生成接口，也未新增 Studio 音乐编辑界面。以后其他 UI 可以复用这些原生工具，避免另建授权和下载路径。

## 验证与装配

插件逻辑测试：`node --test edition/plugins/tool-ecnu-music/test/core.test.mjs`。

挂载测试使用已装配的 DSH Runtime：设置 `EDUWORK_TEST_RUNTIME` 为产品 `d` 目录，运行 `node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/tool-ecnu-music/test/mounted.test.mjs`。测试只使用合成账号和本地响应，不消耗线上生成额度。发行装配通过现有 `edition/test/test-desktop-candidate.ps1` 纳入这些测试；源码接入与正式客户端发布分别进行。

真实验收需在包含该插件的客户端用学校登录查询能力、提交任务、退出/重登录后续查，并实际下载试听。自动化模拟测试不能替代这个验收。当前接口无精确时长参数；乐谱格式以产物为准，ABC 不是 PDF，也不是保证完整配器的总谱。
