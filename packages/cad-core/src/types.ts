/** 三维坐标。CAD 图纸数据约定渲染在 XY 平面（z 默认 0）。 */
export type Vec3 = [number, number, number];

export interface CadElementBase {
  id: string;
  layer?: string;
  color?: string;
  visible?: boolean;
  /** 线型：solid 实线 / dashed 虚线（隐藏线、中心线等） */
  lineStyle?: 'solid' | 'dashed';
}

export interface LineElement extends CadElementBase {
  type: 'line';
  from: Vec3;
  to: Vec3;
}

export interface PolylineElement extends CadElementBase {
  type: 'polyline';
  points: Vec3[];
  closed?: boolean;
}

export interface CircleElement extends CadElementBase {
  type: 'circle';
  center: Vec3;
  radius: number;
}

export interface ArcElement extends CadElementBase {
  type: 'arc';
  center: Vec3;
  radius: number;
  /** 弧度，相对 +X 方向 */
  startAngle: number;
  endAngle: number;
}

export interface RectElement extends CadElementBase {
  type: 'rect';
  min: Vec3;
  max: Vec3;
}

export interface TextElement extends CadElementBase {
  type: 'text';
  position: Vec3;
  content: string;
  height?: number;
  rotation?: number;
}

export type CadElement =
  | LineElement
  | PolylineElement
  | CircleElement
  | ArcElement
  | RectElement
  | TextElement;

export interface AnnotationBase {
  id: string;
  layer?: string;
  color?: string;
  visible?: boolean;
  /** 线型：solid 实线 / dashed 虚线（隐藏线、中心线等） */
  lineStyle?: 'solid' | 'dashed';
}

/** 线性尺寸标注：尺寸线 + 延伸线 + 箭头 + 文本。尺寸线位于 from+offset → to+offset。 */
export interface DimensionAnnotation extends AnnotationBase {
  type: 'dimension';
  from: Vec3;
  to: Vec3;
  offset: Vec3;
  text?: string;
  /** 文本高度（世界单位） */
  textHeight?: number;
}

/** 引注文本标注 */
export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  position: Vec3;
  content: string;
  height?: number;
  rotation?: number;
}

export type Annotation = DimensionAnnotation | TextAnnotation;

/** 零件分组，elementIds 引用 elements 中的 id */
export interface CadPart {
  id: string;
  name: string;
  elementIds: string[];
}

export interface CadModel {
  version: string;
  name: string;
  unit?: 'mm' | 'inch';
  parts: CadPart[];
  elements: CadElement[];
  annotations: Annotation[];
}
