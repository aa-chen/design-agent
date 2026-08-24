import type { CadElement, CadModel, DimensionAnnotation, Vec3 } from './types';

/**
 * 图纸导出：将内部 CadModel 渲染为 SVG 矢量图与 DXF（R12）文件。
 *
 * 坐标约定：模型空间 Y 轴向上（mm），SVG 使用 Y 向下坐标，导出时做翻转；
 * 弧的角度内部为弧度（相对 +X，逆时针为正），DXF 需要度数（逆时针为正）。
 */

const DEG = Math.PI / 180;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface LayerStyle {
  color: string;
  width: number;
  dash?: string;
}

/** 图层 → 颜色 / 线宽 / 虚线模式（mm 单位下的笔划节奏） */
const LAYER_STYLE: Record<string, LayerStyle> = {
  '0': { color: '#111418', width: 1.4 },
  虚线: { color: '#3d6fb4', width: 1.0, dash: '6 4' },
  双点划线: { color: '#a05a00', width: 1.0, dash: '14 4 2 4' },
  中心线: { color: '#d22630', width: 0.8, dash: '12 3 2 3' },
  辅助线: { color: '#c9c9c9', width: 0.6 },
  尺寸: { color: '#0a8f5c', width: 0.9 },
};

const DEFAULT_STYLE: LayerStyle = { color: '#111418', width: 1.2 };

function layerStyle(layer: string | undefined): LayerStyle {
  if (layer && LAYER_STYLE[layer]) return LAYER_STYLE[layer];
  return DEFAULT_STYLE;
}

/** 取元素用于求包围盒的采样点 */
function elementPoints(el: CadElement): Vec3[] {
  switch (el.type) {
    case 'line':
      return [el.from, el.to];
    case 'polyline':
      return el.points;
    case 'rect':
      return [el.min, el.max];
    case 'circle':
      return [
        [el.center[0] - el.radius, el.center[1] - el.radius, 0],
        [el.center[0] + el.radius, el.center[1] + el.radius, 0],
      ];
    case 'arc': {
      const { center, radius, startAngle, endAngle } = el;
      const pts: Vec3[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = startAngle + ((endAngle - startAngle) * i) / 8;
        pts.push([center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius, 0]);
      }
      return pts;
    }
    case 'text':
      return [el.position];
  }
}

/** 计算模型全部几何（含辅助线/标注）的包围盒 */
export function modelBounds(model: CadModel): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const include = (p: Vec3) => {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  };
  for (const el of model.elements) for (const p of elementPoints(el)) include(p);
  for (const ann of model.annotations) {
    if (ann.type === 'dimension') {
      include([ann.from[0] + ann.offset[0], ann.from[1] + ann.offset[1], 0]);
      include([ann.to[0] + ann.offset[0], ann.to[1] + ann.offset[1], 0]);
    } else {
      include(ann.position);
    }
  }
  return { minX, minY, maxX, maxY };
}

/** 弧：模型空间逆时针 start→end，返回 SVG 三次段路径（Y 翻转后 sweep=0） */
function arcSvgPath(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
): string {
  const twoPi = 2 * Math.PI;
  let delta = (a1 - a0) % twoPi;
  if (delta < 0) delta += twoPi;
  if (delta < 1e-9) delta = twoPi; // 整圆

  const pt = (a: number): [number, number] => [
    cx + Math.cos(a) * r,
    cy + Math.sin(a) * r,
  ];

  // 整圆拆成两个 180° 弧
  if (delta >= twoPi - 1e-9) {
    const mid = a0 + Math.PI;
    const [sx, sy] = pt(a0);
    const [mx, my] = pt(mid);
    const [ex, ey] = pt(a0 + twoPi);
    const m = (x: number) => x.toFixed(4);
    return `M ${m(sx)} ${m(-sy)} A ${m(r)} ${m(r)} 0 0 0 ${m(mx)} ${m(-my)} A ${m(r)} ${m(r)} 0 0 0 ${m(ex)} ${m(-ey)}`;
  }

  const large = delta > Math.PI ? 1 : 0;
  const [sx, sy] = pt(a0);
  const [ex, ey] = pt(a1);
  const m = (x: number) => x.toFixed(4);
  return `M ${m(sx)} ${m(-sy)} A ${m(r)} ${m(r)} 0 ${large} 0 ${m(ex)} ${m(-ey)}`;
}

