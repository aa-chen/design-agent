import * as THREE from 'three';

/** 场景背景色默认值（2D / 3D 共用，运行时可通过 setBackground 覆盖） */
const DEFAULT_SCENE_BACKGROUND = '#fafafa';

/**
 * 渲染器公共基类：负责 WebGLRenderer 创建、rAF 渲染循环、窗口 resize 与销毁。
 * 相机、场景内容与交互由 2D / 3D 子类各自实现：
 * - Cad2DViewer：正交俯视 2D 图纸（缩放/拾取）
 * - Cad3DViewer：透视 3D 模型（轨道控制/光照）
 */
export abstract class RenderingViewer {
  protected readonly container: HTMLElement;
  protected readonly renderer: THREE.WebGLRenderer;
  protected readonly scene = new THREE.Scene();
  /** 当前渲染使用的相机（子类构造时赋值，再调用 loop() 启动渲染） */
  protected activeCamera!: THREE.Camera;

  private needsRender = true;
  private rafId = 0;
  private disposed = false;

  protected constructor(container: HTMLElement) {
    this.container = container;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(DEFAULT_SCENE_BACKGROUND);
    window.addEventListener('resize', this.onResize);
  }

  /** 更新场景背景色（主题切换时调用） */
  setBackground(color: string) {
    this.scene.background = new THREE.Color(color);
    this.requestRender();
  }

  /** 容器尺寸变化时更新相机投影（透视更新 aspect；正交重算视锥） */
  protected abstract updateCameraForSize(w: number, h: number): void;

  /** 标记下一帧需要重绘（交互/模型变化时调用） */
  protected requestRender() {
    this.needsRender = true;
  }

  /** 启动渲染循环（子类在完成相机与场景初始化后调用） */
  protected loop() {
    if (this.disposed) return;
    if (this.needsRender) {
      this.renderer.render(this.scene, this.activeCamera);
      this.needsRender = false;
    }
    this.rafId = requestAnimationFrame(() => this.loop());
  }

  private readonly onResize = () => {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h);
    this.updateCameraForSize(w, h);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
