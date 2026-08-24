import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cadModelToDXF, cadModelToSVG, parseCadBundle } from '../src';

const bundlePath = resolve(__dirname, '../../../examples/KxBV6LDd.bundle.json');
const bundleJson = JSON.parse(readFileSync(bundlePath, 'utf8')) as unknown;

describe('图纸导出', () => {
  const model = parseCadBundle(bundleJson);

  it('SVG 包含全部图层分组与数量一致的图元', () => {
    const svg = cadModelToSVG(model);
    // 图层分组（辅助线/中心线/虚线/双点划线/轮廓）
    for (const layer of ['辅助线', '中心线', '虚线', '双点划线', '0']) {
      expect(svg).toContain(`id="layer-${layer}"`);
    }
    // 图层分组内的图元总量与模型一致（尺寸标注组另计）
    const layerGroups = svg.match(/id="layer-[^"]*"/g) ?? [];
    expect(layerGroups).toHaveLength(5);
    const pathsInLayers = svg.match(/<g id="layer-[^"]*"[^>]*>([^]*?)(?=<g id="annotations"|<\/svg>)/)?.[1] ?? '';
    const paths = pathsInLayers.match(/<path /g) ?? [];
    expect(paths.length).toBe(model.elements.length);
    // 尺寸标注与文本
    expect(svg).toContain('id="dim-0"');
    expect(svg).toContain('id="dim-1"');
    expect(svg).toContain('>122.94</text>');
    expect(svg).toContain('>97.33</text>');
  });

  it('SVG 坐标翻转正确（模型 Y 向上 → SVG Y 向下）', () => {
    const svg = cadModelToSVG(model);
    const line = model.elements.find((el) => el.type === 'line')!;
    if (line.type === 'line') {
      const d = `M ${line.from[0].toFixed(4)} ${(-line.from[1]).toFixed(4)} L ${line.to[0].toFixed(4)} ${(-line.to[1]).toFixed(4)}`;
      expect(svg).toContain(d);
    }
  });

  it('DXF 为 R12 结构：SECTION/ENTITIES/EOF、图层表、实体数量', () => {
    const dxf = cadModelToDXF(model);
    expect(dxf).toContain('0\r\nSECTION\r\n2\r\nHEADER');
    expect(dxf.trimEnd().endsWith('0\r\nEOF')).toBe(true);
    for (const layer of ['0', '虚线', '双点划线', '中心线', '辅助线', '尺寸']) {
      expect(dxf).toContain(`0\r\nLAYER\r\n2\r\n${layer}`);
    }
    const count = (tag: string) => (dxf.match(new RegExp(`0\\r\\n${tag}\\r\\n`, 'g')) ?? []).length;
    expect(count('LINE')).toBeGreaterThan(2600);
    expect(count('ARC')).toBe(1097);
    expect(count('POLYLINE')).toBe(216);
    expect(count('SEQEND')).toBe(216);
    expect(count('TEXT')).toBe(2);
    expect(dxf).not.toMatch(/(NaN|Infinity)/);
  });
});
