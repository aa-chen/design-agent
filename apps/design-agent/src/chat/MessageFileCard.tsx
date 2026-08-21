import { FileOutlined } from '@ant-design/icons';
import type { ChatAttachment } from '../sse/types';
import { useCadStore } from '../stores/cadStore';

/** 消息下方的文件卡片：点击打开 / 恢复画布 */
export function MessageFileCard({ attachment }: { attachment: ChatAttachment }) {
  const open = () => {
    const cad = useCadStore.getState();
    if (attachment.kind === 'json' && attachment.model) {
      cad.setModel(attachment.model, attachment.name, { pending: false });
    }
    cad.openCanvas();
  };

  return (
    <button
      type="button"
      onClick={open}
      className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      <FileOutlined
        className={attachment.kind === 'json' ? 'text-blue-500' : 'text-green-600'}
      />
      <span className="min-w-0 truncate font-medium">{attachment.name}</span>
      <span className="shrink-0 text-gray-400">
        {attachment.kind === 'json' ? 'JSON' : 'GLB'} · 打开画布
      </span>
    </button>
  );
}