function linePath(p1: Vec3, p2: Vec3): string {
  return `M ${p1[0].toFixed(4)} ${(-p1[1]).toFixed(4)} L ${p2[0].toFixed(4)} ${(-p2[1]).toFixed(4)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 尺寸标注 → SVG 组（延伸线 + 尺寸线 + 箭头 + 文本） */
function dimensionSvg(ann: DimensionAnnotation, id: string): string {
  const style = layerStyle(ann.layer);
  const p1: Vec3 = [ann.from[0] + ann.offset[0], ann.from[1] + ann.offset[1], 0];
  const p2: Vec3 = [ann.to[0] + ann.offset[0], ann.to[1] + ann.offset[1], 0];
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;

  const textHeight = ann.textHeight ?? 3.5;
  const arrowLen = Math.max(textHeight * 0.8, 2.5);
  const textSize = Math.max(textHeight * 1.15, 4);

  // 箭头：tip 在尺寸线端点 E，沿方向 v（指向尺寸线内部）张成窄三角
  const arrow = (ex: number, ey: number, vx: number, vy: number): string => {
    const L = arrowLen;
    const px = -vy;
    const py = vx;
    const b1x = ex + vx * L + px * L * 0.35;
    const b1y = ey + vy * L + py * L * 0.35;
    const b2x = ex + vx * L - px * L * 0.35;
    const b2y = ey + vy * L - py * L * 0.35;
    return `<polygon points="${ex.toFixed(3)},${(-ey).toFixed(3)} ${b1x.toFixed(3)},${(-b1y).toFixed(3)} ${b2x.toFixed(3)},${(-b2y).toFixed(3)}" fill="${style.color}" stroke="none"/>`;
  };

  const midX = (p1[0] + p2[0]) / 2;
  const midY = (p1[1] + p2[1]) / 2;
  const textX = midX + nx * textHeight * 0.45;
  const textY = midY + ny * textHeight * 0.45;

  const parts = [
    // 延伸线
    `<path d="${linePath(ann.from, p1)} ${linePath(ann.to, p2)}" stroke="${style.color}" stroke-width="${style.width}" fill="none"/>`,
    // 尺寸线
    `<path d="${linePath(p1, p2)}" stroke="${style.color}" stroke-width="${style.width}" fill="none"/>`,
    arrow(p1[0], p1[1], ux, uy),
    arrow(p2[0], p2[1], -ux, -uy),
    // 文本（白描边 halo 保证可读）
    `<text x="${textX.toFixed(3)}" y="${(-textY).toFixed(3)}" font-size="${textSize.toFixed(2)}" text-anchor="middle" dominant-baseline="central" fill="${style.color}" stroke="#ffffff" stroke-width="2.5" paint-order="stroke" font-family="Arial, 'PingFang SC', sans-serif">${escapeXml(ann.text ?? '')}</text>`,
  ];
  return `<g id="${id}">${parts.join('')}</g>`;
}

export interface SvgOptions {
  /** 边距（模型单位 mm），默认 8 */
  padding?: number;
  /** 是否输出页眉页脚说明，默认 true */
  header?: boolean;
}

/** 将 CadModel 渲染为独立 SVG 图纸 */
export function cadModelToSVG(model: CadModel, opts: SvgOptions = {}): string {
  const padding = opts.padding ?? 8;
  const b = modelBounds(model);
  const w = b.maxX - b.minX + padding * 2;
  const h = b.maxY - b.minY + padding * 2;
  const vbMinX = b.minX - padding;
  const vbMinY = -(b.maxY + padding);

  const groups: string[] = [];
  let gridEls = 0;

  // 几何元素按图层分组，保持图层顺序（辅助线最底、轮廓最上）
  const order = ['辅助线', '中心线', '虚线', '双点划线', '0', undefined];
  const byLayer = new Map<string | undefined, CadElement[]>();
  for (const el of model.elements) {
    const list = byLayer.get(el.layer);
    if (list) list.push(el);
    else byLayer.set(el.layer, [el]);
  }
  for (const layer of order) {
    const els = byLayer.get(layer);
    if (!els || els.length === 0) continue;
    const style = layerStyle(layer);
    const strokeDash =
      style.dash ?? (els.some((el) => el.lineStyle === 'dashed') ? '6 4' : undefined);
    const paths: string[] = [];
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (el.visible === false) continue;
      if (layer === '辅助线') gridEls++;
      if (el.type === 'line') {
        paths.push(`<path d="${linePath(el.from, el.to)}"/>`);
      } else if (el.type === 'polyline') {
        const d = el.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(4)} ${(-p[1]).toFixed(4)}`)
          .join(' ');
        paths.push(`<path d="${d}${el.closed ? ' Z' : ''}"/>`);
      } else if (el.type === 'arc') {
        paths.push(
          `<path d="${arcSvgPath(el.center[0], el.center[1], el.radius, el.startAngle, el.endAngle)}"/>`,
        );
      } else if (el.type === 'rect') {
        const d = `M ${el.min[0]} ${-el.min[1]} L ${el.max[0]} ${-el.min[1]} L ${el.max[0]} ${-el.max[1]} L ${el.min[0]} ${-el.max[1]} Z`;
        paths.push(`<path d="${d}"/>`);
      } else if (el.type === 'circle') {
        paths.push(
          `<circle cx="${el.center[0].toFixed(4)}" cy="${(-el.center[1]).toFixed(4)}" r="${el.radius.toFixed(4)}"/>`,
        );
      } else if (el.type === 'text') {
        paths.push(
          `<text x="${el.position[0].toFixed(3)}" y="${(-el.position[1]).toFixed(3)}" font-size="${(el.height ?? 5).toFixed(2)}" font-family="Arial, 'PingFang SC', sans-serif">${escapeXml(el.content)}</text>`,
        );
      }
    }
    if (paths.length > 0) {
      groups.push(
        `<g id="layer-${escapeXml(String(layer ?? 'default'))}" stroke="${style.color}" stroke-width="${style.width}" fill="none"${strokeDash ? ` stroke-dasharray="${strokeDash}"` : ''}>${paths.join('')}</g>`,
      );
    }
  }

  // 标注
  const annParts: string[] = [];
  model.annotations.forEach((ann, i) => {
    if (ann.type === 'dimension') annParts.push(dimensionSvg(ann, `dim-${i}`));
    else {
      const style = layerStyle(ann.layer);
      annParts.push(
        `<text x="${ann.position[0].toFixed(3)}" y="${(-ann.position[1]).toFixed(3)}" font-size="${(ann.height ?? 5).toFixed(2)}" fill="${style.color}" font-family="Arial, 'PingFang SC', sans-serif">${escapeXml(ann.content)}</text>`,
      );
    }
  });
  if (annParts.length > 0) groups.push(`<g id="annotations">${annParts.join('')}</g>`);

  const header = opts.header === false
    ? ''
    : `<text x="${vbMinX + 2}" y="${vbMinY + 14}" font-size="10" fill="#555555" font-family="Arial, 'PingFang SC', sans-serif">${escapeXml(model.name)} · 单位 ${model.unit ?? 'mm'} · 元素 ${model.elements.length} · 标注 ${model.annotations.length} · 零件组 ${model.parts.length} · 辅助线 ${gridEls}</text>`;

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w.toFixed(2)}" height="${h.toFixed(2)}" viewBox="${vbMinX.toFixed(2)} ${vbMinY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}">`,
    `<rect x="${vbMinX.toFixed(2)}" y="${vbMinY.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="#ffffff"/>`,
    header,
    groups.join(''),
    `</svg>`,
  ].join('\n');
}

