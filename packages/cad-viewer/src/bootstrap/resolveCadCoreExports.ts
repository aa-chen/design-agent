/**
 * element-cad-core dist 是 UMD/CJS 包；Vite 下 default 可能为 undefined，真实导出在 module.exports。
 */
export function resolveCadCoreExports(
  mod: Record<string, unknown>,
): Record<string, unknown> {
  const moduleExports = mod['module.exports'];
  if (moduleExports && typeof moduleExports === 'object') {
    return moduleExports as Record<string, unknown>;
  }

  const def = mod.default;
  if (def && typeof def === 'object') {
    return def as Record<string, unknown>;
  }

  const { default: _d, ...rest } = mod;
  const keys = Object.keys(rest).filter((k) => k !== 'module.exports');
  if (keys.length > 0) {
    return rest as Record<string, unknown>;
  }

  throw new Error(
    '@do-design/element-cad-core 导出无效（无法解析 module.exports / default）',
  );
}
