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
| `ecnu_music_render_score` | ABC 排版为独立离线 HTML 五线谱 | 本地执行，不请求服务器或学校授权 |
| `ecnu_music_export_song` | 歌词、原音频、五线谱的完整 HTML 作品目录 | 本地执行，不请求服务器或学校授权 |
| `ecnu_music_submit` | `generate`、`plan`、`cover`、`transcribe` | POST `/music/generations`、`plans`、`covers`、`transcriptions` |
| `ecnu_music_job` | 续查任务或候选 | GET `/music/jobs/{id}` |
| `ecnu_music_cancel` | 用户主动取消 | POST `/music/jobs/{id}/cancel` |
| `ecnu_music_artifacts` | 列出实际产物 | GET `/music/jobs/{id}/artifacts` |
| `ecnu_music_download` | 下载并保存命名产物 | GET `/music/jobs/{id}/artifacts/{name}` |

工具输出 `reportJSON`；下载和乐谱排版另提供 `relativePath` 和 `mime`，沿用现有媒体工具的工作区预览约定。所有文件输入、回执和输出限定在当前工作区；外部附件先复制进工作区。音频上传上限 39 MiB，下载上限 128 MiB。提交、取消、下载和排版遵循 Host 当前权限模式；只读模式通过原生审批入口请求授权。

音乐服务采用异步任务：提交 HTTP 202 后立即返回任务 ID，不将长时间推理塞进一次工具调用。客户端请求超时只限制 HTTP 调用，不终止服务器推理。每次提交前将 UUID 幂等键和参数摘要保存到 `.eduwork/generated/music/request-*.json`，接受后另存任务 ID；相同回执只续查已接受任务，未知结果不自动重放 POST。若提交结果丢失且尚未持久化任务 ID，需要服务管理员按幂等键确认；不假定重登录或换账号后仍可安全重试。

任务归属由线上网关校验，查询与下载使用创建时的身份。音乐只在华师版增加协议适配，不修改 image/TTS 的 Provider 注册。Music Studio 和技能均复用这些原生工具。

## 对话式使用

音乐技能可以直接调度上述原生工具，不依赖打开 Music Studio。用户可以要求原创歌曲、两首候选、原曲改编、先规划旋律、音频转谱，或读取 ABC 后重新生成；学校登录由 Host 复用，用户不需要填写接口参数。

“找回上次那首”“保留歌词换一种风格”等续作通过本地创作库、任务续查和父版本记录衔接。不同风格是独立任务，同一风格的两个候选才使用 `n=2`。完整的多阶段流程按用户要求推进，只要求规划或讨论时不额外提交生成。

ABC/MIDI 的获取属于模型产物交付；已有 ABC 可通过本地 `ecnu_music_render_score` 排版，无需学校登录或启动生成任务。输入 `abc` 文本或工作区内的 `abc_path`（二选一，最多 256 KiB UTF-8，需有 `K:` 字段），以及可选的 `title`（最多 120 字符）。返回 `.eduwork/generated/music/score-<uuid>.html`，每次生成新文件，保留原 ABC。

HTML 内嵌 abcjs 6.7.2 与许可，浏览器直接离线打开后生成 SVG 五线谱，可查看源码、下载 ABC、打印 / 另存 PDF。页面使用 CSP 限制网络与脚本，文本输入按数据处理。文件创建成功不代表浏览器排版或音符准确性已验证；HTML 也不是已导出的 PDF。精确时长、音色克隆、分轨混音、局部音频修补和完整配器总谱不属于现有接口承诺。

音乐技能默认先用随附 `scripts/prepare-media.mjs` 生成 MP3 192 kbps 分享副本，再作为独立音频和作品页输入；无损源保留在原下载处。歌曲视频默认生成 720p H.264/AAC 小体积副本，不修改公共核心编码器或音乐下载协议。脚本复用已安装媒体运行时，拒绝覆盖源文件/已有输出，核对完整时长并记录大小回执；用户指定无损或更高画质时遵从。参见[媒体交付预设](../edition/skills/ecnu-music/references/media-delivery.md)。

完整歌曲交付可用 `ecnu_music_export_song`：必填 `audio_path` 和原始 `lyrics`，以及 `abc` / `abc_path` 二选一；可选 `title`、`style` 和 `timeline_path`。音频支持 FLAC、MP3、WAV、OGG，最多 128 MiB；歌词最多 16000 字符，标题 120，风格 2000，ABC 限制同上。输入文件限当前工作区，输出遵循 Host 写入权限。

工具新建 `.eduwork/generated/music/song-<uuid>/`，内含 `index.html`、`audio.*`、`lyrics.txt`、`score.abc`、`timeline.json` 和 `song-timeline.js`。音频分块复制并保留原字节，通过相对路径播放，不做 Base64 内嵌，也不依赖服务下载链接。作品页默认完整列出歌词，配背景与原曲播放器；手机歌词区可滚动、播放器常驻，PC 并排看谱。可选自动浏览按整曲时长滚动，明确不是演唱同步，不依赖 ASR。乐谱试听默认用本地 FluidR3 钢琴采样按 ABC 合奏并高亮，原曲与试谱互斥。各声部保留身份，支持独奏、静音、音量和合成音色选择；默认所有旋律声部和和弦伴奏启用、居中并保留原始力度，仅嵌入该谱需要的采样；和弦标记生成的可选伴奏，不代表从原音频分离的分轨。字幕导入/校时折叠为可选工具，支持谱面缩放、下载及打印。分享或迁移需携带整个目录，不包含工作区绝对路径、账号或任务回执。

