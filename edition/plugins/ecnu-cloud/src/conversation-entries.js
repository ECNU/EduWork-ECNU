const time = value => Number.isFinite(value) ? value : 0
const workspaceTitle = workspace => workspace?.title === 'default-workspace' ? '默认工作区' : workspace?.title || '本地工作区'

/** A read-only projection shared by sidebar previews and full conversation lists. */
export function conversationEntries({ cloudRows = [], bindings = [], workspaceBindings = [], workspaces = [], sessions = {}, archived = [], project = null, workspaceID }) {
  const hidden = new Set(archived), entries = new Map()
  const projectWorkspace = project && (workspaceID ?? workspaceBindings.find(row => row.projectKey === project.projectKey)?.workspaceID)
  const projectWorkspaces = new Set(workspaceBindings.map(row => row.workspaceID))
  const scopeWorkspace = project ? projectWorkspace : workspaces.find(row => row.title === 'default-workspace' && !projectWorkspaces.has(row.workspaceId))?.workspaceId
  const inScope = row => project ? Boolean(project.projectID) && row.projectID === project.projectID : !row.projectID
  const matchingBindings = bindings.filter(inScope)
  const cloud = new Map(cloudRows.filter(inScope).map(row => [row.conversationID, row]))
  // A local continuation can be newer than the currently loaded cloud page.
  for (const binding of matchingBindings) {
    const workspace = workspaces.find(row => row.workspaceId === binding.workspaceID)
    if (!cloud.has(binding.conversationID) && sessions[binding.sessionID] && !sessions[binding.sessionID].blank
      && workspace?.sessionIds.includes(binding.sessionID) && (!project || workspace.workspaceId === projectWorkspace)) cloud.set(binding.conversationID, {
      conversationID: binding.conversationID, projectID: binding.projectID,
      title: sessions[binding.sessionID].title || 'ChatECNU 会话', updatedAt: 0,
    })
  }
  for (const row of cloud.values()) {
    const binding = matchingBindings.find(item => item.conversationID === row.conversationID)
    if (binding && hidden.has(binding.sessionID)) continue
    const workspace = workspaces.find(item => item.workspaceId === binding?.workspaceID)
    const session = binding && sessions[binding.sessionID]
    const valid = binding && session && !session.blank && workspace?.sessionIds.includes(binding.sessionID)
      && (!project || workspace.workspaceId === projectWorkspace)
    const key = valid ? `local:${binding.sessionID}` : `cloud:${row.conversationID}`
    entries.set(key, valid ? {
      key, kind: 'continued', cloud: row, sessionID: binding.sessionID, workspaceID: workspace.workspaceId,
      title: session.title || row.title, updatedAt: Math.max(time(session.updatedAt), time(row.updatedAt)), workspaceTitle: workspaceTitle(workspace),
      hint: `已在「${workspaceTitle(workspace)}」接续，点击打开本地会话`,
    } : { key, kind: 'cloud', cloud: row, title: row.title, updatedAt: time(row.updatedAt),
      hint: 'ChatECNU 云端会话，点击预览；首次发送时在本地接续' })
  }
  const workspace = workspaces.find(row => row.workspaceId === scopeWorkspace)
  for (const sessionID of workspace?.sessionIds ?? []) {
    const session = sessions[sessionID], key = `local:${sessionID}`
    if (!session || session.blank || hidden.has(sessionID) || entries.has(key)) continue
    // Project imports never leak into the ordinary-chat list after a move.
    if (!project && bindings.some(row => row.sessionID === sessionID && row.projectID)) continue
    entries.set(key, { key, kind: 'local', sessionID, workspaceID: workspace.workspaceId,
      title: session.title || '未命名会话', updatedAt: time(session.updatedAt), workspaceTitle: workspaceTitle(workspace),
      hint: `本地会话，保存在「${workspaceTitle(workspace)}」，点击打开`,
    })
  }
  return [...entries.values()].sort((a, b) => b.updatedAt - a.updatedAt || a.key.localeCompare(b.key))
}
