import { describe, expect, it } from 'vitest';
import { bracketSample, minimalSample, parseCadModel, shaftSample } from '../src';

describe('parseCadModel', () => {
  it('accepts all built-in sample models', () => {
    for (const sample of [minimalSample, bracketSample, shaftSample]) {
      const result = parseCadModel(sample);
      expect(result.ok).toBe(true);
    }
  });

  it('defaults parts/annotations to empty arrays when omitted', () => {
    const result = parseCadModel({
      version: '1.0',
      name: 'ok',
      elements: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.parts).toEqual([]);
      expect(result.data.annotations).toEqual([]);
    }
  });

  it('rejects a negative circle radius', () => {
    const result = parseCadModel({
      version: '1.0',
      name: 'bad',
      elements: [{ type: 'circle', id: 'c1', center: [0, 0, 0], radius: -1 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('半径');
    }
  });

  it('rejects an unknown element type', () => {
    const result = parseCadModel({
      version: '1.0',
      name: 'bad',
      elements: [{ type: 'triangle', id: 't1' }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a polyline with fewer than 2 points', () => {
    const result = parseCadModel({
      version: '1.0',
      name: 'bad',
      elements: [{ type: 'polyline', id: 'p1', points: [[0, 0, 0]] }],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a dimension annotation missing offset', () => {
    const result = parseCadModel({
      version: '1.0',
      name: 'bad',
      elements: [],
      annotations: [
        { type: 'dimension', id: 'd1', from: [0, 0, 0], to: [10, 0, 0] },
      ],
    });
    expect(result.ok).toBe(false);
  });
});
