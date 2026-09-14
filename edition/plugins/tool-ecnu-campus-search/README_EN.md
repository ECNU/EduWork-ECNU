# ECNU campus search

[简体中文](README.md)

A native DSH search tool for East China Normal University. It calls the institution's platform through `POST /search`, reusing the configured API Base URL and `EDUWORK_API_KEY` reference without storing separate accounts or keys.

The tool is named `ecnu_campus_search`. Use it for ECNU-related sites, services, organizations, policies and news. DSH's official `web_search` remains available for general background and external facts.
`oidcProfileId` matches the organization entry `id`, not `provider.id`. The plugin verifies the institution, credential reference and service endpoint before using a key. Current distributions use this binding. Omitting the field selects the legacy direct-credential mode, intended only for controlled assemblies managing a personal key; it does not provide the institution binding used by school sign-in.

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

Returned titles, excerpts and links are untrusted search content, not Agent instructions. Bearer keys never enter tool output, logs or errors.

The plugin retains `CHATECNU_API_KEY` as its internal default for legacy compositions. New distribution configuration should explicitly set `EDUWORK_API_KEY`, as in the example.
