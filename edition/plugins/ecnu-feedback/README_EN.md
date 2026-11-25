# School answer feedback

[简体中文](README.md)

Adds like, dislike, change-rating and retraction controls to completed school-model answers through DSH's `conversation.chat.assistant-actions` slot. Eligibility uses each recorded provider, so changing the current model does not change historical attribution. Personal-model, streaming and interrupted answers have no entry. ChatECNU owns feedback state; this does not enable the original DSH feedback log or telemetry.

The UI follows the original DSH feedback flow and directly uses the pinned RC3 `Modal`, `Button`, `Tooltip`, `Toast` and rating icons. The school adapter owns only copy, configured categories and the ChatECNU interface. Official modal focus management, Escape cancellation and light/dark themes are preserved. Question/answer preview is collapsed by default; the always-visible disclosure states that the visible question, final answer and feedback are sent to ChatECNU for evaluation. The Host derives text from append-origin DSH messages and checks the preview digest instead of accepting client-supplied question/answer text. Reasoning, tool results, injected context and attachment binaries are excluded. Oversized context is rejected without silent truncation. Retraction sends `favorite=0` without uploading text again; the platform determines retention of previously submitted text.

Reuses existing school sign-in and Host-authorized requests, without incremental consent or a shared client account service. The server still enforces `feedback.read` and `feedback.write`; publishers must verify client registration, login scope configuration and compatibility with old sessions before enabling the feature. Users preview and submit directly, without a separate feedback-permission step. Denials show an error without automatic reauthorization. The plugin is not assembled by default and registers no Agent tools.

Example Host configuration:

```json
{
  "profileID": "school",
  "providerID": "school-ai",
  "modelBaseURL": "https://example.org/open/api/v1",
  "workerBaseURL": "https://example.org/api/worker/v1",
  "reasons": []
}
```

The model base must match school sign-in and Worker must share its origin. Writes use the OIDC Host's existing exact issuer-path authorization, so the feedback route must also be on the issuer origin. HTTPS is required by default. HTTP testing requires explicit `allowInsecureDevelopment: true` in both this plugin and the login Profile, plus an OIDC Host supporting exact service-URL checks. This option does not relax the same-origin restriction. Configure `reasons` only with platform-accepted categories; an empty list offers rating and optional notes. Notes are limited to 1,000 characters, questions to 50,000 and answers to 100,000. Only fixed feedback GET/POST paths are accepted, never arbitrary methods, URLs or tokens.

Rating changes reuse local session/message IDs; reopening reads platform state. The Host binds drafts to an opaque random `accountBinding` revision and checks the existing `accountIdentity` before and after requests. Same-account renewal preserves drafts; logout, account replacement, new sign-in and Host restart invalidate them. Older OIDC packages without identity support retain conservative credential-event invalidation. The client compares only random revisions and receives no account identifier or token. Failed revalidation preserves text and disables submission until retry succeeds; submission failures also preserve drafts. Writes are serialized. Account changes and disposal discard stale responses; changed previews block submission. Cancelling a draft sends nothing. Closing the dialog cannot cancel an already submitted request; use retraction instead. Source builds and synthetic tests do not establish production permissions, accepted categories or retention policy.

Build with the school plugin's `build-client.ps1` and test against the pinned DSH 0.2.2-rc.3 Runtime. UI primitives resolve through the desktop's preloaded external module; minimal layout styles are injected by JS, with no extra CSS assembly. `test/feedback.test.mjs` covers real DSH session events, Host boundaries and public OIDC sign-in/renewal against a synthetic IdP. `test/check-browser.mjs` compiles the actual installed RC3 package's published component sources and theme styles to verify controls, preview, denials, rating changes, retraction, focus, narrow windows and draft recovery. Set `DSH_OIDC_PACKAGE_ROOT` to the compiled public OIDC package and `EDUWORK_TEST_RUNTIME` to the assembled Runtime. The fixture requires `playwright-core`, React 18, Runtime `esbuild` and the component build dependency `clsx`; `EDUWORK_UI_TEST_DEPS` may point to an isolated `node_modules` for the latter. This fixture verifies component behavior and themes; actual desktop module assembly still needs separate validation.
