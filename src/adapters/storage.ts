export interface KeyValueStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryStore(): KeyValueStore {
  const values = new Map<string, string>();
  return {
    read: (key) => values.get(key) ?? null,
    write: (key, value) => {
      values.set(key, value);
    },
    remove: (key) => {
      values.delete(key);
    },
  };
}

export function webStore(getStorage: () => Storage): KeyValueStore {
  const fallback = memoryStore();
  return {
    read: (key) => {
      try {
        return getStorage().getItem(key);
      } catch {
        return fallback.read(key);
      }
    },
    write: (key, value) => {
      try {
        getStorage().setItem(key, value);
      } catch {
        fallback.write(key, value);
      }
    },
    remove: (key) => {
      try {
        getStorage().removeItem(key);
      } catch {
        fallback.remove(key);
      }
    },
  };
}
