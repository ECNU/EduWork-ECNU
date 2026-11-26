import assert from 'node:assert/strict'
import test from 'node:test'
import { conversationEntries } from '../src/conversation-entries.js'

function fixture() {
  return {
    cloudRows: [
      { conversationID: 'cloud', title: '云端', updatedAt: 10, projectID: null },
      { conversationID: 'continued', title: '云端旧标题', updatedAt: 20, projectID: null },
      { conversationID: 'project-cloud', title: '项目云端', updatedAt: 25, projectID: 'p' },
    ],
    bindings: [{ conversationID: 'continued', sessionID: 'imported', workspaceID: 'extra', projectID: null }],
    workspaceBindings: [{ projectKey: 'notebook', workspaceID: 'project' }],
    workspaces: [
      { workspaceId: 'default', title: 'default-workspace', sessionIds: ['ordinary', 'blank', 'archived'] },
      { workspaceId: 'extra', title: '另一个工作区', sessionIds: ['imported', 'unrelated'] },
      { workspaceId: 'project', title: '项目工作区', sessionIds: ['project-local'] },
    ],
    sessions: { ordinary: { title: '普通本地', updatedAt: 30 }, blank: { blank: true }, archived: { title: '已归档', updatedAt: 100 }, imported: { title: '本地新标题', updatedAt: 50 }, unrelated: { title: '不相关', updatedAt: 80 }, 'project-local': { title: '项目本地', updatedAt: 40 } },
    archived: ['archived'],
  }
}
test('ordinary list merges only default-workspace chats and current-account continuations, using local titles and recency', () => {
  const entries = conversationEntries(fixture())
  assert.deepEqual(entries.map(row => [row.title, row.kind]), [['本地新标题', 'continued'], ['普通本地', 'local'], ['云端', 'cloud']])
  assert.equal(entries[0].cloud.title, '云端旧标题')
})
test('project list contains only its cloud conversations and bound workspace; imported duplicates collapse', () => {
  const input = fixture()
  input.bindings.push({ conversationID: 'project-cloud', sessionID: 'project-local', workspaceID: 'project', projectID: 'p' })
  const entries = conversationEntries({ ...input, project: { projectKey: 'notebook', projectID: 'p' } })
  assert.deepEqual(entries.map(row => [row.title, row.kind]), [['项目本地', 'continued']])
})
test('an unbound project does not borrow any local workspace and a legacy notebook can show its own bound local chats', () => {
  const input = fixture()
  assert.deepEqual(conversationEntries({ ...input, workspaceBindings: [], project: { projectKey: 'notebook', projectID: 'p' } }).map(row => row.kind), ['cloud'])
  assert.deepEqual(conversationEntries({ ...input, project: { projectKey: 'notebook', projectID: null } }).map(row => row.title), ['项目本地'])
})
test('missing or moved local continuations are not claimed as valid; archived continuations do not reappear as cloud duplicates', () => {
  const input = fixture()
  input.workspaces[1].sessionIds = ['unrelated']
  assert.equal(conversationEntries(input).find(row => row.cloud?.conversationID === 'continued').kind, 'cloud')
  input.archived.push('imported')
  assert(!conversationEntries(input).some(row => row.cloud?.conversationID === 'continued'))
})
test('a continuation outside the loaded cloud page remains visible once, while unrelated extra-workspace sessions stay out', () => {
  const input = fixture()
  input.cloudRows = []
  const entries = conversationEntries(input)
  assert.deepEqual(entries.map(row => row.title), ['本地新标题', '普通本地'])
})
test('a default workspace bound to a project is not mixed into ordinary local chats', () => {
  const input = fixture()
  input.workspaceBindings.push({ projectKey: 'other-project', workspaceID: 'default' })
  assert(!conversationEntries(input).some(row => row.sessionID === 'ordinary'))
})
