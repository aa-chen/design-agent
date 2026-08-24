import type { Material, Object3D } from 'three';

/** 递归释放对象组内的几何体、材质与纹理。 */
export function disposeObjectGroup(group: Object3D) {
  group.traverse((obj) => {
    const geometry = (obj as { geometry?: { dispose: () => void } }).geometry;
    geometry?.dispose();
    const material = (obj as { material?: Material | Material[] }).material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of materials) {
      const map = (m as { map?: { dispose: () => void } }).map;
      map?.dispose();
      m.dispose();
    }
  });
}
