import { useCallback, useState } from 'react';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import { useChatStore } from '../stores/chatStore';

/** 中栏：AI 对话面板（消息列表 + 输入区）。
 * 消息滚动区占满输入框以上空间；输入框绝对定位在底部，下方占位避免遮挡对话。 */
export default function ChatPanel() {
  const hasMessages = useChatStore((s) =>
    s.activeSessionId ? (s.messagesBySession[s.activeSessionId] ?? []).length > 0 : false,
  );
  // 输入卡片高度：有消息时在底部预留同高空间，消息区不延伸到输入框下方
  const [inputHeight, setInputHeight] = useState(0);
  const onHeightChange = useCallback((height: number) => setInputHeight(height), []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center border-b border-gray-200 px-4">
        <span className="text-sm font-medium text-gray-700">AI 对话</span>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1">
          <MessageList />
        </div>
        <div
          className="shrink-0 transition-all duration-500 ease-in-out"
          style={{ height: hasMessages ? inputHeight : 0 }}
        />
        <ChatInput centered={!hasMessages} onHeightChange={onHeightChange} />
      </div>
    </div>
  );
}
