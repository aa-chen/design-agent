import { parseCadModel } from '@da/cad-core';
import { UploadOutlined } from '@ant-design/icons';
import { Button, useMessage } from '@da/ui';
import { useRef } from 'react';
import { useCadStore } from '../stores/cadStore';
import { useViewerStore } from '../stores/viewerStore';

/** 上传 JSON → zod 校验 → 写入 cadStore（画布据此重建场景） */
export default function JsonUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const message = useMessage();

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.json')) {
      message.error('请选择 .json 文件');
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCadModel(JSON.parse(text));
      if (!parsed.ok) {
        message.error(`JSON 校验失败：${parsed.errors.slice(0, 3).join('；')}`);
        return;
      }
      useCadStore.getState().setModel(parsed.data, file.name, { pending: true });
      useViewerStore.getState().viewer2d?.fitView();
      message.success(`已加载 ${file.name}（元素 ${parsed.data.elements.length} 个）`);
    } catch {
      message.error('JSON 解析失败，请确认是合法的 JSON 文件');
    }
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
      <Button icon={<UploadOutlined />} onClick={() => inputRef.current?.click()}>
        上传 JSON
      </Button>
    </>
  );
}
