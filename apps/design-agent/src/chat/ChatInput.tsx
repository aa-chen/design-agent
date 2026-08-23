import { SendOutlined } from '@ant-design/icons';
import { Button, TextArea } from '@da/ui';
import type { TextAreaRef } from '@da/ui';
import { useEffect, useRef, useState } from 'react';
import { useCadStore } from '../stores/cadStore';
import { useChatStore } from '../stores/chatStore';
import GltfUploadButton from '../upload/GltfUploadButton';
import JsonUploadButton from '../upload/JsonUploadButton';
import { AttachmentChip } from './AttachmentChip';
import { useSendMessage } from './useChatStream';

/**
 * 输入区：多行输入 + 左下角上传 JSON/GLB + 右下角发送。
 * 无消息时定位于内容区垂直居中（带欢迎标题）；有消息后样式保持不变、整体滑到面板底部。
 * 位置由 top/transform 过渡，居中/贴底间平滑滑动；欢迎标题随状态折叠展开。
 */
export function ChatInput({
  centered,
  canvasOpen,
  onHeightChange,
}: {
  centered: boolean;
  canvasOpen: boolean;
  /** 输入卡片区域（不含欢迎标题）的高度变化，父组件据此预留底部空间 */
  onHeightChange?: (height: number) => void;
}) {
  const [text, setText] = useState('');
  const { send } = useSendMessage();
  const streaming = useChatStore((s) =>
    s.activeSessionId ? s.assistantStatus[s.activeSessionId] === 'streaming' : false,
  );
  const pendingJson = useCadStore((s) => s.pendingJson);
  const pendingGltf = useCadStore((s) => s.pendingGltf);
  const clearPendingJson = useCadStore((s) => s.clearPendingJson);
  const clearPendingGltf = useCadStore((s) => s.clearPendingGltf);
  const textareaRef = useRef<TextAreaRef>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const hasPending = !!(pendingJson || pendingGltf);

  // 监听输入卡片高度（textarea 自动增高 / 附件芯片增减时更新），通知父组件调整消息列表底部占位
  useEffect(() => {
    const el = blockRef.current;
    if (!el || !onHeightChange) return;
    const report = () => onHeightChange(el.getBoundingClientRect().height);
    const observer = new ResizeObserver(report);
    observer.observe(el);
    report();
    return () => observer.disconnect();
  }, [onHeightChange]);

  const submit = () => {
    if (!text.trim()) return;
    send(text);
    setText('');
    textareaRef.current?.focus();
  };

  return (
    <div
      className="absolute inset-x-0 z-10 transition-[top,transform] duration-500 ease-in-out"
      style={{
        top: centered ? '50%' : '100%',
        transform: centered ? 'translateY(-50%)' : 'translateY(-100%)',
      }}
    >
      <div className={`transition-[padding] duration-300 ease-out ${canvasOpen ? 'px-4 pr-6' : 'px-4'}`}>
        <div className="mx-auto w-full max-w-3xl">
          {/* 欢迎标题：居中时展示，贴底后收起 */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              centered ? 'mb-5 max-h-32 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="text-center">
              <h2 className="text-xl font-medium text-[var(--text-primary)]">
                你好，我是你的 CAD 设计助手
              </h2>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                上传 JSON / GLB 文件，或直接描述你的设计需求
              </p>
            </div>
          </div>
          {/* 输入卡片：贴底时预留底部间距，避免贴边 */}
          <div ref={blockRef} className={centered ? undefined : 'pb-4'}>
            <div className="chat-input flex min-w-0 flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 shadow-sm focus-within:border-[var(--border-strong)] focus-within:ring-4 focus-within:ring-[var(--focus-ring)]">
              {hasPending && (
                <div className="flex flex-wrap gap-2">
                  {pendingJson && (
                    <AttachmentChip
                      name={pendingJson}
                      kind="json"
                      onRemove={clearPendingJson}
                    />
                  )}
                  {pendingGltf && (
                    <AttachmentChip
                      name={pendingGltf}
                      kind="glb"
                      onRemove={clearPendingGltf}
                    />
                  )}
                </div>
              )}
              <TextArea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPressEnter={(e) => {
                  if (!e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                autoSize={{ minRows: 3, maxRows: 8 }}
                variant="borderless"
                styles={{ textarea: { paddingTop: 4, paddingBottom: 4 } }}
                className="flex-1"
              />
              {/* 底栏：上传在左下角，发送在右下角 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <JsonUploadButton />
                  <GltfUploadButton />
                </div>
                <Button
                  type="primary"
                  shape="circle"
                  size="large"
                  icon={<SendOutlined />}
                  aria-label="发送"
                  onClick={submit}
                  disabled={!text.trim() || streaming}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
