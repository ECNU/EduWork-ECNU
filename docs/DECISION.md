# 决策服务配置

**简体中文** | [English](DECISION_EN.md)

学校版使用公版独立插件 `@eduwork/dsh-decision`，工具名 `decision_evaluate`，配套技能 `decision`。工具、协议解析与技能均在公版维护；学校仓不保留另一套实现。

适用于按标签分流材料、核对条件和按量表评分。使用学校账号并获得 `ecnu-decision` 模型调用权限后，可要求：“用决策模型按校园卡、网络、其他这几个类别判断这条请求”。OAuth 需要服务要求的模型调用权限（学校服务为 `llm:invoke`）。

公共包首次发布并核验后，由公版组件锁固定 npm 版本，学校发行版跟随该公版版本装配。当前锁定公版 0.4.9 尚未包含决策包；下面是包安装后的配置准备，不代表现有安装包已经具备该工具。包在插件管理中使用 ID `decision`，默认关闭，学校配置在其安装后启用。

在唯一生效的 `config/eduwork.jsonc`（macOS 为用户数据目录中的配置）中配置 `plugins.decision`：

```json
{
  "enabled": true,
  "baseURL": "https://chat.ecnu.edu.cn/open/api/v1",
  "model": "ecnu-decision",
  "authMode": "oidc",
  "oidcProfileId": "ecnu",
  "credentialRef": "EDUWORK_API_KEY",
  "imageInput": "data-uri",
  "maxQuestions": 64,
  "maxRequestBytes": 12582912,
  "requestTimeoutMs": 190000
}
```

这些默认参数同时保存在发行配置中；首次学校配置下载和现有用户的配置更新按学校发布流程维护。配置本身不安装插件、不覆盖公版 npm 锁。`authMode: oidc` 时只使用学校登录，`credentialRef` 不参与调用；切换 `api-key` 才读取该凭据。Token 续期沿用 OIDC 插件，学校登录失败不退回个人 Key。

`maxQuestions`、图片格式和请求大小属于学校服务配置，不作为公版协议的固定要求。默认最多 64 问、完整请求 12 MiB、超时 190 秒；服务端可能有更小限制。图片沿用服务支持的 Data URI 扩展。纯文本分类不需要图片。

结果是模型估计，不自动批准事项、修改文件或发送消息。不同服务的 confidence 含义可能不同；具体判断仍需结合材料。401 检查登录，403 检查模型分配及授权，422 检查服务端模型名称与请求校验，超时不连续重试。

插件使用与协议边界见[公版源码说明](https://github.com/ECNU/EduWork/tree/main/packages/dsh-decision)。
