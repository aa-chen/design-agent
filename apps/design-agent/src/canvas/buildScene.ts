import type {
  Annotation,
  ArcElement,
  CadElement,
  CadModel,
  DimensionAnnotation,
  Vec3,
} from '@da/cad-core';
import * as THREE from 'three';

/** 选中高亮色（Cad2DViewer 与之配合） */
export const HIGHLIGHT_COLOR = '#ff7a00';

/** 图层默认色表 */
const LAYER_COLORS: Record<string, string> = {
  轮廓: '#2563eb',
  中心线: '#dc2626',
  辅助线: '#94a3b8',
  尺寸: '#059669',
  文本: '#0f172a',
};

const DEFAULT_COLOR = '#334155';

/** 标注图形略高于几何元素，避免 z-fighting */
const Z_ANNOTATION = 0.02;

const v = (p: Vec3) => new THREE.Vector3(p[0], p[1], p[2]);

function resolveColor(el: { color?: string; layer?: string }): string {
  if (el.color) return el.color;
  if (el.layer && LAYER_COLORS[el.layer]) return LAYER_COLORS[el.layer];
  return DEFAULT_COLOR;
}

function makeLineMaterial(color: string) {
  return new THREE.LineBasicMaterial({ color: new THREE.Color(color) });
}

/** 标记对象可拾取并登记到 pickables（选中高亮/属性面板用），返回原对象以保留具体类型 */
function register<T extends THREE.Line | THREE.LineLoop | THREE.LineSegments | THREE.Sprite>(
  obj: T,
  id: string,
  color: string,
  pickables: Map<string, THREE.Object3D>,
): T {
  obj.userData.elementId = id;
  obj.userData.defaultColor = color;
  pickables.set(id, obj);
  return obj;
}

