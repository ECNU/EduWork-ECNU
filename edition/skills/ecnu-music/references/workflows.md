# 输入示例与交付

所有示例都是原生工具参数，不含凭据。`style` 长度为 1–2000 字符，`lyrics` 为 1–16000；保留原歌词，不默默裁剪。工具固定使用 `ecnu-music`。

## 原创与两首候选

调用 `ecnu_music_submit`：

```json
{
  "operation": "generate",
  "style": "Mandarin campus folk song, warm mixed vocals, acoustic guitar and piano, hopeful",
  "lyrics": "[Verse]\n秋日阳光穿过窗\n我们携手走向远方\n[Chorus]\n让梦想在这里生长",
  "n": 2,
  "cot": "full"
}
```

用户想要两套风格或不同歌词时是两个独立任务。按用户已明确的数量执行，数量不明时默认一首；不因接口支持两个候选就默认翻倍生成。

## 原曲改编为交响乐与合唱

先将用户提供的音频放到工作区，例如 `inputs/anthem.mp3`。把用户的完整歌词原样填入 `lyrics`，调用：

```json
{
  "operation": "cover",
  "audio": "inputs/anthem.mp3",
  "style": "Mandarin university anthem, majestic symphonic orchestra and mixed SATB choir, clear diction, soprano-led original melody, sustained legato, stately brass fanfares, spacious concert hall acoustics. Preserve the supplied melody and phrase structure; build toward a grand final tutti.",
  "lyrics": "这里替换为用户提供的完整歌词"
}
```

该示例中的歌词是占位说明，不能直接提交。对比试听是否保留主旋律、歌词是否完整、合唱与配器是否符合要求；不要仅凭提示词宣称已忠实保留。

## 规划、ABC 与转录

- `plan` 支持 `cot=full` 或 `melody`，只生成规划。用户只要规划时不追加歌曲生成；用户已要求完整的“先规划再生成”流程时，规划完成后读取实际返回的 ABC，传入 `generate` 的 `abc`（最多 64000 字符）继续生成。不能把文件路径当乐谱内容。
- `generate` 的 `cot` 可为 `full`、`melody`、`off`。无明确需要时用默认 `full`；`off` 不是纯器乐开关。
- `transcribe` 使用 `mode=full` 或 `melody`，提取音乐结构而非会议语音逐字稿。依服务实际产物下载 ABC、MIDI 或其他文件。
- `cfg_scale` 为 0–20；默认不传，只有用户指定或实验需要时再设置。`cover` 不接受 `n`、`cot` 或 `abc`；`transcribe` 不接受风格、歌词或 seed。

## 对话续作与版本

| 用户意图 | 工具选择与保留内容 |
| --- | --- |
| “找回上次那首歌 / 下载第二个候选” | 先用已有 ID 或 `ecnu_music_library` 定位原请求，再查组任务的实际候选 ID，列出产物并下载；不生成新任务 |
| “这首换成交响合唱，歌词保留” | 取原音频与原歌词调用 `cover`，修改风格，使用新请求 ID，并关联原回执 `parent_request_id` |
| “这份谱配上歌词做成歌” | 读取 ABC 内容调用 `generate`；歌词来自用户或用户已授权的原创写词 |
| “把刚才的乐谱改一下再生成” | 保留原 ABC，另存修改版；将修改后的文本传给新 `generate` 请求并关联来源回执 |
| “先把这段音频转成谱，再用这个旋律写一首新歌” | `transcribe` → 查询 → 下载实际 ABC → 读取/按要求编辑 → `generate`；先前已授权完整流程则继续，产物没有 ABC 时先说明，不能拿 MIDI 路径代替 ABC |

`title` 最多 120 字符，`parent_request_id` 填原回执 UUID，不填服务器 job ID。恢复旧输入时去掉固定的 `model` 字段，只保留新操作接受的参数；跨操作切换时不要直接把整份旧输入传给工具。默认新版本仍省略 seed；只有用户要求保留或指定 seed 时才携带，并遵守整数限制。历史回执缺少歌词、风格或音频路径时，不凭空补写原作内容。

## 乐谱交付

下载和读谱使用真实产物名与实际内容。用户要求“把 ABC 变成五线谱”时，调用本地工具 `ecnu_music_render_score`，无需登录、查询服务能力或提交生成任务：

```json
{
  "abc_path": "inputs/melody.abc",
  "title": "校园之歌 · 五线谱"
}
```

示例路径须替换为实际 `.abc` 文件，且位于当前工作区。也可传 `abc` 文本；`abc` 与 `abc_path` 必须且只能选一个。内容上限 256 KiB UTF-8，需有 `K:` 调号字段；可选标题最多 120 字符。该排版上限不同于音乐生成接口 `abc` 的 64000 字符上限。

