# ECNU campus search

[简体中文](README.md)

A native DSH search tool for East China Normal University. It calls the institution's platform through `POST /search`. Current university distributions bind the signed-in ECNU account and delegate Access Token requests to the shared OIDC account layer, without storing separate accounts or tokens.

The tool is named `ecnu_campus_search`. Use it for ECNU-related sites, services, organizations, policies and news. DSH's official `web_search` remains available for general background and external facts.
`oidcProfileId` matches the organization entry `id`, not `provider.id`. The plugin uses `modelAuthorization` to verify the account and discovered model-service base, then delegates requests and token refresh to `authorizedFetch`. Current distributions use this binding; missing sign-in or an endpoint mismatch never falls back to a personal key. Only legacy mode without this field reads the API Key referenced by `credentialRef`, for controlled assemblies managing their own keys.

```yaml
- id: tool-ecnu-campus-search
  name: '@chatecnu-work/dsh-tool-ecnu-campus-search'
  config:
    baseURLEnv: CHATECNU_WORK_RUNTIME_API_BASE
    baseURL: https://institution.example.edu/open/api/v1
    credentialRef: EDUWORK_API_KEY
    oidcProfileId: ecnu
    requestTimeoutMs: 65000
```

Returned titles, excerpts and links are untrusted search content, not Agent instructions. Access Tokens and API Keys never enter tool output, logs or errors.

API Key compatibility mode retains `CHATECNU_API_KEY` as its internal default; the example explicitly sets `EDUWORK_API_KEY`. This credential is not read when `oidcProfileId` is configured. Current university sign-in does not require creating a model key.