/* ------------------------------------------------------------------ */
/* DXF (R12) 导出                                                      */
/* ------------------------------------------------------------------ */

const DXF_LAYER_COLOR: Record<string, number> = {
  '0': 7,
  虚线: 5,
  双点划线: 30,
  中心线: 1,
  辅助线: 8,
  尺寸: 3,
};

function dxfNum(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(6).replace(/\.?0+$/, '');
  return s;
}

function dxfLine(layer: string, p1: Vec3, p2: Vec3): string[] {
  return [
    '0', 'LINE',
    '8', layer,
    '10', dxfNum(p1[0]), '20', dxfNum(p1[1]), '30', '0',
    '11', dxfNum(p2[0]), '21', dxfNum(p2[1]), '31', '0',
  ];
}

function dxfText(layer: string, p: Vec3, height: number, content: string): string[] {
  return [
    '0', 'TEXT',
    '8', layer,
    '10', dxfNum(p[0]), '20', dxfNum(p[1]), '30', '0',
    '40', dxfNum(height),
    '1', content,
  ];
}

function dxfPolyline(layer: string, points: Vec3[], closed: boolean): string[] {
  const out: string[] = ['0', 'POLYLINE', '8', layer, '66', '1', '70', closed ? '1' : '0'];
  for (const p of points) {
    out.push('0', 'VERTEX', '8', layer, '10', dxfNum(p[0]), '20', dxfNum(p[1]), '30', '0');
  }
  out.push('0', 'SEQEND', '8', layer);
  return out;
}

