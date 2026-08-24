import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RenderingViewer } from './RenderingViewer';
import { disposeObjectGroup } from './threeUtils';

/** 原点坐标轴基准长度（世界单位），fitView 时按模型尺寸缩放 */
const AXIS_SIZE = 150;

/**
 * 3D 渲染器：GLTF/GLB 模型。
 * 透视相机 + 轨道控制（旋转/平移/缩放）+ 光照 + 原点坐标轴。
 * 命令式生命周期，由 React 组件挂载/销毁。
 */
export class Cad3DViewer extends RenderingViewer {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly orbitControls: OrbitControls;
  private readonly axes: THREE.AxesHelper;

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

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(200, 300, 400);
    this.scene.add(dir);

    this.axes = new THREE.AxesHelper(AXIS_SIZE);
    this.scene.add(this.axes);

    this.requestRender();
    this.loop();
  }

  protected updateCameraForSize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** 加载 GLTF/GLB 3D 模型并展示（透视相机 + 轨道控制） */
  setGltf(scene: THREE.Group) {
    this.clearModel();
    this.gltfGroup = scene;
    this.scene.add(scene);
    this.requestRender();
  }

  /** 清空场景中的 3D 模型对象（原点坐标轴保留） */
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
    this.axes.scale.setScalar(((sphere.radius * 0.8) / AXIS_SIZE) || 1);
    this.requestRender();
  }

  override dispose() {
    this.clearModel();
    this.orbitControls.dispose();
    this.scene.remove(this.axes);
    disposeObjectGroup(this.axes);
    super.dispose();
  }
}
