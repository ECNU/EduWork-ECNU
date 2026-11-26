import React, { useMemo } from 'react'
import { MarkdownText, MarkdownDelegateProvider, UserMessageBubble } from '@deepseek-ai/dsh-client-ui-primitives'
import { fromMarkdown } from 'mdast-util-from-markdown'
const labels = { code: { copyLabel: '复制代码', copiedLabel: '已复制' }, footnotes: '注释' }
export function withoutImages(text: string) {
  const ranges: { start: number, end: number }[] = []
  const visit = (node: any) => {
    if (['image', 'imageReference'].includes(node.type)) ranges.push({ start: node.position.start.offset, end: node.position.end.offset })
    else node.children?.forEach(visit)
  }
  visit(fromMarkdown(text))
  for (const range of ranges.sort((a, b) => b.start - a.start)) text = text.slice(0, range.start) + '〔图片未加载〕' + text.slice(range.end)
  return text
}
export function ReadOnlyMarkdown({ text }: { text: string }) {
  const safe = useMemo(() => withoutImages(text), [text])
  return <MarkdownDelegateProvider><MarkdownText text={safe} labels={labels} /></MarkdownDelegateProvider>
}
export function Transcript({ preview }: any) {
  return <div className="ecnu-transcript" aria-label="云端会话预览">
    <div className="ecnu-history-start">来自 ChatECNU · {preview.total} 条消息</div>
    {preview.messages.map((message: any) => <article key={message.messageID} className={`ecnu-message ecnu-message-${message.role}`} aria-label={message.role === 'user' ? '你的消息' : 'ChatECNU 的回答'}>
      {message.role === 'user' ? <UserMessageBubble><div className="ecnu-user-text">{message.text}</div></UserMessageBubble>
        : <><div className="ecnu-message-label">ChatECNU</div><ReadOnlyMarkdown text={message.text} /></>}
    </article>)}
    {!preview.messages.length && <div className="ecnu-empty">这段会话还没有消息</div>}
    {!preview.importable && <p className="ecnu-notice">这段历史包含暂不支持导入的内容，可以先在这里阅读。</p>}
  </div>
}
