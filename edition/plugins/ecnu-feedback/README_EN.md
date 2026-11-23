# School answer feedback

[简体中文](README.md)

Adds like, dislike, change-rating and retraction controls to completed school-model answers through DSH's `conversation.chat.assistant-actions` slot. Eligibility uses each recorded provider, so changing the current model does not change historical attribution. Personal-model, streaming and interrupted answers have no entry. ChatECNU owns feedback state; this does not enable the original DSH feedback log or telemetry.

Before submission, users preview the current visible question and final answer text and are told it will be sent to ChatECNU for evaluation. The Host derives text from append-origin DSH messages and checks the preview digest instead of accepting client-supplied question/answer text. Reasoning, tool results, injected context and attachment binaries are excluded. Oversized context is rejected without silent truncation. Retraction sends `favorite=0` without uploading text again; the platform determines retention of previously submitted text.

Requires a public OIDC package with optional consent and the shared `oidcClientAccounts` client service. Configure `feedback.read` and `feedback.write` separately in `auth.optionalScopes`. Consent does not submit feedback; users must click submit. Regular sign-in does not require these scopes. The plugin is not assembled by default and registers no Agent tools.

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

The model base must match school sign-in and Worker must share its origin. Writes use the OIDC Host's existing exact issuer-path authorization, so the feedback route must also be on the issuer origin. Configure `reasons` only with platform-accepted categories; an empty list offers rating and optional notes. Notes are limited to 1,000 characters, questions to 50,000 and answers to 100,000. Only fixed feedback GET/POST paths are accepted, never arbitrary methods, URLs or tokens.

Rating changes reuse local session/message IDs; reopening reads platform state. Writes are serialized. Account changes and disposal discard stale responses; changed previews block submission. Cancelling a draft sends nothing. Closing the dialog cannot cancel an already submitted request; use retraction instead. Source builds and synthetic tests do not establish production consent, accepted categories or retention policy.

Build with the school plugin's `build-client.ps1` and test against the pinned DSH 0.2.2-rc.3 Runtime. `test/feedback.test.mjs` covers real DSH session events and Host boundaries. `test/check-browser.mjs` covers compiled controls, preview, consent, rating changes and retraction; point `DSH_OIDC_PACKAGE_ROOT` to a compiled public package with the required capabilities.
