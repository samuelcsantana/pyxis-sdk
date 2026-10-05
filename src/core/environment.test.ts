import { describe, expect, it } from 'vitest';
import { isBrowserLike } from './environment.js';

describe('isBrowserLike', () => {
  it('is true with a window and a document', () => {
    expect(isBrowserLike({ window: {}, document: {} })).toBe(true);
  });

  it.each([
    ['server rendering', {}],
    ['a worker without a document', { window: {} }],
    ['a document without a window', { document: {} }],
  ])('is false in %s', (_label, scope) => {
    expect(isBrowserLike(scope)).toBe(false);
  });
});
