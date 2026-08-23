import { ScrollArea } from '@da/ui';
import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../sse/types';
import { useChatStore } from '../stores/chatStore';
import { MessageItem } from './MessageItem';

// 空消息列表的稳定引用：选择器每次返回新数组会触发 useSyncExternalStore 无限重渲染
const EMPTY_MESSAGES: ChatMessage[] = [];

/**
 * 消息列表：占满输入框以上区域，自动滚动到底部（流式更新时跟随）。
 * 无消息时返回 null —— 引导文案由居中展示的欢迎标题与输入框承担。
 */
export function MessageList({ canvasOpen }: { canvasOpen: boolean }) {
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const messages = useChatStore((s) =>
    s.activeSessionId
      ? (s.messagesBySession[s.activeSessionId] ?? EMPTY_MESSAGES)
      : EMPTY_MESSAGES,
  );
  const endRef = useRef<HTMLDivElement>(null);
  const lastContent = messages[messages.length - 1]?.content ?? '';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, lastContent]);

  if (!activeSessionId || messages.length === 0) return null;

  return (
    <ScrollArea className="h-full">
      <div className={`pb-4 pt-4 transition-[padding] duration-300 ease-out ${canvasOpen ? 'px-4 pr-6' : 'px-4'}`}>
        {messages.map((m) => (
          <MessageItem key={m.id} message={m} />
        ))}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  );
}
