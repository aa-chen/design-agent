import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bundleToIDocFile } from './bundleToIDocFile';

const bundlePath = resolve(__dirname, '../../../../examples/KxBV6LDd.bundle.json');

describe('bundleToIDocFile', () => {
  it('converts KxBV6LDd bundle to pm IDocFile', () => {
    const bundle = JSON.parse(readFileSync(bundlePath, 'utf8')) as unknown;
    const docFile = bundleToIDocFile(bundle);
    expect(docFile.fileExtension).toBe('pm');
    expect(docFile.versionCode).toBe(0);
    const ctors = new Set(docFile.doc.map((e: { _ctor_: string }) => e._ctor_));
    expect(ctors.has('CadDrawing')).toBe(true);
    expect(ctors.has('CadViewGroup')).toBe(true);
    expect(docFile.doc.length).toBeGreaterThan(48);
    expect(ctors.has('CadArcs')).toBe(true);
    expect(ctors.has('CadAlignedDimension')).toBe(true);
  });
});
