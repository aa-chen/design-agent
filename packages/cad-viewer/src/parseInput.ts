export async function parseInput(
  input: string | object | File,
): Promise<{ ok: true; json: unknown; fileName?: string } | { ok: false; error: string }> {
  try {
    if (typeof File !== 'undefined' && input instanceof File) {
      const text = await input.text();
      return { ok: true, json: JSON.parse(text), fileName: input.name };
    }
    if (typeof input === 'string') {
      return { ok: true, json: JSON.parse(input) };
    }
    return { ok: true, json: input };
  } catch {
    return { ok: false, error: 'JSON 解析失败' };
  }
}
