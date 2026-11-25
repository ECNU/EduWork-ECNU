# ChatECNU cloud local bindings

[简体中文](README.md)

Records default local workspaces for cloud projects and existing local continuations for cloud conversations. This is a Host-only service for future browsing, import and source adapters. It registers no UI, RPC or Agent tools and makes no cloud requests.

Uses DSH storageDomain and workspaceRegistry. References use stable workspace IDs, so renaming does not break them. Missing directories or moved sessions return explicit states without creating directories, moving sessions or silently clearing bindings.

## Integration

Explicitly load the service with an existing school profile and model API base:

```json
{
  "profileID": "school",
  "modelBaseURL": "https://example.org/open/api/v1"
}
```

The Host must provide the existing OIDC modelAuthorization and accountIdentity APIs. The latter supplies a verified stable identity. Missing support returns identity_unavailable rather than guessing from a display name or temporary ID. This is a component dependency, not a new OAuth scope or consent flow. Default assembly, release locks and user configuration are unchanged; integrate after the required public package is available.

Storage is partitioned by account identity, profile and environment. No tokens are persisted. Credential/account changes invalidate active and queued operations. A newly signed-in account cannot read the previous account's bindings. Committed mappings survive restart.

The model base requires HTTPS by default. Isolated HTTP testing requires explicit `allowInsecureDevelopment: true` in this plugin and the school login Profile; the OIDC Host still validates the service address. HTTP and HTTPS bases use separate storage partitions and cannot access each other's bindings.

## Host methods

| Method | Purpose |
| --- | --- |
| projectWorkspace(projectID) | Resolve the default workspace and directory status |
| bindProject(projectID, workspaceID) | Change the default for future continuations without moving existing sessions |
| unbindProject(projectID) | Clear only the default choice |
| conversation(conversationID) | Look up an existing local continuation before import |
| rememberConversation(conversationID, sessionID, workspaceID, projectID?) | Register an existing workspace member; identical registrations are idempotent and conflicts are rejected |
| forgetConversation(conversationID) | Explicitly repair a mapping without deleting the local session |
| projectForSession(sessionID) | Resolve only this account/environment/session's project, never a directory-wide project scope |

Only trusted Host adapters may call these methods. UI and Agent callers must not supply account identities, environments or storage keys. A future server adapter must establish project IDs; cloud workspaceId must not be inferred to be a Notebook ID.

## Boundaries and validation

This component does not parse messages, create sessions or implement a complete import transaction. The importer must check for existing continuations before creation and recover failures between creation and registration. Bindings grant no project access: source requests must still be authenticated by the platform and check project membership. There is no downloading, synchronization or cloud mutation.

Set EDUWORK_TEST_RUNTIME to the pinned DSH Runtime and run from the school repository:

```powershell
node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/ecnu-cloud/test/*.test.mjs
```

Tests use real DSH JSON storage and workspace registration with synthetic identities, covering restart, account/environment isolation, rebinding, duplicates/conflicts, missing directories, concurrent account changes and storage failures. They do not establish cloud-service or desktop acceptance.
