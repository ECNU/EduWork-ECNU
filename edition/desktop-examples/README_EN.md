# Enterprise configuration examples

[中文](README.md) · [Configuration guide](https://github.com/ecnu/EduWork/blob/main/docs/CONFIGURATION_EN.md)

ECNU and generic Electron editions read one `config/eduwork.jsonc`. Windows stores it under the installation; Mac uses `~/Library/Application Support/eduwork-chatecnu-electron/`. Settings opens this exact file. Fully quit the tray application after editing, then restart. Legacy effective configuration migrates here; unchanged old entries are removed after successful startup. Only one rollback backup is retained: `data/configuration/eduwork.previous.jsonc`.

School editions can distribute the unmodified GitHub CI archive. First launch downloads signed defaults into this file, without local repackaging. Later updates merge untouched defaults and preserve manual edits, reporting conflicts in Settings. Generic deployments, including CERNET, do not contact a school configuration feed by default.

## Configuration and UAT

Use [ecnu.jsonc](ecnu.jsonc), [cernet.jsonc](cernet.jsonc), or the generic [organization.jsonc](https://github.com/ecnu/EduWork/blob/main/config/desktop/examples/organization.jsonc). Replace placeholder Client IDs privately; real deployment parameters stay outside the source repository.

Edit organization login, model and media parameters in the active file for UAT. The ECNU example also lists installed service endpoints under `plugins`; update campus search, vision assistance and heartbeat addresses there. For HTTP UAT, set the organization and heartbeat `allowInsecureDevelopment` switches to `true`; no separate origin field is required. Both default to `false` (HTTPS only). Set the existing `contentUpdates.configuration` to `false` to freeze configuration while retaining Skills updates; also set `skills` to `false` to disable all content updates. Development/stable software channels are independent of UAT/production services. Use separate installation and data directories for sustained testing.

Static deployments can use the public core's `scripts/configure-desktop-archive.ps1` to add `config/eduwork.jsonc` without changing CI program bytes. New archives no longer generate versioned configuration files. Closing to tray does not reload configuration: fully quit and restart.

## Model and feature defaults

- Model purpose uses `provider.models[].type`. ECNU declares `ecnu-max` / `ecnu-plus` as `llm`, and embedding, reranking, image generation and TTS as their respective types. Only authorized LLMs register in chat; image-capable LLMs stay available. Server types take precedence; local metadata supplies missing types and unresolved types stay out of chat. Upgrade the public plugin and client assembly together with the typed deployment configuration. Older clients reject the new field; existing ID-only deployments need type metadata before upgrading. Independent media services keep their own configuration.
- Total model-request concurrency defaults to 3. `features.maxConcurrentRequests` accepts 1–64; saved personal preferences take precedence. Legacy `maxParallelSubagents: 2` maps to total concurrency 3.
- The example declares `ecnu-max` as text-only, with a 512K context (524,288 tokens) and 384K maximum output (393,216 tokens). `ecnu-plus` provides image assistance by default; `features.visionFallback: false` disables assistance without affecting native vision models.
- Public `media` configuration provides image generation and cloud TTS. CERNET model IDs are `cernet-image` / `cernet-tts`. `media.providers: []` disables cloud media; local TTS is separate.
- Conversations, credentials, personal models and UI preferences are not institution defaults and are not cleared by configuration updates.

## Protocol constraints

Organization `id` identifies the account profile; `provider.id` names its local model route. Both examples use `chatecnu` as that route and cannot be enabled together unchanged. Assign distinct local Provider IDs when combining profiles.

Personal API-key models remain available. Model authorization uses oidc-llm discovery at `auth.discoveryUrl` and Access Tokens; migrate legacy `keyBinding` profiles and sign in again. Identity-only OIDC uses the public identity-only example. Quota and heartbeats remain ECNU extensions.

Client IDs are deployment parameters and remain placeholders in examples. Never include passwords, API keys, client secrets or login tokens in configuration or public archives. Desktop uses PKCE and loopback callbacks. Enterprise model requests use the signed-in account’s scoped Access Token; personal Provider credentials stay independent.

The effective `eduwork.jsonc` lists actual defaults for heartbeat, campus search and vision assistance, including endpoints, account associations and request options. Heartbeat endpoints are not discovered by OIDC; change them when switching environments. All configurable options, including public and edition plugins, appear in this file with Chinese comments; upgrades fill missing defaults while preserving local edits and the single rollback backup. Set `allowInsecureDevelopment: true` beside `auth` for HTTP services; the heartbeat plugin has the same HTTP switch. Both default to `false`; the obsolete `insecureDevelopmentOrigin` is ignored. Mutually exclusive or deployment-specific options stay commented. Upgrades preserve user values and comments while adding help.
