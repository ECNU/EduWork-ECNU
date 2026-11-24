# AIConsole account queries

[简体中文](README.md) | **English**

Read-only account tools for the EduWork school edition, using the existing school OIDC login. Queries cover profile, usage, quota, points and history, entitlements, orders, catalog, masked keys, the user's running Open LLM requests, and ChatECNU conversations/messages.

For account changes, plaintext key access, request cancellation or invitations, the agent links to [AIConsole](https://aiconsole.ecnu.edu.cn) in its response so the user can act there. The fixed operation list never expands with token permissions.

## Configuration and usage

Explicitly mount the plugin with an existing OIDC profile and its matching model-service API base:

```json
{
  "oidcProfileId": "school",
  "baseURL": "https://school.example/open/api/v1",
  "requestTimeoutMs": 20000
}
```

The host supplies credentials; tool arguments cannot change the destination or HTTP method. Redirects are rejected. Account changes, logout and disposal cancel pending reads. Responses and credentials are not persisted. The server still enforces read scopes; publishers verify the existing login scope and account eligibility before assembly. There is no per-feature consent entry. Missing permissions return an error with a console link.

Tools such as `ecnu_account_get_profile` and `ecnu_account_get_usage` describe their parameters. Results include `operation`, `dataJSON`, `parametersJSON`, `coverage` and `timezone`. Pagination starts at 1; account `page_size` and conversation-list `limit` default to 20, maximum 100. `coverage: page` means one page only. Dates use Asia/Shanghai; missing values remain unknown. Read all pages before reporting complete totals.

The accompanying [account query Skill](../../skills/ecnu-aiconsole/SKILL.md) explains data interpretation and redirects account changes. This source does not change the default distribution. Explicitly assemble the plugin and Skill together. The runtime baseline is DSH 0.2.2-rc.3.

## Host reuse and tests

The host service `ecnuAiconsole.read(operation, args, { signal })` returns parsed `data` and query scope for UI adapters to reuse. Do not expose generic authorized requests through renderer RPC. Key lists return safe metadata only.

Run protocol tests with `node --test edition/plugins/ecnu-aiconsole/test/reader.test.mjs`.

For host integration, set `EDUWORK_TEST_RUNTIME` to an assembled product's `d` directory, then run `node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/ecnu-aiconsole/test/*.test.mjs` from the school repository root. These tests use synthetic identity services with actual DSH/OIDC modules; they do not validate production or a real account.
