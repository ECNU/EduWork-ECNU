# Enterprise configuration examples

[简体中文](README.md)

Total model-request concurrency defaults to 3 across main conversations, subagents and auxiliary model requests in this client. Excess requests queue. Users can save changes immediately in Settings → General → Total model-request concurrency. Top-level `features.maxConcurrentRequests` sets the distribution default (1–64); file changes require restart and saved preferences take priority. Legacy `maxParallelSubagents: 2` maps to a total of 3. Update settings offer public-beta or development (including public-beta) channels; switching does not downgrade or change the installed-version badge.

The ECNU example declares DeepSeek V4.1 `ecnu-max` with `input: ["text", "image"]`. The complete university configuration updates with each release without another login. Managed gateways, catalogs and limits follow the new release; personal providers, keys, default model choice and history remain separate and preserved. `features.visionFallback: false` disables assistance for configured enterprise text-only models; native image input remains available.

ECNU Electron reads `config/eduwork.<product-version>.jsonc`, matching the running version. Settings displays organizations, login and model details without an organization-editing form. Quota is supplied by the ECNU extension, not public OIDC.

`ecnu-max` defaults to a **512K context (524,288 tokens)** and **384K maximum output (393,216 tokens)**. Managed context and output limits follow the current release configuration; personal models are unaffected. Standard mode uses DSH automatic compaction around 80% context pressure, including existing sessions, without clearing history.

## Apply an example

These instructions are for distribution maintainers. School users receive a preconfigured package and need not edit files. ECNU Electron reads `<client>/config/eduwork.<product-version>.jsonc`; examples are under `<client>/config/examples/`. Public-edition deployments, including CERNET, retain user/deployer ownership of `config/eduwork.jsonc`. In source, see [ecnu.jsonc](ecnu.jsonc), [cernet.jsonc](cernet.jsonc) and the [default config](../desktop/eduwork.jsonc). The public core supplies [organization.jsonc](https://github.com/ecnu/EduWork/blob/main/config/desktop/examples/organization.jsonc) and [updates.jsonc](https://github.com/ecnu/EduWork/blob/main/config/desktop/examples/updates.jsonc); assembly merges them into the installed examples directory.

1. Choose `ecnu.jsonc` for ECNU services, `cernet.jsonc` for a CERNET-style deployment with placeholder URLs, or `organization.jsonc` for a complete third-party protocol example.
2. Prepare a complete private configuration outside the repository and fill in real deployment parameters, including Client ID. Placeholders cannot sign in. After downloading the CI ZIP, use the pinned core’s `scripts/configure-desktop-archive.ps1` to fill both legacy and versioned configuration, regenerate manifests and hashes, and verify that program bytes remain identical to CI. Do not commit private configuration or inject it into CI. Examples are parseable JSONC with comments and trailing commas.
3. Custom logos need separate asset assembly and verification; the configuration overlay script does not add logo files. Place the logo under `config/assets/` and set `product.logoFile` to `assets/logo.png`. Paths are relative to the configuration file. PNG/WebP/SVG are supported up to 256 KiB.
4. Choose Exit from the system tray, then restart. Closing a window normally does not exit or reload configuration.

ECNU settings displays university services and sign-in without an editor for distribution configuration. The CI template has an empty `organizations` list. Maintainers must apply private configuration locally and validate both fresh installations and upgrades. Complete examples are in `config/examples/`.

## Identity and credentials

`provider.id` must match resource bootstrap `provider.id`. Both current ECNU and CERNET services use `chatecnu`; do not change it for display purposes. Local organization IDs remain `ecnu` / `cernet`; change `displayName` for presentation. Existing copies of an older CERNET example only need their Provider ID corrected and the client restarted, without clearing login or other settings.

`organizations` may be empty or contain multiple distinct IDs. Managed-model `provider.id` routes must also be unique. The ECNU and CERNET examples both use `chatecnu` and are alternative deployments; they cannot be enabled together unchanged. Do not change only the client Provider ID: use distinct matching server IDs or separate client configurations. Personal API Key access remains available. For identity-only OIDC, omit both `keyBinding` and `provider`; key provisioning and model catalogs require the server resource protocol.

Treat Client ID as deployment information even though it is not an OAuth secret. Examples contain placeholders, never passwords, API Keys, client secrets or login tokens. Desktop login uses PKCE and a local loopback callback; the server must allow the public desktop client's callback mechanism. Copying an example does not implement the server protocol or grant permissions.

Examples use `EDUWORK_API_KEY`: enterprise login writes it, and configured model, speech, image and institution-search services resolve the same local reference. It is neither plaintext nor an ECNU-only field. Personal provider credentials remain separate. Preserve legacy credentials through migration rather than clearing them or copying keys into configuration.

## Branding and updates

Interface names and logos are configurable; executable icons, application IDs and signing are determined at build time. See `updates.jsonc` for update sources. Installation support depends on the shell's updater. Adding an ECNU URL to the public edition does not install campus-specific plugins.

Portable archives run after extraction, with `config/` and `data/` beside the application. Identity credentials use OS protection. ECNU Electron updates add complete school configuration for the new program version, retaining earlier files for rollback. Personal settings, models, keys and history are preserved. Legacy `eduwork.jsonc` no longer controls the current school edition; public-edition configuration ownership is unchanged.

Distribution-managed model corrections ship with resources and produce the effective catalog at startup; server-discovered catalogs remain authoritative. Cross-machine history import does not copy login credentials.

## Images and speech

Image generation and cloud TTS use the public `media` configuration without extra school media plugins. Both deployment examples include models, sizes and voices; CERNET uses `cernet-image` / `cernet-tts`. Older ECNU configuration without `media` retains distribution defaults; explicit `media.providers: []` disables cloud media. Local TTS remains independent.
