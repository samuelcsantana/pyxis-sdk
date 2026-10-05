import { afterEach, describe, expect, it } from 'vitest';
import { memoryStore, webStore } from './storage.js';

describe('memoryStore', () => {
  it('reads what was written and forgets what was removed', () => {
    const store = memoryStore();

    store.write('a', '1');
    expect(store.read('a')).toBe('1');
    store.remove('a');
    expect(store.read('a')).toBeNull();
  });
});

describe('webStore', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('uses the browser storage when it works', () => {
    const store = webStore(() => sessionStorage);

    store.write('pyxis:test', 'value');

    expect(sessionStorage.getItem('pyxis:test')).toBe('value');
    expect(store.read('pyxis:test')).toBe('value');
    store.remove('pyxis:test');
    expect(sessionStorage.getItem('pyxis:test')).toBeNull();
  });

  it('keeps working in memory when the storage throws (private mode, blocked storage)', () => {
    const store = webStore(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    store.write('pyxis:test', 'value');
    expect(store.read('pyxis:test')).toBe('value');
    store.remove('pyxis:test');
    expect(store.read('pyxis:test')).toBeNull();
  });
});
