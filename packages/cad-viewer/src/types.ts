export type CadFormat = 'idoc' | 'cad-model' | 'unknown';

export type ViewerMeta = {
  format: Exclude<CadFormat, 'unknown'>;
  fileName?: string;
  elementCount?: number;
};

export type LoadResult =
  | { ok: true; format: Exclude<CadFormat, 'unknown'>; meta: ViewerMeta }
  | { ok: false; error: string };
