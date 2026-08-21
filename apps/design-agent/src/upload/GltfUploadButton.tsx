import { UploadOutlined } from '@ant-design/icons';
import { Button, useMessage } from '@da/ui';
import { useRef } from 'react';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useCadStore } from '../stores/cadStore';
import { useViewerStore } from '../stores/viewerStore';

const loader = new GLTFLoader();

/** 上传 GLB → GLTFLoader 解析 → 写入 cadStore（画布切到 3D 视角展示） */
export default function GltfUploadButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const message = useMessage();

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith('.glb') && !name.endsWith('.gltf')) {
      message.error('请选择 .glb / .gltf 文件');
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      loader.parse(
        buffer,
        '',
        (gltf) => {
          let meshCount = 0;
          gltf.scene.traverse((o) => {
            if ((o as { isMesh?: boolean }).isMesh) meshCount++;
          });
          useCadStore.getState().setGltf(gltf.scene, file.name, { pending: true });
          useViewerStore.getState().viewer3d?.fitView();
          message.success(`已加载 ${file.name}（网格 ${meshCount} 个）`);
        },
        (err) => {
          message.error(
            `GLB 加载失败：${err instanceof Error ? err.message : '解析错误'}`,
          );
        },
      );
    } catch {
      message.error('GLB 读取失败，请确认是合法的二进制文件');
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      <Button icon={<UploadOutlined />} onClick={() => inputRef.current?.click()}>
        上传 GLB
      </Button>
    </>
  );
}
