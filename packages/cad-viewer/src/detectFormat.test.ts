import { describe, expect, it } from 'vitest';
import { detectFormat } from './detectFormat';

describe('detectFormat', () => {
  it('detects idoc by fileExtension pm + doc array', () => {
    expect(
      detectFormat({
        fileExtension: 'pm',
        doc: [{ _ctor_: 'Fake' }],
        versionCode: 0,
        documentName: 't',
        docUUID: 'u',
        documentType: 0,
      }),
    ).toBe('idoc');
  });

  it('detects cad-model by elements', () => {
    expect(
      detectFormat({
        version: '1.0',
        name: 't',
        unit: 'mm',
        elements: [
          {
            type: 'line',
            id: 'e1',
            from: [0, 0, 0],
            to: [1, 0, 0],
          },
        ],
        annotations: [],
      }),
    ).toBe('cad-model');
  });

  it('prefers idoc when both look plausible', () => {
    expect(
      detectFormat({
        fileExtension: 'pm',
        doc: [],
        elements: [{ type: 'line', id: 'e1', from: [0, 0, 0], to: [1, 0, 0] }],
      }),
    ).toBe('idoc');
  });

  it('detects cloud bundle as idoc (@do-design path)', () => {
    expect(
      detectFormat({
        drawingId: 1,
        viewTag: 'v',
        view: { _ctor_: 'CadView', id: { id: 1 } },
        geometry: [{ id: 2, ctor: 'CadLines', raw: { _ctor_: 'CadLines', id: { id: 2 } } }],
      }),
    ).toBe('idoc');
  });

  it('returns unknown for empty object', () => {
    expect(detectFormat({})).toBe('unknown');
  });
});
