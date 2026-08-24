/**
 * Ambient type stubs for `@do-design/*`.
 *
 * `tsc --noEmit` would otherwise follow those packages' raw `.ts` exports and
 * typecheck them (800+ errors). Vite still resolves real packages from
 * node_modules at runtime — these paths are tsconfig-only.
 */

declare module '@do-design/element-cad-core' {
  /** Webpack dist：Vite 下真实导出常在 module.exports。 */
  const cadCoreExports: Record<string, unknown>;
  export = cadCoreExports;
}

declare module '@do-design/element-cad-calculator' {}

declare module '@do-design/d-model' {
  export type Class<T = any> = new (...args: any[]) => T;

  // Minimal any-friendly stubs for Task 6 DocBackend.
  export interface IApp {
    start(): Promise<void> | void;
    createView(
      id: string,
      container: HTMLElement,
      options?: any,
      renderType?: any,
    ): ISysWindow;
    destroyView(id: string): void;
  }

  export interface ISysWindow {
    getDocument(): IDocument;
    getRenderView?(): any;
    getSize?(): { x: number; y: number };
  }

  export interface IDocument {
    updateView(): void;
  }

  export interface IDocFile {
    fileExtension?: string;
    doc?: any;
    [key: string]: any;
  }

  export function createApp(param?: {
    id?: string;
    enableIndexedDB?: boolean;
  }): IApp;

  export class DocumentManager {
    static getInstance(): DocumentManager;
    loadDoc(
      doc: IDocument,
      file: IDocFile,
      project?: unknown,
    ): Promise<void> | void;
  }

  export class Document {
    create<T = unknown>(Ctor: Class<T>): T;
  }

  export class DocSaver {
    constructor(doc: IDocument);
    load(file: IDocFile, project?: unknown): Promise<boolean>;
  }

  export const FileUtil: {
    parse(str: string): IDocFile | undefined;
  };

  export const JsonUtil: {
    stringify(json: unknown): string;
  };

  export function elementMeta(
    classNameInFile: string,
    ElementDBClass: Class,
    save?: boolean,
    saveLevel?: number,
  ): (decoratedClass: Class) => void;

  export function getClassByName<T = Class>(name: string): T | undefined;
}

declare module '@do-design/d-render' {
  export enum EN_RENDER_TYPE {
    DRAWING_2D = 0,
    DESIGN_3D = 1,
  }
}
