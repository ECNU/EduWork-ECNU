# 音乐创作接入

音乐技能由 `edition/skills/ecnu-music` 和 Host 插件 `tool-ecnu-music` 配合提供。仅导入技能目录不会安装原生工具；需要装配包含该插件的华师版客户端。

当前接入范围限定在 `EduWork-ECNU` 仓库和华师版发行，公版暂不引入音乐插件或技能。插件使用现有 DSH 工具注册和 EduWork OIDC Host 接口，不要求修改 DSH Runtime；它仍依赖宿主提供这些服务，不能仅导入技能目录就获得调用能力。

用户在 EduWork 登录学校账号后即可使用，无需再次输入 Key。学校需给调用主体分配 `ecnu-music`，OAuth 需包含 `llm:invoke`。图像、TTS 和音乐共享 `oidcAccounts.modelAuthorization` / `authorizedFetch`，Token 保存、到期刷新、退出登录失效和请求目标检查均由现有 OIDC Host 实现。音乐插件不读取学校凭据，不向技能或模型暴露 Token。

现有 `media-openai` 适配器支持图像和语音 Provider；音乐服务的 `/music/*` 接口采用异步任务，需要提交、续查、取消、列出产物和下载等操作，不能仅增加一个图像或 TTS 模型配置。这里新增的插件负责这些音乐接口与原生工具的适配，复用已有登录能力；skill 负责创作流程与工具选择。将音乐适配单独放在学校仓库，便于独立迭代，也符合本轮仅华师版接入的范围。

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
| `ecnu_music_library` | 当前工作区的本地创作记录 | 不请求服务器 |
| `ecnu_music_submit` | `generate`、`plan`、`cover`、`transcribe` | POST `/music/generations`、`plans`、`covers`、`transcriptions` |
| `ecnu_music_job` | 续查任务或候选 | GET `/music/jobs/{id}` |
| `ecnu_music_cancel` | 用户主动取消 | POST `/music/jobs/{id}/cancel` |
| `ecnu_music_artifacts` | 列出实际产物 | GET `/music/jobs/{id}/artifacts` |
| `ecnu_music_download` | 下载并保存命名产物 | GET `/music/jobs/{id}/artifacts/{name}` |

工具输出 `reportJSON`；下载另提供 `relativePath` 和 `mime`，沿用现有媒体工具的工作区预览约定。所有音频输入、回执和输出限定在当前工作区；外部附件先复制进工作区。音频上传上限 39 MiB，下载上限 128 MiB。提交、取消和下载遵循 Host 当前权限模式；只读模式通过原生审批入口请求授权。

音乐服务采用异步任务：提交 HTTP 202 后立即返回任务 ID，不将长时间推理塞进一次工具调用。客户端请求超时只限制 HTTP 调用，不终止服务器推理。每次提交前将 UUID 幂等键和参数摘要保存到 `.eduwork/generated/music/request-*.json`，接受后另存任务 ID；相同回执只续查已接受任务，未知结果不自动重放 POST。若提交结果丢失且尚未持久化任务 ID，需要服务管理员按幂等键确认；不假定重登录或换账号后仍可安全重试。

任务归属由线上网关校验，查询与下载使用创建时的身份。音乐只在华师版增加协议适配，不修改 image/TTS 的 Provider 注册。Music Studio 和技能均复用这些原生工具。

## Music Studio

音乐工作室是独立侧栏页签，类型为 `ecnu-music-studio`，与 Knowledge Studio 分开。新打开时默认使用宿主的展开视图，可通过标题栏「收回侧栏 / 展开工作室」切换；恢复的历史页签沿用宿主保存的布局。切换布局或临时隐藏页签时保留草稿，关闭页签或退出应用前仍应保存需要保留的内容。使用宿主的侧栏展开、关闭与会话归属机制；不另建全屏浮层。

