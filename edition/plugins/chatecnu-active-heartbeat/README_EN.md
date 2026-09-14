# ChatECNU activity heartbeat

[简体中文](README.md)

An institution-specific service reporting only a random installation identifier, client metadata and foreground/background state. It does not read conversations, workspaces, files or local activity statistics. Public EduWork, generic OIDC, Studio and Memory do not depend on this package.

## Scheduling and data boundaries

- The browser renews a local Host foreground lease every 25 seconds. This is not a school-server heartbeat. The Host merges pages of one instance, reports immediately on foreground entry, resume and sign-in, then normally every 600 seconds. Foreground reporting stops after 75 seconds without renewal.
- Background transition sends one best-effort `background` report and stops periodic requests. Optional idle detection is not implemented. Page exit revokes the lease; plugin disposal cancels timers and unfinished requests.
- Network failures, 5xx and 429 retry with exponential backoff from 15 seconds, capped at 10 minutes plus 20% jitter; network recovery can trigger an earlier retry. Other HTTP or login failures wait for login or configuration reload.
- The random installation UUID survives data-folder moves and upgrades. It does not use hardware serials, hostname or browser fingerprints. Platform/architecture are actual values; OS versions are not guessed.
- Requests use OAuth Access Tokens, never model API Keys. The account layer owns refresh and at most one retry after 401. Browser RPC exposes only presence and normalized status, not tokens, raw server responses or account identifiers.

## Local Web backend

Runs directly in a single-user DSH Host without Go, `desktopBoundary` or a native account bridge. Supply trusted assembly configuration, not browser-editable settings:
```json
{
  "backend": "web",
  "enabled": true,
  "profileID": "campus",
  "baseURL": "https://campus.example.edu",
  "endpoint": "/user/active",
  "productName": "EduWork@ECNU",
  "version": "0.3.0-dev.1",
  "platform": "web"
}
```

`backend: "web"` requires explicit `enabled: true`. Disabled instances neither require a destination/OIDC service nor contact remote servers. Keep it disabled until the production endpoint is available; the example domain is a placeholder.

Enabled instances require a configured `profileID` and explicit `baseURL`. The default `/user/active` endpoint must share that origin. Host-only `ctx.oidcAccounts.authorizedFetch(profileID, endpoint, init)` handles credentials, refresh and target-origin validation. By default, only the exact profile issuer and `keyBinding.baseURL` origins are allowed; trusted assembly may add HTTPS origins through OIDC `authorizedOrigins`. This plugin exposes no RPC to change that allowlist or retrieve tokens.

Identity-only accounts can report without a model Key. `oidc/accounts-changed` starts/stops only the relevant profile. Explicitly signed-out accounts stay silent; expired login is handled by OIDC.

The installation ID defaults to `$DSH_HOME/state/chatecnu-active/installation-id`. An absolute `stateDirectory` or non-secret fixed `installationID` may be supplied, but independent installs must not share a fixed value. Migration may reuse the old native `state/chatecnu/installation-id`. Corrupt files produce a local error instead of silently replacing the identifier.

The existing `POST /user/active` wire contract uses `client.installation_id`. OAuth `client_id` belongs in the OIDC profile; there are no new wire `device_id` or `client_id` fields. Other metadata is name/version/platform/channel/device/os/arch/locale/timezone. Overlong version strings are omitted. Server `next_heartbeat_in` defaults to 600 seconds, bounded to 60–3600 seconds.

## Native backend

Omitting `backend` or selecting `"native"` uses the desktop implementation with dynamic `desktopBoundary` and `enterpriseAccounts` dependencies. Only the institutional bundle loads it; the trusted catalog must also explicitly set `nativeExtensions["chatecnu.active-heartbeat"] = true`. It is off by default and can also be disabled with `enabled: false`.

The native adapter at `dsh-desktop/internal/chatecnuactive` requests `/user/active`. The generic native account layer manages OAuth tokens, clears invalid refresh sessions, and preserves login on network failures. The installation ID lives under native `state/chatecnu/installation-id`; version, platform and architecture come from the native host.

## Development

`lib/*.js` is maintained source with no generation step. Browser presence uses DSH's public same-origin Typert HTTP interface; the Host retains typed RPC descriptions without adding token RPCs or UI.

Run `node --test test/*.test.mjs`. Host/client ModuleLoader tests default to `dist/dsh-cache/runtime-npm-0.1.5-rc.2`; `EDUWORK_TEST_RUNTIME` can select another prepared rc.2 runtime. Tests cover real Cordis loading, dynamic dependencies, disposal, official ModuleLoader with simulated DOM events, multi-page presence and synthetic local HTTP wire/error/installation-ID behavior. They use no real UAT service or credentials. OIDC protocol tests own refresh and trusted-origin coverage.

Native checks use `go test ./internal/chatecnuactive ./internal/enterpriseauth ./internal/nativevault`. Validate the complete configured login/heartbeat flow in the assembled distribution before release.
