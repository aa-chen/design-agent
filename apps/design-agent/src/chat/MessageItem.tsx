import { Tag } from '@da/ui';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage } from '../sse/types';

/** 单条聊天消息。assistant 消息用 Markdown 渲染并带流式光标。 */
export function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`mb-3 flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-blue-500 text-white'
            : 'border border-gray-200 bg-white text-gray-800'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap break-words text-sm">{message.content}</div>
        ) : (
          <div className="md-body text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            {message.streaming && message.content === '' && (
              <span className="animate-pulse text-gray-400">正在思考…</span>
            )}
            {message.streaming && message.content !== '' && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-gray-400 align-text-bottom" />
            )}
            {message.error && (
              <div className="mt-2">
                <Tag color="red">{message.error}</Tag>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
