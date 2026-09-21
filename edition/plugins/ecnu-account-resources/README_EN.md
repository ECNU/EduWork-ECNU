# ECNU account resources

[简体中文](README.md)

Loaded only by the ECNU edition. Public `@eduwork/dsh-oidc` does not query quota or interpret allowance fields. This package owns `/quota` requests, normalization, separate RPC and account-menu details. The heartbeat plugin remains responsible for heartbeats.

Install on the Host with `profileIDs: ['ecnu']` (the default), substituting the actual ECNU Profile ID when needed. An explicit empty list disables all profiles. Third-party organizations and personal models are not queried. Its client module uses the official public `oidc.account.menu.details` slot; unmatched profiles retain public account actions without quota queries. `backend: desktop/web` uses the same code through the OIDC transport interface.

RPC methods `ecnuAccountResources.configuration()` and `quota(profileID)` return allowlisted projections only. The Host calls `oidcAccounts.modelResourceFetch(profileID, '/quota', {signal})`. The shared account layer validates the model-service base and sends a GET using the current account's Access Token, handling refresh, redirect rejection, timeout, and account changes. The plugin never reads or copies tokens, and tokens never enter client RPC. Account/credential events, disposal and component lifecycles prevent stale account data from appearing. There is no cross-account cache.

The menu preserves actual window balances, progress, reset time, and resource-pack remaining/used/total/expiry/status values. No percentage is invented without a valid total; packs are not blindly added to windows. Detail links allow only credential-free HTTPS URLs. Refresh failure affects quota display only, without deleting sign-in state or blocking models.

See `quota.openapi.yaml` for interface fields. These are ECNU protocol fields, not OIDC standards or mandatory public resource capabilities. The shared OIDC module owns identity, Token sessions, and model catalogs. This extension does not migrate or overwrite saved identities, personal Keys, or user model choices.

Build against the locked, consistent DSH `0.1.5-rc.1` dependency tree and run `npm run test`. Point `DSH_OIDC_PACKAGE_ROOT` to the compiled public OIDC package. `test/check-browser.mjs` covers public/extension client integration, not a production IdP. Package with `npm pack --ignore-scripts`.
