# Decision service configuration

[简体中文](DECISION.md) | **English**

The school edition uses the public `@eduwork/dsh-decision` package, its `decision_evaluate` tool and `decision` skill. Tools, protocol handling and skills are maintained in the public repository, with no duplicate school implementation.

Use it for routing material by labels, condition checks and rubric scoring. Sign in with an account allocated `ecnu-decision`, then ask to classify a request into campus card, network or other. OAuth requires the service's model-invocation scope (`llm:invoke` for this school service).

After initial npm publication and verification, the public component lock must pin the package, and the school edition follows that public version. The currently pinned public 0.4.9 does not contain it. This prepares configuration for an installed package; it does not claim the existing installer has the tool. The native plugin ID is `decision`; it is disabled by default, with school configuration enabling it after installation.

Set `plugins.decision` in the active `config/eduwork.jsonc` (under the user data directory on macOS):

```json
{
  "enabled": true,
  "baseURL": "https://chat.ecnu.edu.cn/open/api/v1",
  "model": "ecnu-decision",
  "authMode": "oidc",
  "oidcProfileId": "ecnu",
  "credentialRef": "EDUWORK_API_KEY",
  "imageInput": "data-uri",
  "maxQuestions": 64,
  "maxRequestBytes": 12582912,
  "requestTimeoutMs": 190000
}
```

Defaults also live in the distribution configuration; initial school-profile delivery and existing-user configuration updates follow the school publication process. Configuration neither installs plugins nor overrides public npm locks. OIDC mode uses only school sign-in; the credential reference is used only in explicit `api-key` mode. Renewal remains owned by OIDC and failures never fall back to personal keys.

Question counts, image encoding and payload limits belong to the school configuration, not the generic protocol. Defaults: 64 questions, 12 MiB total request, 190-second timeout; the server may impose lower limits. Images use this service's Data URI extension; text tasks do not need images.

Results are model estimates, not approval or permission to modify files or send messages. Confidence semantics may differ between services. For 401 check sign-in, 403 model allocation/scopes, 422 model alias/request validation. Do not repeatedly retry timeouts.

See the [public plugin documentation](https://github.com/ECNU/EduWork/tree/main/packages/dsh-decision) for protocol coverage and usage.
