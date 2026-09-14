# Enterprise configuration examples

[简体中文](README.md)

Total model-request concurrency defaults to 3 across main conversations, subagents and auxiliary model requests in this client. Excess requests queue. Users can save changes immediately in Settings → General → Total model-request concurrency. Top-level `features.maxConcurrentRequests` sets the distribution default (1–64); file changes require restart and saved preferences take priority. Legacy `maxParallelSubagents: 2` maps to a total of 3. Update settings offer public-beta or development (including public-beta) channels; switching does not downgrade or change the installed-version badge.

The ECNU example declares DeepSeek V4.1 `ecnu-max` with `input: ["text", "image"]`. Startup synchronizes recognized old managed catalogs without editing the configuration file or requiring another login. Matching requires the institution identity, official gateway and model. Personal providers, custom gateways, keys and the default model choice remain unchanged. `features.visionFallback: false` disables assistance for configured enterprise text-only models; native image input remains available.

Enterprise configuration is read only from `config/eduwork.jsonc`. Settings displays organizations, login and model details without an organization-editing form. Quota is supplied by the ECNU extension, not public OIDC.

`ecnu-max` defaults to a **512K context (524,288 tokens)** and **384K maximum output (393,216 tokens)**. Recognized old managed limits of 1,000,000 or 262,144 are synchronized on startup; custom values are retained. Standard mode uses DSH automatic compaction around 80% context pressure, including existing sessions, without clearing history.

## Apply an example

1. Choose `ecnu.jsonc` for ECNU services, `cernet.jsonc` for a CERNET-style deployment with placeholder URLs, or `organization.jsonc` for a complete third-party protocol example.
2. Copy its contents to `eduwork.jsonc` one directory above and fill in real deployment parameters, including Client ID. Placeholders cannot sign in. Apply private configuration after downloading the GitHub CI archive; do not commit it or inject it into CI. Examples are parseable JSONC with comments and trailing commas.
3. For a custom interface logo, place it under `config/assets/` and set `product.logoFile` to `assets/logo.png`. Paths are relative to the configuration file. PNG/WebP/SVG are supported up to 256 KiB.
4. Choose Exit from the system tray, then restart. Closing a window normally does not exit or reload configuration.

Settings → Models → Enterprise services also offers Open configuration file and View examples. The default file includes a complete commented third-party example. The OS chooses the editor, prompting when no association exists; the app does not force an editor or change associations. Examples open in the file manager.

## Identity and credentials

`provider.id` must match resource bootstrap `provider.id`. Both current ECNU and CERNET services use `chatecnu`; do not change it for display purposes. Local organization IDs remain `ecnu` / `cernet`; change `displayName` for presentation. Existing copies of an older CERNET example only need their Provider ID corrected and the client restarted, without clearing login or other settings.

`organizations` may be empty or contain multiple distinct IDs. Personal API Key access remains available. For identity-only OIDC, omit both `keyBinding` and `provider`; key provisioning and model catalogs require the server resource protocol.

Treat Client ID as deployment information even though it is not an OAuth secret. Examples contain placeholders, never passwords, API Keys, client secrets or login tokens. Desktop login uses PKCE and a local loopback callback; the server must allow the public desktop client's callback mechanism. Copying an example does not implement the server protocol or grant permissions.

Examples use `EDUWORK_API_KEY`: enterprise login writes it, and configured model, speech, image and institution-search services resolve the same local reference. It is neither plaintext nor an ECNU-only field. Personal provider credentials remain separate. Preserve legacy credentials through migration rather than clearing them or copying keys into configuration.

## Branding and updates

Interface names and logos are configurable; executable icons, application IDs and signing are determined at build time. See `updates.jsonc` for update sources. Installation support depends on the shell's updater. Adding an ECNU URL to the public edition does not install campus-specific plugins.

Portable archives run after extraction, with `config/` and `data/` beside the application. Identity credentials use OS protection. Updates retain effective configuration and user assets while replacing program resources and official examples. Reinstalling default configuration does not overwrite an existing `eduwork.jsonc`.

Distribution-managed model corrections ship with resources and produce the effective catalog at startup; server-discovered catalogs remain authoritative. Cross-machine history import does not copy login credentials.

## Images and speech

Image generation and cloud TTS use the public `media` configuration without extra school media plugins. Both deployment examples include models, sizes and voices; CERNET uses `cernet-image` / `cernet-tts`. Older ECNU configuration without `media` retains distribution defaults; explicit `media.providers: []` disables cloud media. Local TTS remains independent.
