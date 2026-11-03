# School remote access

[中文](REMOTE_ACCESS.md) | [Home](../README_EN.md)

Starting with 0.4.10, EduWork@ECNU includes the standalone public `@eduwork/dsh-remote-access` plugin. Signed school configuration downloaded at startup supplies the relay and school identity. No plugin installation, server address or copied Token is required.

1. Sign in with your school account in EduWork@ECNU.
2. Open Settings → Remote Access, use the school identity and enable access. You can test the connection first.
3. Create a pairing link, open it on a phone or another device and confirm pairing on the local computer.
4. Disable remote access or revoke paired devices locally at any time. Keep the computer running and connected.

Remote access starts disabled. Saved plugin activation, custom relay and device pairing choices are preserved. Users can also disable school identity mode and configure their own relay and access Key.

## Distribution configuration

The school account and relay are managed in the same signed configuration, using the existing public top-level field:

```json
{
  "remoteAccess": {
    "relay": "https://chat.ecnu.edu.cn/eduwork-remote/",
    "oidcProfileId": "ecnu"
  }
}
```

This is a configuration fragment; `oidcProfileId` must identify the school account in `organizations`. Organization mode uses the OIDC plugin's ID Token to authenticate to the relay. Tokens and access Keys are not stored in this file. The local user still confirms pairing.

The new `core-021-remote` signed configuration feed supplies these fields using the existing publisher key. The bootstrap descriptor's `migrateFrom` uses the public core's migration mechanism and preserves user edits. Older clients retain the `core-020` feed so unsupported fields cannot prevent startup. Configuration and software update feeds are separate; migrating the configuration feed does not push a software upgrade.

The public project maintains the plugin, protocol and deployment guide. The school repository owns preinstallation choices and distribution configuration. See the [plugin documentation](https://github.com/ECNU/EduWork/tree/main/packages/dsh-remote-access) and [Docker deployment guide](https://github.com/ECNU/EduWork/blob/main/packages/dsh-remote-access/docs/DEPLOYMENT_EN.md).
