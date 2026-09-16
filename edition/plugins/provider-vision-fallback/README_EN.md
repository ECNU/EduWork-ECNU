# Enterprise image-input fallback

[简体中文](README.md)

A provider-boundary plugin adding aggregate `image` input capability to text-only enterprise routes. It preserves original attachments in DSH history and rewrites only the final model request: a configured vision specialist observes the image, and the primary model receives explicitly untrusted textual evidence.

## Configuration and native images

The ECNU catalog declares `ecnu-max` with `input: ["text"]`; by default, `ecnu-plus` observes images and supplies textual evidence. Native image models such as `ecnu-plus` receive images directly without calling the specialist. Native request failures are not hidden by silently switching to text evidence. Routing follows the configured native capability rather than guessing from model names.

Fallback applies by default only to text-only models under the configured provider. The distributor can set `"features": { "visionFallback": false }` in the versioned school configuration, exit through the tray and restart to disable it; `true` restores it. The current Electron edition updates the complete school configuration with each release. The option does not install the plugin into an unextended public edition and does not affect a model's native image input.

Direct DSH/Web compositions can set `config.enabled: false` or `EDUWORK_VISION_FALLBACK=false`. `config.model` (default `ecnu-plus`), service URL and `credentialRef` (default `EDUWORK_API_KEY`) select the specialist. `config.provider` limits assistance to that enterprise adapter route, not arbitrary third-party providers.

On startup, ECNU corrects recognized old managed `ecnu-max` catalog entries to native `input: ["text"]` before passing them to OIDC; the fallback plugin then adds aggregate image capability. Institution ID, issuer, Provider ID, official gateway, adapter and model must all match. The configuration file, personal models and custom gateways remain unchanged; no new login is required. Both shells share this entry. Public EduWork and the standalone plugin do not carry ECNU catalog corrections; deployments must supply correct native `input` declarations.

## Processing boundaries

- Mounted once per institution bundle below Agent, Skill and Tool layers; decisions use only the selected model's native `inputModalities`.
- Native multimodal models receive unchanged images; text-only models receive specialist evidence without another Agent-visible tool.
- One context-independent observation is persisted under `DSH_HOME` per immutable attachment, specialist model and analysis-policy version, reused across retries, restarts and session forks.
- Progress is logged rather than appended as `user/message`, preventing operational notices from becoming later model-visible user instructions.
- Per-image and accumulated evidence are bounded. New evidence wins when the text budget is exceeded; old images become deterministic reattachment placeholders.
- Only canonical DSH messages and rich tool-result content blocks are consumed. The plugin neither scans project paths nor exposes its internal fallback route to callers.
