import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCadBundle, parseCadBundle, parseCadModel } from '../src';

const bundlePath = resolve(__dirname, '../../../examples/KxBV6LDd.bundle.json');
const bundleJson = JSON.parse(readFileSync(bundlePath, 'utf8')) as unknown;

/** 采样圆弧上的点（大半径圆弧的圆心可能在视图外） */
function sampleArc(el: { center: number[]; radius: number; startAngle: number; endAngle: number }) {
  const pts: number[][] = [];
  for (let i = 0; i <= 8; i++) {
    const a = el.startAngle + ((el.endAngle - el.startAngle) * i) / 8;
    pts.push([el.center[0] + Math.cos(a) * el.radius, el.center[1] + Math.sin(a) * el.radius, 0]);
  }
  return pts;
}

describe('云看图 bundle 解析', () => {
  it('isCadBundle 能识别 bundle，parseCadModel 自动分发', () => {
    expect(isCadBundle(bundleJson)).toBe(true);
    const result = parseCadModel(bundleJson);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toContain('8357');
      expect(result.data.unit).toBe('mm');
    }
  });

  it('几何元素数量与类型符合预期', () => {
    const model = parseCadBundle(bundleJson);
    expect(model.elements.length).toBeGreaterThan(3000);
    const types = new Set(model.elements.map((el) => el.type));
    expect(types).toEqual(new Set(['line', 'polyline', 'arc']));
    // 隐藏线应被标为 dashed
    const dashed = model.elements.filter((el) => el.lineStyle === 'dashed');
    expect(dashed.length).toBeGreaterThan(1000);
    // 坐标应为三维（z=0）
    const line = model.elements.find((el) => el.type === 'line');
    expect(line?.type === 'line' && line.from.length === 3).toBe(true);
  });

  it('坐标落在视图包围盒（视图局部 + chunk 矩阵平移）内', () => {
    const model = parseCadBundle(bundleJson);
    const view = (bundleJson as { view: { min: { data: number[] }; max: { data: number[] } } })
      .view;
    const tx = 545.0091449999996;
    const ty = 1231.1763299999761;
    const [minX, minY] = [view.min.data[0] + tx, view.min.data[1] + ty];
    const [maxX, maxY] = [view.max.data[0] + tx, view.max.data[1] + ty];
    const slack = 2;
    // 网格辅助线会超出视图包围盒，仅校验非辅助线元素
    const drawable = model.elements.filter((el) => el.layer !== '辅助线');
    for (const el of drawable) {
      const pts: number[][] =
        el.type === 'line'
          ? [el.from, el.to]
          : el.type === 'polyline'
            ? el.points
            : el.type === 'arc'
              ? sampleArc(el)
              : [];
      for (const p of pts) {
        expect(p[0]).toBeGreaterThanOrEqual(minX - slack);
        expect(p[0]).toBeLessThanOrEqual(maxX + slack);
        expect(p[1]).toBeGreaterThanOrEqual(minY - slack);
        expect(p[1]).toBeLessThanOrEqual(maxY + slack);
      }
    }
  });

  it('尺寸标注转换为 dimension 标注并计算文本', () => {
    const model = parseCadBundle(bundleJson);
    const dims = model.annotations.filter((a) => a.type === 'dimension');
    expect(dims).toHaveLength(2);
    const texts = dims.map((d) => (d.type === 'dimension' ? d.text : ''));
    expect(texts).toEqual(['122.94', '97.33']);
    for (const d of dims) {
      if (d.type === 'dimension') {
        expect(d.layer).toBe('尺寸');
        expect(d.textHeight).toBe(14); // dimtxt 3.5 × dimScale 4
      }
    }
  });

  it('零件分组按 groupIdList 聚合', () => {
    const model = parseCadBundle(bundleJson);
    expect(model.parts.length).toBeGreaterThan(10);
    for (const part of model.parts) {
      expect(part.elementIds.length).toBeGreaterThan(0);
    }
  });
});