function dxfArc(layer: string, el: Extract<CadElement, { type: 'arc' }>): string[] {
  return [
    '0', 'ARC',
    '8', layer,
    '10', dxfNum(el.center[0]), '20', dxfNum(el.center[1]), '30', '0',
    '40', dxfNum(el.radius),
    '50', dxfNum((el.startAngle / DEG) % 360),
    '51', dxfNum((el.endAngle / DEG) % 360),
  ];
}

/** 将 CadModel 导出为 DXF R12 文本 */
export function cadModelToDXF(model: CadModel): string {
  const layers = new Set<string>(['0']);
  const entities: string[][] = [];

  for (const el of model.elements) {
    const layer = el.layer ?? '0';
    layers.add(layer);
    if (el.visible === false) continue;
    if (el.type === 'line') {
      entities.push(dxfLine(layer, el.from, el.to));
    } else if (el.type === 'polyline') {
      entities.push(dxfPolyline(layer, el.points, el.closed ?? false));
    } else if (el.type === 'arc') {
      entities.push(dxfArc(layer, el));
    } else if (el.type === 'circle') {
      entities.push([
        '0', 'CIRCLE',
        '8', layer,
        '10', dxfNum(el.center[0]), '20', dxfNum(el.center[1]), '30', '0',
        '40', dxfNum(el.radius),
      ]);
    } else if (el.type === 'rect') {
      const [x1, y1] = [el.min[0], el.min[1]];
      const [x2, y2] = [el.max[0], el.max[1]];
      entities.push(
        dxfPolyline(layer, [[x1, y1, 0], [x2, y1, 0], [x2, y2, 0], [x1, y2, 0], [x1, y1, 0]], false),
      );
    } else if (el.type === 'text') {
      entities.push(dxfText(layer, el.position, el.height ?? 5, el.content));
    }
  }

  // 尺寸标注：延伸线 + 尺寸线 + 箭头 + 文本（以基本图元表达，兼容所有 DXF 阅读器）
  for (const ann of model.annotations) {
    if (ann.type === 'text') {
      layers.add(ann.layer ?? '尺寸');
      entities.push(dxfText(ann.layer ?? '尺寸', ann.position, ann.height ?? 5, ann.content));
      continue;
    }
    const layer = ann.layer ?? '尺寸';
    layers.add(layer);
    const p1: Vec3 = [ann.from[0] + ann.offset[0], ann.from[1] + ann.offset[1], 0];
    const p2: Vec3 = [ann.to[0] + ann.offset[0], ann.to[1] + ann.offset[1], 0];
    entities.push(dxfLine(layer, ann.from, p1));
    entities.push(dxfLine(layer, ann.to, p2));
    entities.push(dxfLine(layer, p1, p2));
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const textHeight = ann.textHeight ?? 3.5;
    const arrowLen = Math.max(textHeight * 1.7, 5);
    for (const [ex, ey, s] of [
      [p1[0], p1[1], 1],
      [p2[0], p2[1], -1],
    ] as const) {
      const f1: Vec3 = [ex - ux * arrowLen * 0.25 + uy * arrowLen * 0.35 * s, ey - uy * arrowLen * 0.25 - ux * arrowLen * 0.35 * s, 0];
      const f2: Vec3 = [ex - ux * arrowLen * 0.25 - uy * arrowLen * 0.35 * s, ey - uy * arrowLen * 0.25 + ux * arrowLen * 0.35 * s, 0];
      entities.push(dxfLine(layer, [ex, ey, 0], f1));
      entities.push(dxfLine(layer, [ex, ey, 0], f2));
    }
    const mid: Vec3 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 0];
    const nx = -uy;
    const ny = ux;
    entities.push(
      dxfText(layer, [mid[0] + nx * textHeight * 0.45, mid[1] + ny * textHeight * 0.45, 0], Math.max(textHeight * 1.15, 4), ann.text ?? ''),
    );
  }

  const layerTable: string[] = ['0', 'TABLE', '2', 'LAYER', '70', String(layers.size)];
  for (const name of layers) {
    layerTable.push(
      '0', 'LAYER',
      '2', name,
      '70', '0',
      '62', String(DXF_LAYER_COLOR[name] ?? 7),
      '6', 'CONTINUOUS',
    );
  }
  layerTable.push('0', 'ENDTAB');

  const out: string[] = [
    '0', 'SECTION', '2', 'HEADER',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES',
    ...layerTable,
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
  ];
  for (const e of entities) out.push(...e);
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\r\n') + '\r\n';
}
