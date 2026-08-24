import { describe, expect, it } from 'vitest';
import { parseInput } from './parseInput';

describe('parseInput', () => {
  it('parses valid JSON string → ok true with object', async () => {
    const result = await parseInput('{"a":1}');
    expect(result).toEqual({ ok: true, json: { a: 1 } });
  });

  it('passes plain object through', async () => {
    const obj = { version: '1.0', elements: [] };
    const result = await parseInput(obj);
    expect(result).toEqual({ ok: true, json: obj });
  });

  it('reads File and extracts fileName', async () => {
    const file = new File([JSON.stringify({ a: 1 })], 't.json', {
      type: 'application/json',
    });
    const result = await parseInput(file);
    expect(result).toEqual({ ok: true, json: { a: 1 }, fileName: 't.json' });
  });

  it('returns error on invalid JSON string', async () => {
    const result = await parseInput('{not json');
    expect(result).toEqual({ ok: false, error: 'JSON 解析失败' });
  });
});
