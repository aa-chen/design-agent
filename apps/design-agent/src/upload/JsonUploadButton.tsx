import { isCadBundle, parseCadModel } from '@da/cad-core';
import { UploadOutlined } from '@ant-design/icons';
import { Button, useMessage } from '@da/ui';
import { useRef } from 'react';
import { useCadStore } from '../stores/cadStore';
import { useViewerStore } from '../stores/viewerStore';

/** 上传 JSON → CadViewer 识别格式 → 写入 cadStore（画布据此展示） */
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

    const viewer = useViewerStore.getState().viewer2d;
    const isIdocLike =
      isCadBundle(json) ||
      (typeof json === 'object' &&
        json !== null &&
        (json as { fileExtension?: string }).fileExtension === 'pm' &&
        Array.isArray((json as { doc?: unknown[] }).doc));

    if (!viewer) {
      if (isIdocLike) {
        useCadStore.getState().setDocMeta(file.name, { pending: true }, json);
        useCadStore.getState().openCanvas();
        message.success(`已加载 ${file.name}（idoc / bundle）`);
        return;
      }
      const parsed = parseCadModel(json);
      if (parsed.ok) {
        useCadStore.getState().setModel(parsed.data, file.name, { pending: true });
        message.success(`已加载 ${file.name}（cad-model）`);
        return;
      }
      message.error('画布未就绪');
      return;
    }

    const result = await viewer.load(json);
    if (!result.ok) {
      message.error(result.error);
      return;
    }
    if (result.format === 'cad-model') {
      const parsed = parseCadModel(json);
      if (parsed.ok) useCadStore.getState().setModel(parsed.data, file.name, { pending: true });
    } else {
      useCadStore.getState().setDocMeta(
        file.name,
        { pending: true, elementCount: result.meta.elementCount },
        json,
      );
      useCadStore.getState().openCanvas();
    }
    viewer.fitView();
    message.success(`已加载 ${file.name}（${result.format}）`);
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
