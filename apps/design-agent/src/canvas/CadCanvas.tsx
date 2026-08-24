import { samples } from '@da/cad-core';
import { CloseOutlined } from '@ant-design/icons';
import { Button, Select, Tag, Tooltip } from '@da/ui';
import { useEffect, useRef, useState } from 'react';
import { useCadStore } from '../stores/cadStore';
import { useThemeStore } from '../stores/themeStore';
import { useViewerStore } from '../stores/viewerStore';
import { Cad2DViewer } from './Cad2DViewer';
import { Cad3DViewer } from './Cad3DViewer';
import PropertyPanel from './PropertyPanel';

type ViewTab = '2d' | '3d';

/** 右栏：CAD 画布。2D 图纸与 3D 模型各自持有独立渲染器并常驻，通过选项卡切换显示。 */
export default function CadCanvas() {
  const container2dRef = useRef<HTMLDivElement>(null);
  const container3dRef = useRef<HTMLDivElement>(null);
  const model = useCadStore((s) => s.model);
  const fileName = useCadStore((s) => s.fileName);
  const gltfScene = useCadStore((s) => s.gltfScene);
  const gltfFileName = useCadStore((s) => s.gltfFileName);
  const selectedId = useCadStore((s) => s.selectedId);
  const select = useCadStore((s) => s.select);
  const [tab, setTab] = useState<ViewTab>('2d');
  const themeMode = useThemeStore((s) => s.mode);

  // 主题切换时同步 3D/2D 场景背景色
  useEffect(() => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--scene-bg').trim();
    if (!bg) return;
    useViewerStore.getState().viewer2d?.setBackground(bg);
    useViewerStore.getState().viewer3d?.setBackground(bg);
  }, [themeMode]);

  // 挂载 2D / 3D 两个渲染器（常驻，切换选项卡不销毁，各自视图状态保留）
  useEffect(() => {
    const el2d = container2dRef.current;
    const el3d = container3dRef.current;
    if (!el2d || !el3d) return;
    const viewer2d = new Cad2DViewer({ container: el2d, onSelect: (id) => select(id) });
    const viewer3d = new Cad3DViewer(el3d);
    useViewerStore.getState().register2d(viewer2d);
    useViewerStore.getState().register3d(viewer3d);
    return () => {
      useViewerStore.getState().unregister2d(viewer2d);
      useViewerStore.getState().unregister3d(viewer3d);
      viewer2d.dispose();
      viewer3d.dispose();
    };
  }, [select]);

  // 2D 模型变化 -> 重建 2D 场景 + 适配视图
  useEffect(() => {
    const viewer = useViewerStore.getState().viewer2d;
    if (!viewer) return;
    if (model) {
      viewer.setModel(model);
      viewer.fitView();
    } else {
      viewer.clearModel();
    }
  }, [model]);

  // 3D 模型变化 -> 重建 3D 场景 + 适配视图
  useEffect(() => {
    const viewer = useViewerStore.getState().viewer3d;
    if (!viewer) return;
    if (gltfScene) {
      viewer.setGltf(gltfScene);
      viewer.fitView();
    } else {
      viewer.clearModel();
    }
  }, [gltfScene]);

  // 选中变化 -> 2D 高亮
  useEffect(() => {
    useViewerStore.getState().viewer2d?.setSelected(selectedId);
  }, [selectedId]);

  const has2d = !!model;
  const has3d = !!gltfScene;
  const hasAnyModel = has2d || has3d;
  const showViewSwitch = has2d && has3d;

  // 新加载模型时自动切到对应选项卡（仅加载时切换，清空时不强制）
  useEffect(() => {
    if (fileName) setTab('2d');
  }, [fileName]);
  useEffect(() => {
    if (gltfFileName) setTab('3d');
  }, [gltfFileName]);

  // 仅有一种模型时自动切到可用视图
  useEffect(() => {
    if (has2d && !has3d) setTab('2d');
    else if (!has2d && has3d) setTab('3d');
  }, [has2d, has3d]);

  const loadSample = (name: string) => {
    const sample = samples.find((s) => s.name === name);
    if (!sample) return;
    useCadStore.getState().setModel(sample, `${sample.name}.json`);
    useViewerStore.getState().viewer2d?.fitView();
  };
  const fitView = () => {
    if (tab === '2d') useViewerStore.getState().viewer2d?.fitView();
    else useViewerStore.getState().viewer3d?.fitView();
  };
  const clear = () => useCadStore.getState().clearModel();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">CAD 画布</span>
          {!hasAnyModel ? (
            <Tag>未加载模型</Tag>
          ) : (
            <>
              {fileName && (
                <Tag color="blue" className="max-w-40 truncate">
                  2D · {fileName}
                </Tag>
              )}
              {gltfFileName && (
                <Tag color="green" className="max-w-40 truncate">
                  3D · {gltfFileName}
                </Tag>
              )}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
          <Tooltip title="按当前视图模型适配">
            <Button size="small" disabled={!hasAnyModel} onClick={fitView}>
              适配
            </Button>
          </Tooltip>
          <Tooltip title="清空画布">
            <Button size="small" danger disabled={!hasAnyModel} onClick={clear}>
              清空
            </Button>
          </Tooltip>
          <Tooltip title="关闭画布">
            <Button
              size="small"
              type="text"
              icon={<CloseOutlined />}
              aria-label="关闭画布"
              onClick={() => useCadStore.getState().closeCanvas()}
            />
          </Tooltip>
        </div>
      </div>

      {/* 2D / 3D 同时存在时显示分段切换；渲染器常驻，切换仅控制显隐 */}
      {showViewSwitch && (
        <div className="flex shrink-0 items-center border-b border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5">
          <div
            className="inline-flex rounded-md border border-[var(--border)] bg-[var(--bg-muted)] p-0.5"
            role="tablist"
            aria-label="视图切换"
          >
            {(
              [
                { key: '2d', label: '2D 视图' },
                { key: '3d', label: '3D 视图' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 画布容器：两个渲染器叠放，隐藏的用 visibility 隐藏以保持尺寸（clientWidth 不塌缩） */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={container2dRef}
          className={`absolute inset-0 ${tab === '2d' ? '' : 'invisible pointer-events-none'}`}
        />
        <div
          ref={container3dRef}
          className={`absolute inset-0 ${tab === '3d' ? '' : 'invisible pointer-events-none'}`}
        />
      </div>

      <PropertyPanel />
    </div>
  );
}
