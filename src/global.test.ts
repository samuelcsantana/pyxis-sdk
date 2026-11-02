import { afterEach, describe, expect, it } from 'vitest';
import * as moduleApi from './index.js';

describe('the classic script build', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'pyxis');
  });

  it('puts on window.pyxis the very functions the module exports, no more and no fewer', async () => {
    await import('./global.js');

    const globalApi = Reflect.get(globalThis, 'pyxis') as Record<string, unknown>;

    expect(Object.keys(globalApi).sort()).toEqual(Object.keys(moduleApi).sort());
    for (const [name, exported] of Object.entries(moduleApi)) {
      expect(globalApi[name], name).toBe(exported);
    }
  });
});
