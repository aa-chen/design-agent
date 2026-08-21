import type { CadModel } from '@da/cad-core';
import * as THREE from 'three';
import { buildScene, HIGHLIGHT_COLOR } from './buildScene';
import { RenderingViewer } from './RenderingViewer';
import { disposeObjectGroup } from './threeUtils';

export interface Cad2DViewerOptions {
  container: HTMLElement;
  /** 拾取结果回调：返回命中的元素 id 或 null */
  onSelect: (id: string | null) => void;
}

const CAMERA_Z = 1000;
const INITIAL_SCALE = 0.5; // 世界单位 / 像素
const MIN_SCALE = 0.0005;
const MAX_SCALE = 50;
const DRAG_THRESHOLD_PX = 4;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/**
 * 2D 渲染器：CAD 图纸，正交相机从 +Z 俯视 XY 平面。
 * 平移 / 缩放 / 拾取选中均为 2D 专属交互；GLB 3D 渲染见 Cad3DViewer。
 * 命令式生命周期，由 React 组件挂载/销毁。
 */
export class Cad2DViewer extends RenderingViewer {
  private readonly onSelect: (id: string | null) => void;
  private readonly camera: THREE.OrthographicCamera;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private group: THREE.Group | null = null;
  private pickables = new Map<string, THREE.Object3D>();

  private scale = INITIAL_SCALE;
  private viewX = 0;
  private viewY = 0;

  private selectedId: string | null = null;

  private dragging = false;
  private pointerDownPos = { x: 0, y: 0 };
  private lastPointer = { x: 0, y: 0 };

  private readonly onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.dragging = false;
    this.container.setPointerCapture?.(e.pointerId);
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) {
      const dist = Math.hypot(
        e.clientX - this.pointerDownPos.x,
        e.clientY - this.pointerDownPos.y,
      );
      if (dist < DRAG_THRESHOLD_PX) return;
      this.dragging = true;
    }
    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    this.viewX -= dx * this.scale;
    this.viewY += dy * this.scale;
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.updateFrustum();
  };

  private readonly onPointerUp = (e: PointerEvent) => {
    if (!this.dragging) this.pick(e);
    this.dragging = false;
  };

  private readonly onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.renderer.domElement.getBoundingClientRect();
    const before = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const factor = Math.exp(e.deltaY * 0.0015);
    this.scale = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE);
    this.updateFrustum();
    const after = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    this.viewX += before.x - after.x;
    this.viewY += before.y - after.y;
    this.updateFrustum();
  };

  constructor({ container, onSelect }: Cad2DViewerOptions) {
    super(container);
    this.onSelect = onSelect;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, CAMERA_Z * 2);
    this.camera.position.set(0, 0, CAMERA_Z);
    this.camera.lookAt(0, 0, 0);
    this.activeCamera = this.camera;

    this.addGrid();
    this.updateFrustum();

    container.addEventListener('pointerdown', this.onPointerDown);
    container.addEventListener('pointermove', this.onPointerMove);
    container.addEventListener('pointerup', this.onPointerUp);
    container.addEventListener('pointerleave', this.onPointerUp);
    container.addEventListener('wheel', this.onWheel, { passive: false });

    this.loop();
  }

  protected updateCameraForSize(_w: number, _h: number) {
    this.updateFrustum();
  }

  private addGrid() {
    const grid = new THREE.GridHelper(2000, 40, 0x0f172a, 0x0f172a);
    grid.rotation.x = Math.PI / 2;
    const mat = grid.material as THREE.Material;
    mat.opacity = 0.1;
    mat.transparent = true;
    this.scene.add(grid);
  }

  /** 根据 view 中心与 zoom 更新正交相机视锥 */
  private updateFrustum() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const halfW = (w / 2) * this.scale;
    const halfH = (h / 2) * this.scale;
    this.camera.left = this.viewX - halfW;
    this.camera.right = this.viewX + halfW;
    this.camera.top = this.viewY + halfH;
    this.camera.bottom = this.viewY - halfH;
    this.camera.updateProjectionMatrix();
    // 线段拾取阈值约为 6px 对应的世界距离
    this.raycaster.params.Line.threshold = Math.max(6 * this.scale, 0.001);
    this.requestRender();
  }

  private screenToWorld(px: number, py: number) {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    return {
      x: this.viewX + (px - w / 2) * this.scale,
      y: this.viewY + (h / 2 - py) * this.scale,
    };
  }

  private pick(e: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [...this.pickables.values()];
    const hits = this.raycaster.intersectObjects(targets, false);
    const hit = hits.find((h) => h.object.userData.elementId);
    this.onSelect(hit ? hit.object.userData.elementId : null);
  }

  /** 加载 2D 模型并重建场景对象 */
  setModel(model: CadModel) {
    this.clearModel();
    const pickables = new Map<string, THREE.Object3D>();
    const group = buildScene(model, pickables);
    this.pickables = pickables;
    this.group = group;
    this.scene.add(group);
    this.requestRender();
  }

  /** 清空场景中的 2D 模型对象（网格底图保留） */
  clearModel() {
    if (this.group) {
      this.scene.remove(this.group);
      disposeObjectGroup(this.group);
      this.group = null;
    }
    this.pickables = new Map();
    this.selectedId = null;
    this.requestRender();
  }

  /** 按模型包围盒适配视图（2D：正交相机视锥对齐） */
  fitView() {
    if (!this.group) return;
    const box = new THREE.Box3().setFromObject(this.group);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    const pad = 1.15;
    this.scale = clamp(
      Math.max((size.x || 1) / w, (size.y || 1) / h) * pad,
      MIN_SCALE,
      MAX_SCALE,
    );
    this.viewX = center.x;
    this.viewY = center.y;
    this.updateFrustum();
  }

  /** 切换选中高亮（O(1)：按 id 找到对象并切色） */
  setSelected(id: string | null) {
    if (this.selectedId === id) return;
    if (this.selectedId) {
      const prev = this.pickables.get(this.selectedId);
      if (prev) this.applyColor(prev, prev.userData.defaultColor);
    }
    this.selectedId = id;
    if (id) {
      const obj = this.pickables.get(id);
      if (obj) this.applyColor(obj, HIGHLIGHT_COLOR);
    }
    this.requestRender();
  }

  private applyColor(obj: THREE.Object3D, color: string) {
    const mat = (
      obj as THREE.Mesh | THREE.Line | THREE.LineLoop | THREE.LineSegments | THREE.Sprite
    ).material as (THREE.Material & { color?: THREE.Color }) | undefined;
    if (mat?.color) mat.color.set(color);
  }

  override dispose() {
    this.clearModel();
    this.container.removeEventListener('pointerdown', this.onPointerDown);
    this.container.removeEventListener('pointermove', this.onPointerMove);
    this.container.removeEventListener('pointerup', this.onPointerUp);
    this.container.removeEventListener('pointerleave', this.onPointerUp);
    this.container.removeEventListener('wheel', this.onWheel);
    super.dispose();
  }
}
