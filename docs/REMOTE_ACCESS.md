# 学校远程访问

[English](REMOTE_ACCESS_EN.md) | [返回首页](../README.md)

0.4.10 起随包提供公版的独立插件 `@eduwork/dsh-remote-access`。首次启动下载的签名学校配置会提供中继服务和学校身份，用户无需另装插件、填写服务器地址或复制 Token。

1. 在 EduWork@ECNU 中登录学校账号。
2. 打开“设置 → 远程访问”，使用学校身份，开启远程访问。可先测试连接。
3. 创建配对链接，在手机或其他终端打开，并在本机确认设备配对。
4. 随时在本机关闭远控或撤销已配对设备。电脑须保持运行和联网。

远控默认关闭。已保存的插件启停、自定义中继和设备配对选择继续保留；关闭学校身份模式后，也可配置自己的中继和接入 Key。

## 发行配置

学校账号和中继由同一份签名配置管理，生效文件中使用公版已有的顶层字段：

```json
{
  "remoteAccess": {
    "relay": "https://chat.ecnu.edu.cn/eduwork-remote/",
    "oidcProfileId": "ecnu"
  }
}
```

这是配置片段；`oidcProfileId` 必须对应 `organizations` 中的学校账号。机构模式使用 OIDC 插件提供的身份令牌（ID Token）接入中继，不在文件中保存 Token 或接入 Key。配对仍由本机用户确认。

新版通过 `core-021-remote` 签名配置源交付这些字段，沿用原发行验签公钥。引导描述中的 `migrateFrom` 通过公共核心已有机制迁移旧来源并保留用户修改。旧版继续使用 `core-020` 配置源，避免不认识新字段的客户端启动失败。程序更新渠道和配置源分别管理，迁移配置源不会推送程序升级。

插件、协议及自建服务部署由公版维护，学校仓只维护预装选择和发行配置。见[插件说明](https://github.com/ECNU/EduWork/tree/main/packages/dsh-remote-access)与[Docker 部署指南](https://github.com/ECNU/EduWork/blob/main/packages/dsh-remote-access/docs/DEPLOYMENT.md)。
