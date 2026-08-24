import { parseCadModel } from '@da/cad-core';
import { UploadOutlined } from '@ant-design/icons';
import { Button, useMessage } from '@da/ui';
import { useRef } from 'react';
import { useCadStore } from '../stores/cadStore';

/** 上传 JSON → 解析为 CadModel，作为聊天附件（当前不在画布渲染） */
export default function JsonUploadButton({ disabled = false }: { disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const message = useMessage();

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      message.error('请选择 .json 文件');
      return;
    }
    const text = await file.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      message.error('JSON 解析失败，请确认是合法的 JSON 文件');
      return;
    }
    if (!json || typeof json !== 'object') {
      message.error('JSON 解析失败，请确认是合法的 JSON 文件');
      return;
    }

    const parsed = parseCadModel(json);
    if (!parsed.ok) {
      message.error(parsed.errors[0] ?? '无法识别该 JSON');
      return;
    }
    useCadStore.getState().setModel(parsed.data, file.name, { pending: true });
    message.success(`已附加 ${file.name}`);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      <Button
        size="small"
        icon={<UploadOutlined />}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        上传 JSON
      </Button>
    </>
  );
}
