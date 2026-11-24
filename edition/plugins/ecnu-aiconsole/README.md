# AIConsole 账户查询

**简体中文** | [English](README_EN.md)

为 EduWork 学校版提供账户只读工具，复用学校 OIDC 登录。可查询账户资料、用量与配额、积分及流水、权益、订单、资源目录、Key 掩码、本人运行中的 Open LLM 请求，以及 ChatECNU 会话与消息。

需要修改账户、查看完整 Key、停止请求或办理邀请时，Agent 在正文提供 [AIConsole](https://aiconsole.ecnu.edu.cn) 入口，由用户自行办理。插件固定只读操作列表，登录凭据新增权限不会增加工具。

## 配置与使用

宿主显式装配此插件，并传入已有 OIDC profile 的 ID 和相同的模型服务 API 基址：

```json
{
  "oidcProfileId": "school",
  "baseURL": "https://school.example/open/api/v1",
  "requestTimeoutMs": 20000
}
```

地址由发行方配置，Agent 无法通过参数改变地址或方法。只在 Host 注入凭据，禁止重定向；退出、切换账户和卸载会取消在途读取。不保存账户响应或凭据。服务端仍校验对应读取权限，发行方在装配前核实已有登录范围及账户资格；客户端不新增逐项授权入口，权限不足时返回错误并提供网页入口。

工具名为 `ecnu_account_get_profile`、`ecnu_account_get_usage` 等，具体参数由工具说明提供。结果包含 `operation`、`dataJSON`、`parametersJSON`、`coverage` 和 `timezone`。分页以 1 开始，账户 `page_size` 和会话列表 `limit` 默认 20、最大 100；`coverage: page` 表示当前页。日期使用北京时间，缺失值保持未知。完整统计需要读取全部分页。

配套 [账户查询 Skill](../../skills/ecnu-aiconsole/SKILL.md) 提供数据解释和操作引导。当前源码不修改学校默认发行配置；插件和 Skill 需一起显式装配。运行基线为 DSH 0.2.2-rc.3。

## 宿主复用与验证

`ecnuAiconsole.read(operation, args, { signal })` 为 Host 服务，返回解析后的 `data` 和查询范围。界面适配可以复用此入口；不能把通用鉴权请求暴露给 renderer。仅普通 Key 列表开放安全元数据，不提供完整值。

独立协议检查：`node --test edition/plugins/ecnu-aiconsole/test/reader.test.mjs`。

宿主集成检查使用已装配 Runtime：设置 `EDUWORK_TEST_RUNTIME` 为产品 `d` 目录后，在学校仓根运行 `node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/ecnu-aiconsole/test/*.test.mjs`。该检查使用合成身份服务与真实 DSH/OIDC 模块，不代表生产接口和真实账户已验收。
