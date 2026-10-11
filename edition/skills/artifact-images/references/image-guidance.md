# 学校图像模型：尺寸与提示词模板

这些模板由 EduWork 自行整理，用于助手在调用图像工具之前完成扩写，不需要官方 PE 服务。尺寸表适用于学校 `ecnu-image` 的 Qwen-Image-2.1 服务；实际可用能力以 `image_providers` 返回的目录为准。其他提供方沿用各自目录。

## 1K / 2K 尺寸

普通图片默认 1K；用户提到“信息图”或 infographic 时默认 2K。用户明确指定的尺寸或档位始终优先，包括信息图指定 1K。按用户指定或画面用途选择比例，没有比例线索时用方图。

| 名义比例 | 1K `size` | 2K `size` |
| --- | --- | --- |
| 1:1 | `1056x1056` | `2048x2048` |
| 4:3 | `1184x896` | `2400x1792` |
| 3:4 | `896x1184` | `1792x2400` |
| 3:2 | `1248x832` | `2528x1696` |
| 2:3 | `832x1248` | `1696x2528` |
| 16:9 | `1376x768` | `2752x1536` |
| 9:16 | `768x1376` | `1536x2752` |

调用前核对 `nativeSizes`，只在同档位内选择接近比例的原生尺寸；当前目录缺少所需档位时先说明配置限制，不自动降档。用户明确要求更小尺寸时照做，不为了套用默认档位而放大小图。

原生尺寸经过像素对齐，表中的比例是近似值。例如“横版 16:9 信息图”用 `2752x1536`；如果用户明确要求严格 16:9，可用 `2560x1440` 作为最终目标，在确认目录包含对应 2K 档位后由工具适配并核对结果。普通 1K 图需要严格 16:9 时可用 `1280x720`。含完整文字或图形时用 `fit: "pad"` 避免裁掉边缘。

1K / 2K 用于助手选档，实际宽高另传 `size`；在生图正文里写“2K”不能代替此参数，不使用 `auto`。编辑沿用参考画布比例并按同样规则选档；多图编辑先确定哪张是画布，哪张仅提供人物、物体或风格。尺寸、提供方和原图路径分别放在工具参数里。

## 文生图扩写

先保留用户已经确定的条件，再按画面需要补充以下要素；已有完整提示词只做必要整理，不为满足固定字数扩写。

1. 图像用途、媒介与风格；主体身份、数量、动作和神态。新生成人物未指定背景时写明中国人。
2. 前景、中景、背景中各元素的位置、相互关系与留白，补充适度的材质和颜色。
3. 光源方向、光线软硬、明暗和色调，使描述自洽，不堆砌无意义的质量词。
4. 可见文字逐字用引号标出，说明位置、字体风格、层级与颜色；没有要求文字时不增加标题、标语或标志。图表数据只能来自用户提供或已核实的材料。

使用学校 Qwen-Image-2.1 时，文生图的场景描述优先用英文组织；画面中的中文文字保持中文，不翻译。尺寸另传 `size`。正文结构可以是：

```text
[Medium and style] showing [subject, identity, count and action] in [setting].
[Placement, spatial relationships, colors and materials that matter].
[Lighting and composition, including any required negative space].
[Exact visible text in its original language, with position and hierarchy, only if requested].
[Other explicit user constraints].
```

示例：用户要求“做一张大学老师带学生讨论的横向配图，不要文字”，没有指定人物身份背景。若当前目录支持，选 `1376x768`；正文可以是：

```text
A natural editorial photograph of one Chinese university teacher and three Chinese adult students discussing an open notebook around a light wooden table. The teacher sits on the left, pointing to a page while the students listen and exchange ideas. Plain everyday clothing in muted blue, cream and grey keeps the focus on their interaction. Soft daylight enters from a side window, with a gently blurred classroom in the background. Use a balanced horizontal composition and natural expressions. Include no readable text, logos or captions.
```

若用户明确要求某位外国学者或不同背景的群体，直接保留该要求，不追加中国人条件。若要求海报上写“开放课堂”，该文字必须原样进入提示词，而非翻译成英文。

## 编辑扩写

先查看真实原图。中文编辑请求优先用中文组织，其他语言可用英文；画面文字仍优先遵循用户指定语言或原图文字。编辑正文从具体动作开始，随后交代保留范围：

```text
将[原图中明确的对象/区域]改为[用户要求的变化，含位置、颜色或材质等必要细节]。
保持[主体身份、未修改的内容和画布关系]不变，使修改区域与原图的光照和风格一致。
[仅在用户要求改字时，明确原文字和替换后的准确文字及位置]。
```

示例：“把外套改成蓝色”，编辑真实输入图，按原图比例选约 1K 档位：

```text
将图中人物的外套改为深蓝色，保留外套原有款式、面料纹理与褶皱，并沿用原有光照下的自然明暗。保持人物面部身份、表情、发型、姿势、其他服饰、背景和取景不变。
```

不因文生图的“中国人”默认值修改参考人物身份，不顺手美化脸部或更换文字、背景。用户要求整体重构时才按新场景组织构图。

当前工具允许多图时，用 `<image1>`、`<image2>` 明确角色，例如：“以 `<image1>` 为画布，把桌上的杯子换成 `<image2>` 的杯子，保持第一张图的其他内容不变”。编号对应 `images` 数组顺序，不能只把图片 URL 写进提示词当作输入。

这些示例是可替换的组织方式，不是必须照抄的场景；用户明确要求始终优先。扩写后的完整正文直接作为 `prompt`，不调用额外扩写服务。
