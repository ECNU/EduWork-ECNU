# School decision model

[简体中文](README.md) | **English**

`@chatecnu-work/dsh-tool-ecnu-decision` registers the school's SystemOne service as the native DSH tool `ecnu_decision`, accompanied by the [ecnu-decision skill](../../skills/ecnu-decision/SKILL.md). It supports classification against given labels, condition checks and rubric scoring. The main Agent organizes the task and explains the results.

Sign in with a school account allocated the `ecnu-decision` model, then ask: “Use the school decision model to classify these requests as campus card, network, finance or insufficient information.” The Agent can also invoke it when appropriate. There is no need to switch the chat model. OAuth requires `llm:invoke`.

## Capabilities and configuration

- `state` accepts text or non-null JSON; `questions` accepts 1–64 questions. `choice` selects a label; `noul` returns a probability that a claim holds; `score` returns a potentially fractional value on 2–10 ordered levels, indexed from zero.
- Optional `images` accepts PNG/JPEG/WebP Data URIs, not local paths or arbitrary remote URLs.
- Probabilities, confidence indicators, legends and gateway metadata are preserved. These are model estimates, not facts or authorization to execute actions.
- No automatic business actions or startup polling; the default chat model is unchanged.

The distribution assembles the plugin and skill together. Configuration lives under `plugins.chatecnu-decision`:

```json
{
  "enabled": true,
  "baseURL": "https://chat.ecnu.edu.cn/open/api/v1",
  "model": "ecnu-decision",
  "oidcProfileId": "ecnu",
  "credentialRef": "EDUWORK_API_KEY",
  "requestTimeoutMs": 190000
}
```

School mode reuses the Host API from `@eduwork/dsh-oidc`. The base URL must match the account's authorized model resource. Tokens never reach the model or renderer. Account replacement, logout and plugin disposal invalidate pending results. For explicit API-key mode, set `oidcProfileId` to an empty string and configure the key referenced by `credentialRef` in credential settings. School sign-in failures never fall back to a personal key.

Client limits: 256 KiB of material, at most 8 images, 12 MiB per request and 512 KiB per response. Server limits may be lower. The default timeout is 190 seconds (configurable from 1 to 195000 ms). POST requests are not automatically retried; redirects and old-model fallback are disabled. A timeout does not cancel upstream inference. For 401 check sign-in; 403 model allocation/scopes; 422 request schema/deployed model alias; 429 rate limits/quota.

## Plugin boundary

Uses DSH `defineTool`, native result cards and skills. No DSH runtime, desktop bridge or OIDC protocol changes. This is a standalone source plugin assembled by the school edition; it is not currently published to npm. Images/TTS continue using the media adapter and artifact services; this plugin only adapts SystemOne.

Unit checks: run `node --test test/core.test.mjs` in this directory. For actual DSH registration tests, set `EDUWORK_TEST_RUNTIME` to an assembled `product/d` and run `node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/tool-ecnu-decision/test/*.test.mjs` from the repository root. Tests use synthetic data and local fixtures, with no accounts or production requests.
