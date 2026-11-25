# ECNU quota wire

Institution-only extension. This existing wire is no longer part of public OIDC. See quota.openapi.yaml.

### QUOTA-01: Quota

`GET {provider.baseURL}/quota`, authenticated with the runtime key, returns HTTP 200 JSON with `Cache-Control: no-store`:

```json
{
  "provider_id":"example-ai","unit":"credits",
  "windows":[{"type":"fixed_168h","limit":1000,"used":250,"remaining":750,"reset_at":"2026-10-01T00:00:00Z"}],
  "resource_packs":[{"id":"pack-1","name":"Example pack","total_credits":100,"used_credits":10,"remaining_credits":90,"expires_at":null,"status":"active"}],
  "ops_console_url":"https://ai.example.edu/usage"
}
```

`provider_id` names the server quota namespace. It MUST match the local Profile provider ID by default, or the explicit `quotaProviderIDs[profileID]` value when configured. This distinction never changes the authorized account or request destination. `windows` is required (at most 64 entries); an empty array means no periodic windows. `unit` is a display label, not necessarily credits. Window `type` identifies server-owned boundaries; clients do not assume calendar weeks. Quantities are finite nonnegative numbers or null; missing means unknown, not zero, and the client does not infer the third quantity from two others. `reset_at` and pack `expires_at` are RFC3339 or null. `resource_packs` is optional (at most 256), with the fields shown above. Windows and packs may represent separate pools and must not be summed blindly. The HTTPS `ops_console_url` is optional; `console_url` is a legacy alias. Credentials in URLs are prohibited.

### Client account state

The school plugin's `points`, `invitation` and read-only `accountState` RPCs may return `accountRevision` (a UUID string). This random Host revision identifies the current authorization lifetime; it is separate from the quota HTTP protocol above. Normal token renewal preserves it, while logout, account replacement, new authorization or plugin restart changes it. It carries no identity or credential and must never authorize an operation. Older OIDC packages without stable identity support omit it and retain conservative invalidation. `accountState` checks the existing school authorization without calling points or invitation business endpoints. See `lib/typert-schemas.js` for exact fields.

Percentages require a positive limit and known remaining value; displays clamp to 0–100% while showing the original quantities. 401/403/404/429/5xx makes quota unavailable without clearing otherwise valid identity/model credentials. Quota reads do not automatically renew a model key or prevent a model call. Authorization and billing remain server responsibilities.

