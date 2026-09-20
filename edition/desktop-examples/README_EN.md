# Enterprise configuration examples

[中文](README.md) · [Configuration guide](https://github.com/ecnu/EduWork/blob/main/docs/CONFIGURATION_EN.md)

ECNU and generic Electron editions read one `config/eduwork.jsonc`. Windows stores it under the installation; Mac uses `~/Library/Application Support/eduwork-chatecnu-electron/`. Settings opens this exact file. Fully quit the tray application after editing, then restart. Legacy effective configuration migrates here; unchanged old entries are removed after successful startup. Only one rollback backup is retained: `data/configuration/eduwork.previous.jsonc`.

School editions can distribute the unmodified GitHub CI archive. First launch downloads signed defaults into this file, without local repackaging. Later updates merge untouched defaults and preserve manual edits, reporting conflicts in Settings. Generic deployments, including CERNET, do not contact a school configuration feed by default.

## Configuration and UAT

Use [ecnu.jsonc](ecnu.jsonc), [cernet.jsonc](cernet.jsonc), or the generic [organization.jsonc](https://github.com/ecnu/EduWork/blob/main/config/desktop/examples/organization.jsonc). Replace placeholder Client IDs privately; real deployment parameters stay outside the source repository.

Edit organization login, model and media parameters in the active file for UAT. Set the existing `contentUpdates.configuration` to `false` to freeze configuration while retaining Skills updates; also set `skills` to `false` to disable all content updates. Development/stable software channels are independent of UAT/production services. Use separate installation and data directories for sustained testing.

Static deployments can use the public core's `scripts/configure-desktop-archive.ps1` to add `config/eduwork.jsonc` without changing CI program bytes. New archives no longer generate versioned configuration files. Closing to tray does not reload configuration: fully quit and restart.

## Model and feature defaults

- Total model-request concurrency defaults to 3. `features.maxConcurrentRequests` accepts 1–64; saved personal preferences take precedence. Legacy `maxParallelSubagents: 2` maps to total concurrency 3.
- The example declares `ecnu-max` as text-only, with a 512K context (524,288 tokens) and 384K maximum output (393,216 tokens). `ecnu-plus` provides image assistance by default; `features.visionFallback: false` disables assistance without affecting native vision models.
- Public `media` configuration provides image generation and cloud TTS. CERNET model IDs are `cernet-image` / `cernet-tts`. `media.providers: []` disables cloud media; local TTS is separate.
- Conversations, credentials, personal models and UI preferences are not institution defaults and are not cleared by configuration updates.

## Protocol constraints

The local organization `id` differs from the server's `provider.id`. Both current ECNU/CERNET examples use Provider `chatecnu`, matching `bootstrap.provider.id`; they cannot be enabled together unchanged. Distinct server Provider IDs or separate client configurations are required.

Without organizations, personal API-key models remain available. Identity-only login can omit `keyBinding` and `provider`; automatic model provisioning requires the resource protocol. Quota and heartbeat are ECNU extensions, not public OIDC requirements.

Client IDs are deployment parameters and remain placeholders in examples. Never include passwords, API keys, client secrets or login tokens in configuration or public archives. Desktop uses PKCE and loopback callbacks. Enterprise credentials use the `EDUWORK_API_KEY` reference name; personal Provider credentials stay independent.