function buildElement(
  el: CadElement,
  pickables: Map<string, THREE.Object3D>,
): THREE.Line | THREE.Sprite {
  const color = resolveColor(el);
  switch (el.type) {
    case 'line': {
      const geo = new THREE.BufferGeometry().setFromPoints([v(el.from), v(el.to)]);
      return register(new THREE.Line(geo, makeLineMaterial(color)), el.id, color, pickables);
    }
    case 'polyline': {
      const pts = el.points.map(v);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = el.closed
        ? new THREE.LineLoop(geo, makeLineMaterial(color))
        : new THREE.Line(geo, makeLineMaterial(color));
      return register(line, el.id, color, pickables);
    }
    case 'circle': {
      const pts = sampleCircle(el.center, el.radius, 64);
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      return register(new THREE.LineLoop(geo, makeLineMaterial(color)), el.id, color, pickables);
    }
    case 'arc':
      return register(buildArcLine(el, color), el.id, color, pickables);
    case 'rect': {
      const pts = [
        v(el.min),
        new THREE.Vector3(el.max[0], el.min[1], 0),
        v(el.max),
        new THREE.Vector3(el.min[0], el.max[1], 0),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      return register(new THREE.LineLoop(geo, makeLineMaterial(color)), el.id, color, pickables);
    }
    case 'text': {
      const sprite = makeTextSprite(el.content, {
        height: el.height ?? 5,
        color,
        rotation: el.rotation,
      });
      sprite.position.set(...el.position);
      return register(sprite, el.id, color, pickables);
    }
  }
}

function buildArcLine(el: ArcElement, color: string): THREE.Line {
  const pts = sampleArc(el.center, el.radius, el.startAngle, el.endAngle, 32);
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(geo, makeLineMaterial(color));
}

function buildAnnotation(
  ann: Annotation,
  pickables: Map<string, THREE.Object3D>,
): THREE.Object3D | null {
  const color = resolveColor(ann);
  switch (ann.type) {
    case 'dimension':
      return buildDimension(ann, color, pickables);
    case 'text': {
      const sprite = makeTextSprite(ann.content, {
        height: ann.height ?? 4,
        color,
        rotation: ann.rotation,
      });
      sprite.position.set(...ann.position);
      return register(sprite, ann.id, color, pickables);
    }
  }
}

/** 线性尺寸标注：延伸线 x2 + 尺寸线 + 两端箭头 + 中部文本 */
function buildDimension(
  ann: DimensionAnnotation,
  color: string,
  pickables: Map<string, THREE.Object3D>,
): THREE.LineSegments {
  const from = v(ann.from);
  const to = v(ann.to);
  const dlFrom = from.clone().add(v(ann.offset)).setZ(Z_ANNOTATION);
  const dlTo = to.clone().add(v(ann.offset)).setZ(Z_ANNOTATION);

  const positions: number[] = [];
  const push = (p: THREE.Vector3) => positions.push(p.x, p.y, p.z);

  // 延伸线
  push(from);
  push(dlFrom);
  push(to);
  push(dlTo);
  // 尺寸线
  push(dlFrom);
  push(dlTo);

  // 箭头：尖在尺寸线端点，两条后掠边
  const dir = dlTo.clone().sub(dlFrom).normalize();
  const perp = new THREE.Vector3(-dir.y, dir.x, 0);
  const arrowLen = Math.max(4, Math.hypot(ann.offset[0], ann.offset[1]) * 0.2);
  for (const tip of [dlFrom, dlTo]) {
    const sign = tip === dlFrom ? 1 : -1;
    const w1 = tip
      .clone()
      .addScaledVector(dir, sign * arrowLen)
      .addScaledVector(perp, arrowLen * 0.5);
    const w2 = tip
      .clone()
      .addScaledVector(dir, sign * arrowLen)
      .addScaledVector(perp, -arrowLen * 0.5);
    push(tip);
    push(w1);
    push(tip);
    push(w2);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const segments = register(
    new THREE.LineSegments(geo, makeLineMaterial(color)),
    ann.id,
    color,
    pickables,
  );

  // 中部文本（不参与拾取，仅展示）
  const mid = dlFrom.clone().add(dlTo).multiplyScalar(0.5);
  const text = ann.text ?? '';
  if (text) {
    const sprite = makeTextSprite(text, { height: 4, color });
    sprite.position.copy(mid);
    sprite.userData.isAnnotationLabel = true;
    segments.add(sprite);
  }
  return segments;
}

/** 画圆采样点（XY 平面） */
function sampleCircle(center: Vec3, radius: number, segments: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(new THREE.Vector3(center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, 0));
  }
  return pts;
}

/** 画弧采样点（从 startAngle 到 endAngle） */
function sampleArc(
  center: Vec3,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments: number,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + (endAngle - startAngle) * t;
    pts.push(new THREE.Vector3(center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, 0));
  }
  return pts;
}

/** 用 canvas 生成文本纹理 Sprite（轻量，避免引入 troika） */
function makeTextSprite(
  text: string,
  opts: { height: number; color: string; rotation?: number },
): THREE.Sprite {
  const fontSize = 48;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const font = `${fontSize}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
  if (!ctx) {
    return new THREE.Sprite(new THREE.SpriteMaterial());
  }
  ctx.font = font;
  const textWidth = Math.ceil(ctx.measureText(text).width);
  canvas.width = Math.max(2, textWidth + fontSize * 0.4);
  canvas.height = fontSize + 8;
  ctx.font = font;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.color;
  ctx.fillText(text, fontSize * 0.2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  if (opts.rotation) material.rotation = opts.rotation;

  const sprite = new THREE.Sprite(material);
  sprite.userData.canvasTexture = texture;
  const pxToWorld = opts.height / fontSize;
  sprite.scale.set(canvas.width * pxToWorld, canvas.height * pxToWorld, 1);
  return sprite;
}

/**
 * 将 CadModel 构建为 three 场景对象组。
 * @param pickables 输出映射：elementId -> 可拾取对象（供选中高亮/属性面板）
 */
export function buildScene(
  model: CadModel,
  pickables: Map<string, THREE.Object3D>,
): THREE.Group {
  const group = new THREE.Group();
  group.name = model.name;

  for (const el of model.elements) {
    if (el.visible === false) continue;
    const obj = buildElement(el, pickables);
    group.add(obj);
  }
  for (const ann of model.annotations) {
    if (ann.visible === false) continue;
    const obj = buildAnnotation(ann, pickables);
    if (obj) group.add(obj);
  }
  return group;
}
