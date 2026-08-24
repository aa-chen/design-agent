import { CloseOutlined } from '@ant-design/icons';
import { Button, Tag, Tooltip } from '@da/ui';
import { useEffect, useRef } from 'react';
import { useCadStore } from '../stores/cadStore';
import { useThemeStore } from '../stores/themeStore';
import { useViewerStore } from '../stores/viewerStore';
import { Cad3DViewer } from './Cad3DViewer';

/** 右栏：CAD 画布。当前仅渲染 3D GLB 模型。 */
export default function CadCanvas() {
  const container3dRef = useRef<HTMLDivElement>(null);
  const gltfScene = useCadStore((s) => s.gltfScene);
  const gltfFileName = useCadStore((s) => s.gltfFileName);
  const themeMode = useThemeStore((s) => s.mode);

  useEffect(() => {
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--scene-bg').trim();
    if (!bg) return;
    useViewerStore.getState().viewer3d?.setBackground(bg);
  }, [themeMode]);

  useEffect(() => {
    const el3d = container3dRef.current;
    if (!el3d) return;
    const viewer3d = new Cad3DViewer(el3d);
    useViewerStore.getState().register3d(viewer3d);
    return () => {
      useViewerStore.getState().unregister3d(viewer3d);
      viewer3d.dispose();
    };
  }, []);

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

  const has3d = !!gltfScene;
  const fitView = () => useViewerStore.getState().viewer3d?.fitView();
  const clear = () => useCadStore.getState().clearGltf();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">CAD 画布</span>
          {!has3d ? (
            <Tag>未加载模型</Tag>
          ) : (
            gltfFileName && (
              <Tag color="green" className="max-w-40 truncate">
                3D · {gltfFileName}
              </Tag>
            )
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip title="按当前模型适配视图">
            <Button size="small" disabled={!has3d} onClick={fitView}>
              适配
            </Button>
          </Tooltip>
          <Tooltip title="清空画布">
            <Button size="small" danger disabled={!has3d} onClick={clear}>
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

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={container3dRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
