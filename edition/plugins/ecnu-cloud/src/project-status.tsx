import React from 'react'
import { IconGlobeOutlineRegular, IconLinkOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'

export function projectStatus(project: any, bindings: any[] = [], workspaces: any[] = []) {
  const binding = bindings.find(row => row.projectKey === project.projectKey)
  const workspace = workspaces.find(row => row.workspaceId === binding?.workspaceID)
  const title = workspace?.title === 'default-workspace' ? '默认工作区' : workspace?.title
  return {
    kind: binding ? 'linked' : 'cloud',
    label: workspace ? `已关联本地工作区「${title}」，可按需检索云端资料`
      : binding ? '已有关联记录，本地工作区暂不可用，请检查工作区'
        : project.projectID ? 'ChatECNU 云端项目，尚未关联本地工作区' : 'ChatECNU 云端资料库，尚未关联本地工作区',
  }
}

export function ProjectStatusIcon({ status, size = 18 }: any) {
  const Icon = status.kind === 'linked' ? IconLinkOutlineRegular : IconGlobeOutlineRegular
  return <Icon size={size} />
}