回执另提供 `audioPath`、`audioRelativePath` 与 `audioMime`，用于交付独立音频入口。当前内置 HTML 文件预览尚未接入同目录音频；技能使用 `scripts/serve-song.mjs start <作品目录>` 启动仅监听本机的临时 HTTP 服务，以实际 URL 打开网页，或降级到外部浏览器直接打开 HTML。服务支持 Range，保留 PID、日志与状态，提供 `status`、`stop` 命令，不修改核心预览。导出、外部浏览器播放、桌面网页预览需分别验证，不将预览兼容问题当作账号或文件夹权限问题。

时间轴用音频与 ABC 的 SHA-256 绑定版本，拒绝错配、重叠或越界时间。SRT/LRC/Caption JSON 导入默认草稿；LRC 结束时间需再校对。页面的校时更改需导出保存，再用 `timeline_path` 生成新的作品目录。共用格式与本地服务命令见[HTML 同步作品页](../edition/skills/ecnu-music/references/song-timeline.md)。当前没有自动歌词强制对齐工具，生成 ABC 的速度不证明最终音轨同步。

HTML 以 `audio.currentTime` 驱动画面，共用 `song-timeline.js` 的 `sampleReading` 提供按时长自动浏览；后续 Remotion 用 `frame / fps` 驱动同一滚动规则。只有唱词同步模式才使用 `sampleTimeline` 与实际字幕。当前实现包含 HTML 及共用时间模型；歌曲视频仍需现有可编辑视频工具完成场景与编码，不把它描述为已完成的一键 MP4 导出。工作流见[歌曲视频](../edition/skills/ecnu-music/references/song-video.md)。

## Music Studio

对话使用及 HTML 乐谱交付均不依赖打开此界面。

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

插件逻辑测试：在 `edition/plugins/tool-ecnu-music` 目录运行 `npm test`，覆盖任务协议、输入、排谱与完整作品目录。

挂载测试使用已装配的 DSH Runtime：设置 `EDUWORK_TEST_RUNTIME` 为产品 `d` 目录，运行 `node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/tool-ecnu-music/test/mounted.test.mjs edition/plugins/tool-ecnu-music/test/studio.test.mjs`。测试只使用合成账号和本地响应，不消耗线上生成额度。发行装配通过现有 `edition/test/test-desktop-candidate.ps1` 纳入这些测试；源码接入与正式客户端发布分别进行。

浏览器验证先构建预览，再运行 `node edition/plugins/tool-ecnu-music/test/browser-studio.mjs`。需要 Playwright 浏览器；可设置 `MUSIC_TEST_BROWSER_CHANNEL=msedge` 使用本机 Edge。验证包含离线打开、音频解码、ABC 排版、谱复用、双候选、取消和窄侧栏。

独立乐谱工具的浏览器验证：使用同一 `EDUWORK_TEST_RUNTIME`，运行 `node edition/plugins/tool-ecnu-music/test/browser-score.mjs`，无需构建 Studio。可设置 `MUSIC_SCORE_ABC` 为实际 ABC 路径，`MUSIC_SCORE_OUTPUT_ROOT` 为本地验证目录（默认插件 `dist/score-check`）。检查离线 SVG 排版、ABC 下载往返、窄屏页面宽度、打印样式、输入注入无效及无 HTTP 请求；输出 HTML、截图和 `checks.json`。这些检查不等同于音符准确性或桌面客户端发布验收。

完整作品页浏览器验证使用 `node edition/plugins/tool-ecnu-music/test/browser-song.mjs`，默认生成合成音频与示例谱。可通过 `MUSIC_SONG_INPUT` 指向私有 JSON `{ "root": "工作区路径", "args": { ...工具参数 } }` 使用真实产物，`MUSIC_SONG_OUTPUT_ROOT` 指定验证目录。检查目录迁移后离线播放、循环/倍速、原音频打开、歌词/ABC 下载字节一致性、谱面缩放/展开、窄屏及打印样式，保留截图与检查回执。真实作品和私有 JSON 不提交仓库。

该浏览器验证还模拟隔离的 Blob 预览，检查音频加载失败时的外部浏览器提示，并验证缺失音频与恢复加载的状态；它不是实际桌面预览的播放验收。

同步页验证运行 `node edition/plugins/tool-ecnu-music/test/browser-timeline.mjs`，需设置相同的 `EDUWORK_TEST_RUNTIME` 和 `MUSIC_SONG_OUTPUT_ROOT`。使用合成音轨和明确的测试时间轴，覆盖 HTTP 播放、前奏/间奏/结尾、拖动回退、重复歌词、暂停倍速、谱面高亮重排、字幕导入、人工校时和时间轴导出再导入。该测试证明时间机制，不证明真实歌声已自动对齐。

真实验收需在包含该插件的客户端用学校登录查询能力、提交任务、退出/重登录后续查，并实际下载试听。自动化模拟测试不能替代这个验收。当前接口无精确时长参数；乐谱格式以产物为准，ABC 不是 PDF，也不是保证完整配器的总谱。

完整阅读页与谱面试听验证运行 `node edition/plugins/tool-ecnu-music/test/browser-reading.mjs`（同样设置上述 runtime/output 环境变量）。检查长歌词完整呈现、手机播放器可见、自动浏览与手动打断、离线试谱音频调度及音符高亮、原曲/乐谱互斥、跳转与重排。脚本调度通过不等于音色经过人工试听。

多声部试听验证：`node edition/plugins/tool-ecnu-music/test/browser-mixer.mjs`（同样设置 runtime/output 环境变量）。除调度外，还测量两个声部同时输出的音频信号，以及独奏、静音、音量归零后的实际变化；验证声部高亮、重排保留设置、跳转与移动端布局。
