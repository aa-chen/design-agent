import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RenderingViewer } from './RenderingViewer';
import { disposeObjectGroup } from './threeUtils';

/**
 * 3D 渲染器：GLTF/GLB 模型。
 * 透视相机 + 轨道控制（旋转/平移/缩放）+ 光照；2D CAD 渲染见 Cad2DViewer。
 * 命令式生命周期，由 React 组件挂载/销毁。
 */
export class Cad3DViewer extends RenderingViewer {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly orbitControls: OrbitControls;

  private gltfGroup: THREE.Group | null = null;

  constructor(container: HTMLElement) {
    super(container);

    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100000);
    this.camera.position.set(0, 0, 1000);
    this.activeCamera = this.camera;

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = false;
    this.orbitControls.addEventListener('change', () => this.requestRender());

    // 网格材质需要光源
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(200, 300, 400);
    this.scene.add(dir);

    this.addGrid();
    this.requestRender();
    this.loop();
  }

  protected updateCameraForSize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private addGrid() {
    // 与 2D 底图一致的 XY 平面网格（3D 视角下仍可见，保持旧行为）
    const grid = new THREE.GridHelper(2000, 40, 0x0f172a, 0x0f172a);
    grid.rotation.x = Math.PI / 2;
    const mat = grid.material as THREE.Material;
    mat.opacity = 0.1;
    mat.transparent = true;
    this.scene.add(grid);
  }

  /** 加载 GLTF/GLB 3D 模型并展示（透视相机 + 轨道控制） */
  setGltf(scene: THREE.Group) {
    this.clearModel();
    this.gltfGroup = scene;
    this.scene.add(scene);
    this.requestRender();
  }

  /** 清空场景中的 3D 模型对象（网格底图保留） */
  clearModel() {
    if (this.gltfGroup) {
      this.scene.remove(this.gltfGroup);
      disposeObjectGroup(this.gltfGroup);
      this.gltfGroup = null;
    }
    this.requestRender();
  }

  /** 按模型包围球适配视图：相机沿固定方向位于包围球外，轨道中心对准模型中心 */
  fitView() {
    if (!this.gltfGroup) return;
    const box = new THREE.Box3().setFromObject(this.gltfGroup);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const dist = (sphere.radius / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.3;
    this.camera.position
      .copy(center)
      .addScaledVector(new THREE.Vector3(1, 0.7, 1).normalize(), dist);
    this.orbitControls.target.copy(center);
    this.orbitControls.update();
    this.requestRender();
  }

  override dispose() {
    this.clearModel();
    this.orbitControls.dispose();
    super.dispose();
  }
}
