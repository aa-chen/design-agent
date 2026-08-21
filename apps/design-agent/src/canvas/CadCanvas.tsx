import { samples } from '@da/cad-core';
import { Button, Select, Tag, Tooltip } from '@da/ui';
import { useEffect, useRef } from 'react';
import { useCadStore } from '../stores/cadStore';
import { useViewerStore } from '../stores/viewerStore';
import { CadViewer } from './CadViewer';
import PropertyPanel from './PropertyPanel';

/** 右栏：CAD 画布（three.js 渲染 + 平移缩放 + 点击选中 + 属性面板） */
export default function CadCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const model = useCadStore((s) => s.model);
  const fileName = useCadStore((s) => s.fileName);
  const gltfScene = useCadStore((s) => s.gltfScene);
  const gltfFileName = useCadStore((s) => s.gltfFileName);
  const selectedId = useCadStore((s) => s.selectedId);
  const select = useCadStore((s) => s.select);

  // 挂载渲染器
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const viewer = new CadViewer({ container, onSelect: (id) => select(id) });
    useViewerStore.getState().register(viewer);
    return () => {
      useViewerStore.getState().unregister(viewer);
      viewer.dispose();
    };
  }, [select]);

  // 模型变化 -> 重建场景 + 适配视图（CAD 2D / GLB 3D 互斥）
  useEffect(() => {
    const viewer = useViewerStore.getState().viewer;
    if (!viewer) return;
    if (model) {
      viewer.setModel(model);
      viewer.fitView();
    } else if (gltfScene) {
      viewer.setGltf(gltfScene);
      viewer.fitView();
    } else {
      viewer.clearModel();
    }
  }, [model, gltfScene]);

  // 选中变化 -> 高亮
  useEffect(() => {
    useViewerStore.getState().viewer?.setSelected(selectedId);
  }, [selectedId]);

  const loadSample = (name: string) => {
    const sample = samples.find((s) => s.name === name);
    if (!sample) return;
    useCadStore.getState().setModel(sample, `${sample.name}.json`);
    useViewerStore.getState().viewer?.fitView();
  };
  const fitView = () => useViewerStore.getState().viewer?.fitView();
  const clear = () => useCadStore.getState().clearModel();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium text-gray-700">CAD 画布</span>
          {gltfFileName ? (
            <Tag color="green" className="max-w-40 truncate">
              {gltfFileName}
            </Tag>
          ) : fileName ? (
            <Tag color="blue" className="max-w-40 truncate">
              {fileName}
            </Tag>
          ) : (
            <Tag>未加载模型</Tag>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!gltfScene && (
            <Select
              size="small"
              placeholder="示例模型"
              allowClear
              style={{ width: 110 }}
              options={samples.map((s) => ({ label: s.name, value: s.name }))}
              onChange={(name) => {
                if (typeof name === 'string') loadSample(name);
              }}
            />
          )}
          <Tooltip title="按模型包围盒适配视图">
            <Button size="small" disabled={!model} onClick={fitView}>
              适配
            </Button>
          </Tooltip>
          <Tooltip title="清空画布">
            <Button size="small" danger disabled={!model} onClick={clear}>
              清空
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* 画布容器：CadCanvas 仅在 model 存在时挂载，故无需空态占位 */}
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-hidden" />

      <PropertyPanel />
    </div>
  );
}
