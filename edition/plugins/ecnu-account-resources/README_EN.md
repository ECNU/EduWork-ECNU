# ECNU account resources

[简体中文](README.md)

Loaded only by the ECNU edition. Public `@eduwork/dsh-oidc` does not query quota or interpret allowance fields. This package owns `/quota` requests, normalization, separate RPC and account-menu details. The heartbeat plugin remains responsible for heartbeats.

Install on the Host with `profileIDs: ['ecnu']` (the default), substituting the actual ECNU Profile ID when needed. An explicit empty list disables all profiles. Third-party organizations and personal models are not queried. Its client module uses the official public `oidc.account.menu.details` slot; unmatched profiles retain public account actions without quota queries. `backend: desktop/web` uses the same code through the OIDC transport interface.

RPC methods `ecnuAccountResources.configuration()` and `quota(profileID)` return allowlisted projections only. The Host calls `oidcAccounts.modelResourceFetch(profileID, '/quota', {signal})`. The shared account layer validates the model-service base and sends a GET using the current account's Access Token, handling refresh, redirect rejection, timeout, and account changes. The plugin never reads or copies tokens, and tokens never enter client RPC. Account/credential events, disposal and component lifecycles prevent stale account data from appearing. There is no cross-account cache.

The menu preserves actual window balances, progress, reset time, and resource-pack remaining/used/total/expiry/status values. No percentage is invented without a valid total; packs are not blindly added to windows. Detail links allow only credential-free HTTPS URLs. Refresh failure affects quota display only, without deleting sign-in state or blocking models.

See `quota.openapi.yaml` for interface fields. These are ECNU protocol fields, not OIDC standards or mandatory public resource capabilities. The shared OIDC module owns identity, Token sessions, and model catalogs. This extension does not migrate or overwrite saved identities, personal Keys, or user model choices.

An optional entry near the avatar displays points and invitations. Balance uses the shared read-only `ecnuAiconsole.read('account_get_points')` implementation. Opening the dialog never creates an invitation: users explicitly request a link using their existing school login, with no per-feature consent step. No invitation Agent tool is registered. ChatECNU decides eligibility and rewards. Business timestamps without a timezone use Beijing time, and unknown balances never become zero.

Enable only with an `ecnu-aiconsole` service for the same Profile and an OIDC client supporting `oidc.account.footer.details`. Optional consent is not required. Points are disabled by default; missing slots leave existing quota functionality intact. Once compatible components are available, the edition can configure:

```json
{
  "profileIDs": ["school"],
  "points": {
    "profileID": "school",
    "modelBaseURL": "https://example.org/open/api/v1",
    "workerBaseURL": "https://example.org/api/worker/v1"
  }
}
```

The server still enforces `points.read` and `invitations.write`. Before enabling the feature, publishers must verify client registration, existing login scopes and compatibility with old sessions through the existing authentication configuration. The UI never requests or expands scopes; denied access is shown as unavailable. Additional RPC methods `points(profileID)` and `invitation(profileID)` return limited display fields and accept no arbitrary URL or method. The model base must match the signed-in school service; Worker and model services must share an origin. Invitation URLs must use that origin, preserving the returned environment, route and code. Account changes and disposal discard pending results.

Build against the pinned DSH `0.2.2-rc.3` Runtime and run `npm run test`. Point `DSH_OIDC_PACKAGE_ROOT` to the compiled public OIDC package. `test/check-browser.mjs` checks existing quota; `test/check-points-browser.mjs` uses a public package with the above slot to check points, invitation, server denial and account changes. Both use synthetic data, not a production IdP. Package with `npm pack --ignore-scripts`.
