import type { CadModel } from './types';
import { cadModelSchema } from './schema';

export type ParseResult =
  | { ok: true; data: CadModel }
  | { ok: false; errors: string[] };

/**
 * 解析并校验 CAD JSON 数据。
 * 返回可读的错误列表（如 "elements[3].radius: 半径必须为正数"）。
 */
export function parseCadModel(input: unknown): ParseResult {
  const result = cadModelSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  return { ok: false, errors };
}
