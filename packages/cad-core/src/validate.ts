import type { CadModel } from './types';
import { isCadBundle, parseCadBundle } from './bundle';
import { cadModelSchema } from './schema';

export type ParseResult =
  | { ok: true; data: CadModel }
  | { ok: false; errors: string[] };

/**
 * 解析并校验 CAD JSON 数据。
 * 自动识别两种格式：
 * - 云看图 bundle（含 geometry/view 字段）→ 转为内部 CadModel；
 * - 内部 CadModel（含 elements 字段）→ zod 校验。
 * 返回可读的错误列表（如 "elements[3].radius: 半径必须为正数"）。
 */
export function parseCadModel(input: unknown): ParseResult {
  if (isCadBundle(input)) {
    try {
      return { ok: true, data: parseCadBundle(input) };
    } catch (error) {
      return {
        ok: false,
        errors: [error instanceof Error ? error.message : 'bundle 解析失败'],
      };
    }
  }
  const result = cadModelSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`,
  );
  return { ok: false, errors };
}