1. 在带工作区的对话中打开「音乐工作室」，选择歌曲创作、翻唱改编、旋律规划或音频转谱。界面先读取服务能力，再允许提交对应任务。
2. 填写歌词和编曲描述。翻唱与转谱填写工作区音频路径，可先在对话里提供文件并让助手放入工作区；本版没有独立文件上传控件。
3. 任务提交后进入作品库。选中任务时每 5 秒续查；隐藏页签暂停续查，关闭界面不取消服务器任务。查询失败会停止轮询，使用「刷新状态」恢复查询。
4. 双候选任务按候选分别列出产物。点击实际产物名保存到工作区，音频可试听，ABC 可排版为五线谱、编辑并导出。点击「用这份谱创作」保留歌词并建立新版本草稿；再次提交才启动新任务。

`title`（最多 120 字符）、`parent_request_id` 是提交工具的本地元数据，不发送给音乐模型。新回执还保存创作参数和完整歌词，属于工作区用户文档，应按项目内容保管；历史回执若没有参数，仍可查询任务，但无法恢复原始创作表单。本地库按服务地址及配置档案分组，不代表账号级隔离；服务器始终校验当前调用身份的任务归属。未确认的提交不会自动重放。

UI 通过 `ecnuMusicStudio.execute(sessionId, action, argumentsJSON)` 调用 Host 的 `tools.execute`，只允许音乐工具白名单，经过原生权限链；不向 renderer 提供认证信息。只读预览 RPC 仅允许当前会话 `.eduwork/generated/music` 中的普通音频与 ABC 文件，拒绝路径跳出、符号链接和回执读取。音频内嵌预览上限 32 MiB，ABC 上限 256 KiB；超限仍可从宿主文件预览打开已下载的原文件。

ABC 排版使用随包固定的 abcjs 6.7.2，无 CDN 或在线字体依赖。ABC 五线谱与模型生成音频分别呈现，不宣称逐音对齐、完整 SATB 或管弦乐总谱。精确时长、音色克隆、分轨混音和局部重生成不在此版范围内。

## 本地交互预览

设置 `EDUWORK_TEST_RUNTIME` 为固定版本装配产品的 `d` 目录，然后执行：

```powershell
node edition/plugins/tool-ecnu-music/test/build-studio.mjs
```

打开插件目录下 `dist/music-studio/index.html` 即可离线体验同一 React 界面。预览明确使用合成作品与本地合成试听音，不读取学校账号、不调用线上模型、不代表桌面端验收。页面提供侧栏宽度与深色切换；刷新页面会重置示例任务。原生客户端构建产物另为 `dist/music-studio/client.js`，正式发行仍由固定核心的装配脚本构建。

## 验证与装配

插件逻辑测试：`node --test edition/plugins/tool-ecnu-music/test/core.test.mjs edition/plugins/tool-ecnu-music/test/model.test.mjs`。

挂载测试使用已装配的 DSH Runtime：设置 `EDUWORK_TEST_RUNTIME` 为产品 `d` 目录，运行 `node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/tool-ecnu-music/test/mounted.test.mjs edition/plugins/tool-ecnu-music/test/studio.test.mjs`。测试只使用合成账号和本地响应，不消耗线上生成额度。发行装配通过现有 `edition/test/test-desktop-candidate.ps1` 纳入这些测试；源码接入与正式客户端发布分别进行。

浏览器验证先构建预览，再运行 `node edition/plugins/tool-ecnu-music/test/browser-studio.mjs`。需要 Playwright 浏览器；可设置 `MUSIC_TEST_BROWSER_CHANNEL=msedge` 使用本机 Edge。验证包含离线打开、音频解码、ABC 排版、谱复用、双候选、取消和窄侧栏。

真实验收需在包含该插件的客户端用学校登录查询能力、提交任务、退出/重登录后续查，并实际下载试听。自动化模拟测试不能替代这个验收。当前接口无精确时长参数；乐谱格式以产物为准，ABC 不是 PDF，也不是保证完整配器的总谱。
