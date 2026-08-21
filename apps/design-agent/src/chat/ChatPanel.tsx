import { useCallback, useState } from 'react';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import { useChatStore } from '../stores/chatStore';

/** 中栏：AI 对话面板（消息列表 + 输入区）。
 * 无消息时输入区居中展示；有消息后输入区滑到底部，消息列表在其上方独立滚动。 */
export default function ChatPanel() {
  const hasMessages = useChatStore((s) =>
    s.activeSessionId ? (s.messagesBySession[s.activeSessionId] ?? []).length > 0 : false,
  );
  // 输入卡片高度：有消息时在消息列表底部预留同高空间，避免消息滚入输入区
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
        {/* 输入区占位：有消息时输入卡片贴底，消息列表在其上方滚动 */}
        <div
          className="shrink-0 transition-all duration-500 ease-in-out"
          style={{ height: hasMessages ? inputHeight : 0 }}
        />
        <ChatInput centered={!hasMessages} onHeightChange={onHeightChange} />
      </div>
    </div>
  );
}
