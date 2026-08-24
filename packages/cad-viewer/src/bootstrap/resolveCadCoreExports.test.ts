import { describe, expect, it } from 'vitest';
import { resolveCadCoreExports } from './resolveCadCoreExports';

describe('resolveCadCoreExports', () => {
  it('reads module.exports key (Vite CJS interop)', () => {
    const exports = { CadLines: class {}, foo: 1 };
    const mod = { 'module.exports': exports, default: undefined };
    expect(resolveCadCoreExports(mod)).toBe(exports);
  });

  it('reads default when module.exports missing', () => {
    const exports = { CadLines: class {} };
    expect(resolveCadCoreExports({ default: exports })).toBe(exports);
  });

  it('reads spread namespace exports', () => {
    const mod = { CadLines: class {}, CadArcs: class {}, default: undefined };
    const resolved = resolveCadCoreExports(mod);
    expect(resolved.CadLines).toBe(mod.CadLines);
  });
});