返回的 `relativePath`、`mime=text/html` 指向新建的独立 HTML，内含固定版本 abcjs、SVG 排版逻辑与原始 ABC，不依赖 CDN。交付实际 HTML 文件；用户用浏览器离线打开即可看谱、下载 ABC 或打印 / 另存 PDF。能预览时核对页面与解析提示；工具返回只表示文件已创建，不表示浏览器已验证音符。要求实际 PDF 文件时需另用可用的浏览器或导出工具生成并检查，不能把 HTML 改名为 PDF。旧客户端缺少此工具时说明需要更新插件，并保留 ABC。

保留源 ABC 和解析提示，不把 MIDI 简单改名为 ABC/PDF。声部名称、和弦标记与排版成功不证明生成音频逐音准确，也不证明是完整 SATB 或交响总谱。

## 完整歌曲作品页

用户要求歌曲完整交付、作品页或“歌词、音频和五线谱放在一起”时，使用 `ecnu_music_export_song`。先从同一候选下载真实音频与 ABC；默认按 [media-delivery.md](media-delivery.md) 转成 MP3 分享副本，再将 MP3 传入作品页，原始无损源保留。歌词使用用户原文或该任务的创作回执，不能从文件名、提示词或试听猜写。输入示例中的路径与歌词须替换为实际内容：

```json
{
  "title": "校园之歌",
  "audio_path": "inputs/song.mp3",
  "abc_path": "inputs/song.abc",
  "lyrics": "这里替换为这首歌的完整创作歌词",
  "style": "Mandarin campus anthem, mixed choir and acoustic orchestra"
}
```

音频支持 FLAC、MP3、WAV、OGG，最多 128 MiB，必须在当前工作区内。`lyrics` 为 1–16000 字符，`title` 最多 120，`style` 可省略、提供时为 1–2000。ABC 文本与路径二选一，限制同排谱工具。缺少歌词、ABC 或音频时说明缺项，交付现有产物；不拿 MIDI 改名，也不为拼页擅自重提生成或额外转谱。

输出目录 `.eduwork/generated/music/song-<uuid>/` 包含 `index.html`、原格式 `audio.*`、`lyrics.txt`、`score.abc`、`timeline.json` 和 `song-timeline.js`。音频分块复制、字节不变，HTML 使用相对路径；页面内含排谱依赖，不访问 CDN。默认保留目录结构，单独拷走 HTML 会丢失音频。分享整个目录，不自动公开上传。

页面默认完整歌词阅读、渐变背景和常驻播放器，PC 并排看谱，手机可切换乐谱。支持手动滚动、按总时长自动浏览、原曲播放、循环、倍速、谱面合成试听与高亮、谱面放大/展开、下载与打印。自动浏览不代表唱词同步，无需为普通交付启动转写。可选 `timeline_path` 是同版本音频和 ABC 绑定的完整时间轴，最多 1 MiB；未提供也可完整交付阅读页。折叠工具内支持字幕导入、逐句校时、保存、乐谱字符映射和本地 HTTP 服务见 [song-timeline.md](song-timeline.md)。不拿原歌词或谱面速度当作实际时间戳；核对音频、歌词、谱面与同步状态，打印入口不等于 PDF 已导出。目录迁移后外部 `file://` 打开仍应工作。

用技能附带的 `serve-song.mjs start <directory>` 启动本地预览，交付实际返回的网页 URL，并保留 `path` / `relativePath` 和 `audioPath` / `audioRelativePath`。当前内置 HTML 文件预览使用隔离文档，尚未接入同目录音频；使用 URL 网页入口或外部浏览器。旧版回执缺少音频字段时使用下载工具已有路径，不编造路径。分享仍需整个目录。

验证时分别记录外部浏览器和内置预览的实际结果。若外部浏览器可播而内置预览为 `0:00`，这是预览兼容问题，不要求用户重新登录、修改文件夹权限或重提生成。若外部浏览器也失败，再检查同目录音频是否存在、是否能单独播放以及格式是否受支持。仅验证文件存在或浏览器加载页面，不能宣称音频播放已经通过。

## 结果说明

交付时简述操作、风格、状态，以及实际音频/乐谱文件路径。可报告服务返回的实际 seed；超出 JS 安全整数范围的 seed 会以十进制字符串保留，不能转为浮点数再声称可精确复现。注明截断、部分失败或只有规划等情况。

任务回执和下载文件统一在工作区 `.eduwork/generated/music/`。当前回执保存完整歌词、风格、创作参数、任务标识与父版本，属于用户作品文档；不记录 Key、Token 或音频内容。旧回执可能没有完整输入。本地库按服务配置分组，不代表账号隔离；服务器仍按当前调用身份校验任务归属。同一 `request_id` 不允许改参后重新提交。下载保留实际格式，生成新文件，不覆盖此前结果。
