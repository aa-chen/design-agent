/**
 * Ambient type stubs for `@do-design/*`.
 *
 * `tsc --noEmit` would otherwise follow those packages' raw `.ts` exports and
 * typecheck them (800+ errors). Vite still resolves real packages from
 * node_modules at runtime — these paths are tsconfig-only.
 */

declare module '@do-design/element-cad-core' {}

declare module '@do-design/element-cad-calculator' {}

declare module '@do-design/element-cad-event-actor' {}

declare module '@do-design/element-cad-camera-helper' {}

declare module '@do-design/d-model' {
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

  export const FileUtil: {
    parse(str: string): IDocFile | undefined;
  };

  export const JsonUtil: {
    stringify(json: unknown): string;
  };
}

declare module '@do-design/d-render' {
  export enum EN_RENDER_TYPE {
    DRAWING_2D = 0,
    DESIGN_3D = 1,
  }
}
