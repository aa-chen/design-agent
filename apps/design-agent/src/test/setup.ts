const store = new Map<string, string>();
const localStorageMock: Storage = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (key) => store.get(key) ?? null,
  key: (index) => [...store.keys()][index] ?? null,
  removeItem: (key) => {
    store.delete(key);
  },
  setItem: (key, value) => {
    store.set(key, value);
  },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
