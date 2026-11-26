import React from 'react'
import { Tooltip, IconGlobeOutlineRegular, IconFolderOpenOutlineRegular, IconChevronRightOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'

export function ConversationRow({ entry, compact = false, selected = false, open, original }: any) {
  const Icon = entry.kind === 'cloud' ? IconGlobeOutlineRegular : IconFolderOpenOutlineRegular
  return <div className={compact ? 'ecnu-nav-chat' : 'ecnu-conversation-row'} data-conversation-kind={entry.kind} data-conversation-key={entry.key}>
    <Tooltip label={entry.hint} side={compact ? 'right' : 'top'} delayMs={350} portal>
      <button type="button" className={compact ? 'ecnu-nav-row' : 'ecnu-row'} aria-label={entry.title} aria-current={selected ? 'page' : undefined} onClick={() => open(entry)}>
        <Icon size={compact ? 14 : 17} />
        {compact ? <span className="ecnu-nav-label">{entry.title}</span> : <>
          <span className="ecnu-row-body"><span className="ecnu-row-title">{entry.title}</span>{entry.workspaceTitle && <span className="ecnu-row-meta">{entry.workspaceTitle}</span>}</span>
          <span className="ecnu-row-end">{entry.updatedAt > 0 && <span className="ecnu-date">{new Date(entry.updatedAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</span>}<IconChevronRightOutlineRegular size={15} /></span>
        </>}
      </button>
    </Tooltip>
    {entry.kind === 'continued' ? <Tooltip label={`查看 ${entry.cloud.title} 的云端原会话`} side={compact ? 'right' : 'top'} delayMs={350} portal>
      <button type="button" className="ecnu-cloud-icon ecnu-conversation-origin" aria-label={`查看 ${entry.cloud.title} 的云端原会话`} onClick={() => original(entry.cloud)}><IconGlobeOutlineRegular size={14} /></button>
    </Tooltip> : !compact && <span className="ecnu-conversation-origin" aria-hidden="true" />}
  </div>
}
