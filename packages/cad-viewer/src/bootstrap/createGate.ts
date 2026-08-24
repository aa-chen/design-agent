/** 与应用侧 DocSaver / Document.create 生命周期对齐的本地创建闸门。 */
let open = false;

export function isCreateGateOpen(): boolean {
  return open;
}

export function runWithCreateGateOpen<T>(fn: () => T): T {
  const prev = open;
  open = true;
  try {
    return fn();
  } finally {
    open = prev;
  }
}

export async function runWithCreateGateOpenAsync<T>(fn: () => Promise<T>): Promise<T> {
  const prev = open;
  open = true;
  try {
    return await fn();
  } finally {
    open = prev;
  }
}
