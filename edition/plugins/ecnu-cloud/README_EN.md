# ChatECNU cloud

[简体中文](README.md)

Keeps native EduWork workspaces and conversations first, including workspaces linked to cloud projects. ChatECNU appears below them and is collapsed by default. Its recent-conversation and project groups can also collapse; the overall expansion preference is remembered. Linkage and provenance use icons with hover and keyboard-focus descriptions. Conversations are grouped by date, with title filtering, incremental loading and full-page reading. It shares the school account service's fixed read operations and existing authentication. Ordinary conversations support local continuation; projects use a local workspace linked to their cloud knowledge library.

Previews render text without executing HTML, loading external images or replaying tools. Unsupported messages are identified. Each preview is limited to 1,000 messages and 1 MB of text.

Native workspaces and ChatECNU groups share the sidebar scrollport. Groups have no height cap or inner scrolling; collapse controls, three recent entries and all-items links keep navigation manageable. The account footer stays fixed and the main page scrolls independently. Project status icons are consistent across the sidebar, list and detail page: a globe indicates a cloud project and a link indicates a workspace association. Hover or keyboard focus explains the workspace name and on-demand source access. Association does not mean sources have been downloaded or synchronized.

Sidebar headings explicitly label the recent-three-conversation and three-project previews, showing the actual count when fewer entries exist. All-conversations and all-projects actions use visible text and remain available when a group is collapsed. Expanded projects also state the conversation preview count and offer a text link to all conversations and sources, distinguishing the preview from the complete content.

The sidebar and full conversation lists share status icons: a globe previews a cloud conversation and a folder opens a local one. Continued rows open the local session, with a separate globe button for the cloud original. Hover and keyboard focus explain each action. The ordinary list combines default-workspace sessions with local continuations of ordinary cloud conversations. Project lists combine only that project's conversations and its linked workspace's sessions, sorted by recent activity and deduplicated. Each section header offers its own all-conversations or all-projects action, opening a dedicated page.

Opening a cloud conversation only previews its history. The first send imports that history and starts a local continuation, with a visible notice that subsequent messages stay local. Ordinary conversations use the default local workspace unless another is selected through the existing picker. A continued sidebar row opens the same local conversation; the cloud original remains accessible separately.

Projects expand to show conversations and open a page with conversations and cloud sources. The first new message or continuation asks the user to confirm one local workspace for that project. Later project conversations must continue in that same workspace. A linkage icon beside the native workspace title and a project marker in conversation headers open the cloud project. Local continuations remain in their owning workspace, with a provenance icon for opening the cloud original. Cancelling first-use setup preserves the draft and creates no grant. Conversations are associated only when the server explicitly supplies the project-to-Notebook mapping; other libraries are listed separately. Source text is read on demand with fresh server permission checks. Empty content and read errors are distinguished; long text is limited to 200,000 displayed characters. Browsing alone neither persists cloud content nor establishes a workspace knowledge grant.

Uses DSH storageDomain and workspaceRegistry. References use stable workspace IDs, so renaming does not break them. Missing directories or moved sessions return explicit states without creating directories, moving sessions or silently clearing bindings.

An explicit one-to-one project/workspace link enables three read-only tools in that workspace: `ecnu_project_search`, `ecnu_project_sources`, and `ecnu_project_read_source`. The Host resolves the project from the session’s actual working directory; the Agent cannot supply another project or workspace. Grants are partitioned by account, school Profile, model base and Notebook service base. Old continuation defaults do not grant access. Each execution revalidates the binding, source boundaries and server permissions.

Unlink from the linked-workspaces section of the project list, even if the cloud project was deleted or sharing revoked. Unlinking disables project tools without deleting local tasks or files. Source text is read on demand; there is no original-file download, automatic synchronization or new OAuth consent flow.

## Integration

The merged sidebar prototype requires generic UI Workspace extension points: `sidebar.workspaces.content` and `sidebar.workspaces.group.actions`, plus an opt-in shared scrollport via `data-sidebar-workspace-flow="outer"`. These are not released DSH 0.2.2-rc.3 APIs; they are currently validated only in an isolated local preview. The prototype cannot be dropped into a released desktop that lacks these seams.

Explicitly load the service with an existing school profile and model API base:

```json
{
  "profileID": "school",
  "modelBaseURL": "https://example.org/open/api/v1"
}
```

The Host must provide the existing OIDC modelAuthorization and accountIdentity APIs. The latter supplies a verified stable identity. Missing support returns identity_unavailable rather than guessing from a display name or temporary ID. This is a component dependency, not a new OAuth scope or consent flow. Default assembly, release locks and user configuration are unchanged; integrate after the required public package is available.

Storage is partitioned by account identity, profile and environment. No tokens are persisted. Normal token renewal preserves bindings; new sign-ins, account changes and sign-out invalidate previous selection leases. Committed mappings survive restart. Browser RPCs are owner-only.

Conversation browsing also requires the `ecnuAiconsole` read service for the same school profile. UI and Agent queries share one reader; there is no separate authentication or HTTP client. Missing services or read permissions have explicit states. The UI uses the DSH 0.2.2-rc.3 sidebar, main panel, buttons and icons.

The project adapter uses the same OIDC service and a fixed Notebook MCP endpoint, allowing only library listing, details, source listing, knowledge retrieval and source text reads. `workerBaseURL` defaults to `/api/worker/v1` on the model service origin and can be explicitly configured by the trusted edition; cross-origin configuration is rejected. The UI cannot supply URLs or arbitrary tool names. MCP POST requests use existing Host service authorization, with replay limited to buffered read-only requests. Project reads support cancellation and an overall deadline.

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

These compatibility methods are Host-only and stored separately from explicit workspace knowledge grants. UI and Agent callers must not supply account identities, environments or storage keys. A future server adapter must establish project IDs; cloud workspaceId must not be inferred to be a Notebook ID.

## Boundaries and validation

Import uses official Session validation, sessionPersistence and workspaceRegistry without starting a model. After confirmation, a durable local journal reserves one session ID. Interrupted imports verify the existing prefix and append only its missing suffix; conflicting history is never overwritten. Leaving the page requests cancellation while preserving written data for recovery. Missing directories or moved sessions require repair rather than duplicate creation.

The summary and messages are fetched again before import and checked against the preview snapshot. Project IDs are explicit per-conversation bindings, never inferred Notebook IDs. Imported history has a separate source marker and excludes cloud system prompts, tool execution, reasoning and billing. Legacy conversation bindings grant no workspace source access. New knowledge grants require an explicit link in the project UI, and the platform still authenticates every source request. There is no downloading, two-way synchronization or cloud mutation.

Set EDUWORK_TEST_RUNTIME to the pinned DSH Runtime and run from the school repository:

```powershell
node --import ./edition/test/runtime-resolver.mjs --test edition/plugins/ecnu-cloud/test/*.test.mjs
```

Tests use real DSH JSON storage and workspace registration with synthetic identities, covering restart, account/environment isolation, rebinding, duplicates/conflicts, missing directories, concurrent account changes and storage failures. Knowledge tests also use the real RC3 tool registry and MCP transport to check workspace activation, source boundaries, unlink revocation and endpoint isolation. They do not establish cloud-service or desktop acceptance.
