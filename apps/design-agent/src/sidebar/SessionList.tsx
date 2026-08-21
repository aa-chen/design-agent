import { Button, Empty, Tooltip } from '@da/ui';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useChatStore } from '../stores/chatStore';
import { formatTime } from '../utils/time';

/** 左栏：会话历史列表（新建 / 切换 / 删除） */
export default function SessionList() {
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const createSession = useChatStore((s) => s.createSession);
  const switchSession = useChatStore((s) => s.switchSession);
  const deleteSession = useChatStore((s) => s.deleteSession);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between px-3">
        <span className="text-sm font-medium text-gray-700">会话历史</span>
        <Tooltip title="新建会话">
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={createSession}
          />
        </Tooltip>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {sessions.length === 0 ? (
          <Empty description="暂无会话" className="mt-10" />
        ) : (
          sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => switchSession(s.id)}
              className={`group mb-1 flex cursor-pointer items-center justify-between rounded-md border px-2.5 py-2 ${
                s.id === activeSessionId
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-transparent hover:bg-gray-100'
              }`}
            >
              <div className="min-w-0">
                <div className="truncate text-sm text-gray-800">{s.title}</div>
                <div className="mt-0.5 text-xs text-gray-400">{formatTime(s.updatedAt)}</div>
              </div>
              <button
                type="button"
                title="删除会话"
                className="invisible shrink-0 text-gray-400 transition-colors hover:text-red-500 group-hover:visible"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession(s.id);
                }}
              >
                <DeleteOutlined />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
