import { isCadBundle, parseCadModel } from '@da/cad-core';
import type { CadFormat } from './types';

function isIDocShape(json: unknown): boolean {
  if (!json || typeof json !== 'object') return false;
  const o = json as Record<string, unknown>;
  return o.fileExtension === 'pm' && Array.isArray(o.doc);
}

/** 检测 JSON 格式。IDoc / 云看图 bundle 走 @do-design；其余 CadModel 走 Three。 */
export function detectFormat(json: unknown): CadFormat {
  if (isIDocShape(json)) return 'idoc';
  if (isCadBundle(json)) return 'idoc';
  const parsed = parseCadModel(json);
  if (parsed.ok) return 'cad-model';
  return 'unknown';
}
