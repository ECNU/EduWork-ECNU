# ECNU campus and web search

[简体中文](README.md)

A native DSH search plugin for East China Normal University with two tools:

- `ecnu_campus_search`: campus search. Use it only for ECNU-related sites, services, organizations, policies and news.
- `ecnu_web_search`: web search through the school account, for public background, external reports and fact checking. Available only in school account mode; set `webSearch: false` to disable it and rely on DSH's official `web_search`.

## School account mode

Current university distributions set `oidcProfileId`. The plugin binds the signed-in ECNU account and delegates Access Token requests to the shared OIDC account layer. It stores no separate account or token and never sends identity headers such as `X-Api-Key` or `X-User-Id`.

Both tools call fixed Worker routes on the origin of `baseURL`:

| Tool | Route | Required scope |
|---|---|---|
| `ecnu_campus_search` | `POST /api/worker/v1/search/campus` | `search.campus` |
| `ecnu_web_search` | `POST /api/worker/v1/search/web` | `search.web` |

The request body is only `{"query": "..."}`. The paths are fixed in plugin code and authorized per request through the account layer's exact `issuerServicePath`; the account layer still verifies the issuer, refreshes at most once after 401 and cancels requests after sign-out. HTTP 403 means the grant lacks the scope, so sign out and sign in to the school account again; 503 means search is not configured on the service and 502 means a temporary upstream failure. The plugin never falls back between the Worker and open platform routes.

The school account grant must include `search.web` and `search.campus`. Existing sessions do not gain newly added scopes automatically; sign in once more.

`oidcProfileId` matches the organization entry `id`, not `provider.id`. The plugin uses `modelAuthorization` to verify the account and discovered model-service base; missing sign-in or an endpoint mismatch never falls back to a personal key.

## API key mode

Without `oidcProfileId`, the plugin registers only `ecnu_campus_search`, reads the API Key referenced by `credentialRef` and calls the open platform `POST {baseURL}/search` with `page`, `size` and `cancel_segment`. This mode is for controlled assemblies managing their own keys. `CHATECNU_API_KEY` remains the internal default; the example sets `EDUWORK_API_KEY`.

## Configuration

```yaml
- id: tool-ecnu-campus-search
  name: '@chatecnu-work/dsh-tool-ecnu-campus-search'
  config:
    baseURLEnv: CHATECNU_WORK_RUNTIME_API_BASE
    baseURL: https://institution.example.edu/open/api/v1
    credentialRef: EDUWORK_API_KEY
    oidcProfileId: ecnu
    webSearch: true
    requestTimeoutMs: 65000
```

## Data boundaries

Returned titles, excerpts and links are untrusted search content, wrapped in tags before reaching the model and never treated as Agent instructions. Worker `data` is kept as extensible JSON and truncated with a `truncated` marker beyond 60000 characters. Errors carry only status descriptions and never echo response bodies. Access Tokens and API Keys never enter tool output, logs or errors.
