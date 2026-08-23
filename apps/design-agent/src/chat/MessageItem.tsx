import { Tag } from "@da/ui";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../sse/types";
import { useChatStore } from "../stores/chatStore";
import { MessageFileCard } from "./MessageFileCard";

/** 单条聊天消息。assistant 消息用 Markdown 渲染并带流式光标。 */
export function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const attachments = message.attachments ?? [];
  const awaitingHitl = useChatStore((s) =>
    s.activeSessionId
      ? s.assistantStatus[s.activeSessionId] === "awaiting-hitl"
      : false,
  );

  return (
    <div className={`mb-3 flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex max-w-[85%] flex-col ${isUser ? "items-end" : "items-start"}`}
      >
        <div
          className={`rounded-lg px-3 py-2 ${
            isUser
              ? "bg-[var(--accent)] text-[var(--accent-fg)]"
              : "border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap break-words text-sm">
              {message.content}
            </div>
          ) : (
            <div className="md-body text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
              {message.streaming && message.content === "" && (
                <span className="animate-pulse text-[var(--text-muted)]">
                  {awaitingHitl ? "等待你确认…" : "正在思考…"}
                </span>
              )}
              {message.streaming && message.content !== "" && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-[var(--text-muted)] align-text-bottom" />
              )}
              {message.error && (
                <div className="mt-2">
                  <Tag color="red">{message.error}</Tag>
                </div>
              )}
            </div>
          )}
        </div>
        {attachments.length > 0 && (
          <div
            className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
          >
            {attachments.map((att) => (
              <MessageFileCard key={att.id} attachment={att} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
