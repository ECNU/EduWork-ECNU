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

用户想要两套风格或不同歌词时是两个独立任务。先确认用户需要的数量，不因接口支持两个候选就默认翻倍生成。

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

- `plan` 支持 `cot=full` 或 `melody`，只生成规划，不自动追加一轮歌曲生成。需要把规划用于生成时，读取实际返回的 ABC 后传入 `generate` 的 `abc`（最多 64000 字符），不能把文件路径当乐谱内容。
- `generate` 的 `cot` 可为 `full`、`melody`、`off`。无明确需要时用默认 `full`；`off` 不是纯器乐开关。
- `transcribe` 使用 `mode=full` 或 `melody`，提取音乐结构而非会议语音逐字稿。依服务实际产物下载 ABC、MIDI 或其他文件。
- `cfg_scale` 为 0–20；默认不传，只有用户指定或实验需要时再设置。`cover` 不接受 `n`、`cot` 或 `abc`；`transcribe` 不接受风格、歌词或 seed。

## 结果说明

交付时简述操作、风格、状态，以及实际音频/乐谱文件路径。可报告服务返回的实际 seed；超出 JS 安全整数范围的 seed 会以十进制字符串保留，不能转为浮点数再声称可精确复现。注明截断、部分失败或只有规划等情况。

任务回执和下载文件统一在工作区 `.eduwork/generated/music/`。回执只记录参数摘要与任务标识，不记录 Key、Token 或音频内容；同一 `request_id` 不允许改参后重新提交。下载保留实际格式，生成新文件，不覆盖此前结果。
