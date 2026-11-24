# ECNU account resources

[简体中文](README.md)

Loaded only by the ECNU edition. Public `@eduwork/dsh-oidc` does not query quota or interpret allowance fields. This package owns `/quota` requests, normalization, separate RPC and account-menu details. The heartbeat plugin remains responsible for heartbeats.

Install on the Host with `profileIDs: ['ecnu']` (the default), substituting the actual ECNU Profile ID when needed. An explicit empty list disables all profiles. Third-party organizations and personal models are not queried. Its client module uses the official public `oidc.account.menu.details` slot; unmatched profiles retain public account actions without quota queries. `backend: desktop/web` uses the same code through the OIDC transport interface.

RPC methods `ecnuAccountResources.configuration()` and `quota(profileID)` return allowlisted projections only. The Host calls `oidcAccounts.modelResourceFetch(profileID, '/quota', {signal})`. The shared account layer validates the model-service base and sends a GET using the current account's Access Token, handling refresh, redirect rejection, timeout, and account changes. The plugin never reads or copies tokens, and tokens never enter client RPC. Account/credential events, disposal and component lifecycles prevent stale account data from appearing. There is no cross-account cache.

The menu preserves actual window balances, progress, reset time, and resource-pack remaining/used/total/expiry/status values. No percentage is invented without a valid total; packs are not blindly added to windows. Detail links allow only credential-free HTTPS URLs. Refresh failure affects quota display only, without deleting sign-in state or blocking models.

See `quota.openapi.yaml` for interface fields. These are ECNU protocol fields, not OIDC standards or mandatory public resource capabilities. The shared OIDC module owns identity, Token sessions, and model catalogs. This extension does not migrate or overwrite saved identities, personal Keys, or user model choices.

The optional AIConsole query-permissions entry reuses this account menu. Set `queryAccessProfileID` explicitly to a member of `profileIDs`, matching the account bound to the AIConsole read-only plugin. Omit it to hide the entry. It requires the public `oidcClientAccounts.authorization/requestAuthorization` capability. Older Hosts retain quota functionality. This source does not change release locks, default assembly, or user configuration.

Users select query purposes; no new permissions are preselected, and existing grants are displayed as read-only. Candidates are limited to eight read groups: profile, usage/quota, points/history, entitlements/catalog, orders, Key metadata, running requests, and cloud conversations. Available choices intersect the server-advertised capabilities. The publisher must also configure allowed candidates in the OIDC Profile's `auth.optionalScopes`; this neither grants them automatically nor adds them to required initial-login scopes. This entry never requests Key modification, request cancellation, feedback, or invitation permissions.

Only the explicit authorization button starts incremental consent through the shared school OAuth flow, after re-reading permission state. The common account layer preserves existing grants. Closing, cancelling, or an identity change cancels the pending client flow while preserving the old login. After completion, users retry their query; Agent calls are not replayed automatically. The dialog does not revoke existing grants. Users perform account writes in AIConsole. Reading cloud conversations does not implement local import or synchronization.

Build with `build-client.ps1` against the dependency tree selected by the release lock and run `npm run test`. Point `DSH_OIDC_PACKAGE_ROOT` to the compiled public OIDC package. `npm run check:browser` checks existing quota behavior; `npm run check:query-access` tests compiled public/extension consent integration. Browser tests use synthetic accounts, not a production IdP. Package with `npm pack --ignore-scripts`.
