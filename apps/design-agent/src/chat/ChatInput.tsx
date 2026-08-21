import { SendOutlined } from '@ant-design/icons';
import { Button, TextArea } from '@da/ui';
import type { TextAreaRef } from '@da/ui';
import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../stores/chatStore';
import GltfUploadButton from '../upload/GltfUploadButton';
import JsonUploadButton from '../upload/JsonUploadButton';
import { useSendMessage } from './useChatStream';

/**
 * 输入区：上传 JSON + 多行输入 + 发送。
 * 无消息时定位于内容区垂直居中（带欢迎标题）；有消息后样式保持不变、整体滑到面板底部。
 * 位置由 top/transform 过渡，居中/贴底间平滑滑动；欢迎标题随状态折叠展开。
 */
export function ChatInput({
  centered,
  onHeightChange,
}: {
  centered: boolean;
  /** 输入卡片区域（不含欢迎标题）的高度变化，父组件据此预留底部空间 */
  onHeightChange?: (height: number) => void;
}) {
  const [text, setText] = useState('');
  const { send } = useSendMessage();
  const streaming = useChatStore((s) =>
    s.activeSessionId ? s.assistantStatus[s.activeSessionId] === 'streaming' : false,
  );
  const textareaRef = useRef<TextAreaRef>(null);
  const blockRef = useRef<HTMLDivElement>(null);

  // 监听输入卡片高度（textarea 自动增高时更新），通知父组件调整消息列表底部占位
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
      <div className="px-4">
        <div className="mx-auto w-full max-w-3xl">
          {/* 欢迎标题：居中时展示，贴底后收起 */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              centered ? 'mb-5 max-h-32 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="text-center">
              <h2 className="text-xl font-medium text-gray-800">
                你好，我是你的 CAD 设计助手
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
                上传 JSON / GLB 文件，或直接描述你的设计需求
              </p>
            </div>
          </div>
          {/* 输入卡片：有消息时样式不变，仅整体滑到面板底部 */}
          <div ref={blockRef} className="flex flex-col gap-4">
            <div className="chat-input flex min-w-0 items-end gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-4 shadow-sm focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
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
                styles={{ textarea: { paddingTop: 10, paddingBottom: 10 } }}
                className="flex-1"
              />
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
            {/* 上传按钮：置于输入框下方，与输入框左对齐 */}
            <div className="flex gap-2">
              <JsonUploadButton />
              <GltfUploadButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
