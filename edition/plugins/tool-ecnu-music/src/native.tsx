import React, { useMemo } from 'react'
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path'
import remote from '../lib/typert.remote-client.js'
import { MusicStudioView } from './Studio'

export const inject = ['slots', 'remote']
async function unwrap(promise: Promise<any>) {
  const result = await promise
  if (!result?.ok) throw Error(result?.error?.message || '音乐工作室暂时无法连接 Host')
  return JSON.parse(result.value)
}
function SidebarMusic(props: any) {
  const { tab } = props.useTabInfo()
  const adapter = useMemo(() => ({
    execute: (action: string, args = {}) => unwrap(props.service.execute(props.sessionId, action, JSON.stringify(args))),
    preview: (path: string) => unwrap(props.service.preview(props.sessionId, path)),
    openFile: async (path: string) => props.sidebar.openResource(sessionFileAddress(props.sessionId, path)),
  }), [props.service, props.sessionId, props.sidebar])
  // The owning tab's session, never the globally selected conversation.
  return <MusicStudioView key={props.sessionId} adapter={adapter} active={tab.visible && !tab.signal.aborted}/>
}
export async function apply(ctx: any) {
  const unmount = await ctx.remote.$mount(remote)
  ctx.inject(['remote.ecnuMusicStudio', 'sidebarRight', 'sidebarRightTabs'], (inner: any) => {
    const disposers = [
      inner.sidebarRightTabs.register({ id: '@chatecnu-work/dsh-tool-ecnu-music', kind: 'ecnu-music-studio', title: () => '音乐工作室',
        guide: [{ order: 40, title: () => 'Music Studio', description: () => '创作音乐、试听候选版本、查看与修改 ABC 乐谱。' }] }),
      inner.slots.inject('sidebar.right.pane.tab', () => inner.slots.register({ name: 'sidebar.right.pane.tab', key: '@chatecnu-work/dsh-tool-ecnu-music',
        inject: () => ({ service: inner.remote.ecnuMusicStudio, sidebar: inner.sidebarRight }) }, SidebarMusic)),
    ]
    inner.effect(() => () => { for (const dispose of disposers.reverse()) dispose?.() })
  })
  return () => unmount()
}
