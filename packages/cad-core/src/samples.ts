import type { CadModel } from './types';

/** 带矩形轮廓、圆孔、槽口与尺寸/文本标注的机械零件示例 */
export const bracketSample: CadModel = {
  version: '1.0',
  name: 'Bracket-01 支架',
  unit: 'mm',
  parts: [
    { id: 'p1', name: '支架主体', elementIds: ['e-rect', 'e-hole', 'e-slot'] },
  ],
  elements: [
    { type: 'rect', id: 'e-rect', min: [0, 0, 0], max: [100, 60, 0], layer: '轮廓' },
    { type: 'circle', id: 'e-hole', center: [50, 30, 0], radius: 12, layer: '轮廓' },
    {
      type: 'polyline',
      id: 'e-slot',
      points: [[20, 45, 0], [20, 15, 0], [80, 15, 0]],
      closed: false,
      layer: '辅助线',
    },
  ],
  annotations: [
    {
      type: 'dimension',
      id: 'a-width',
      from: [0, 0, 0],
      to: [100, 0, 0],
      offset: [0, -15, 0],
      text: '100',
    },
    {
      type: 'dimension',
      id: 'a-height',
      from: [0, 0, 0],
      to: [0, 60, 0],
      offset: [-15, 0, 0],
      text: '60',
    },
    { type: 'text', id: 'a-note', position: [50, 30, 0], content: 'Φ24', height: 8 },
  ],
};

/** 轴类零件：外形圆 + 中心线 + 直径标注 */
export const shaftSample: CadModel = {
  version: '1.0',
  name: 'Shaft-01 轴',
  unit: 'mm',
  parts: [{ id: 'p1', name: '轴身', elementIds: ['e-cir1', 'e-cir2', 'e-ax'] }],
  elements: [
    { type: 'circle', id: 'e-cir1', center: [0, 0, 0], radius: 20, layer: '轮廓' },
    { type: 'circle', id: 'e-cir2', center: [60, 0, 0], radius: 15, layer: '轮廓' },
    {
      type: 'polyline',
      id: 'e-ax',
      points: [[-35, 0, 0], [95, 0, 0]],
      closed: false,
      layer: '中心线',
    },
  ],
  annotations: [
    {
      type: 'dimension',
      id: 'a-len',
      from: [0, -20, 0],
      to: [60, -20, 0],
      offset: [0, -12, 0],
      text: '60',
    },
    { type: 'text', id: 'a-d1', position: [0, 20, 0], content: 'Φ40', height: 8 },
    { type: 'text', id: 'a-d2', position: [60, 15, 0], content: 'Φ30', height: 8 },
  ],
};

/** 极简示例：单条直线 + 一个尺寸标注，用于最小冒烟 */
export const minimalSample: CadModel = {
  version: '1.0',
  name: 'Minimal-01 最小示例',
  unit: 'mm',
  parts: [],
  elements: [{ type: 'line', id: 'e1', from: [0, 0, 0], to: [50, 30, 0] }],
  annotations: [
    {
      type: 'dimension',
      id: 'a1',
      from: [0, 0, 0],
      to: [50, 30, 0],
      offset: [0, 10, 0],
      text: '58.31',
    },
  ],
};

export const samples = [minimalSample, bracketSample, shaftSample];
