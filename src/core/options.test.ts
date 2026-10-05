import { describe, expect, it, vi } from 'vitest';
import { batchUrlFor, resolveOptions } from './options.js';

describe('batchUrlFor', () => {
  it.each([
    ['https://api.pyxis.example.com', 'https://api.pyxis.example.com/v1/batch'],
    ['https://api.pyxis.example.com/', 'https://api.pyxis.example.com/v1/batch'],
    ['https://example.com/pyxis//', 'https://example.com/pyxis/v1/batch'],
    ['http://localhost:3040', 'http://localhost:3040/v1/batch'],
    ['https://api.pyxis.example.com?x=1#y', 'https://api.pyxis.example.com/v1/batch'],
  ])('turns %s into %s', (endpoint, expected) => {
    expect(batchUrlFor(endpoint)).toBe(expected);
  });

  it.each(['', 'api.pyxis.example.com', 'ftp://example.com', 'javascript:alert(1)'])(
    'refuses %j',
    (endpoint) => {
      expect(batchUrlFor(endpoint)).toBeUndefined();
    },
  );
});

describe('resolveOptions', () => {
  const endpoint = 'https://api.pyxis.example.com';

  it.each([undefined, null, '', '   '])('is disabled without a key (%j)', (key) => {
    expect(resolveOptions({ key, endpoint })).toEqual({ ok: false, reason: 'no-key' });
  });

  it('is disabled with an endpoint that is not an http URL', () => {
    expect(resolveOptions({ key: 'pk_live_x', endpoint: 'nope' })).toEqual({
      ok: false,
      reason: 'invalid-endpoint',
    });
  });

  it('applies the defaults', () => {
    expect(resolveOptions({ key: ' pk_live_x ', endpoint })).toEqual({
      ok: true,
      options: {
        key: 'pk_live_x',
        batchUrl: 'https://api.pyxis.example.com/v1/batch',
        pathRules: [],
        autoPageViews: true,
        dryRun: false,
      },
    });
  });

  it('keeps every option the site sets', () => {
    const onBatch = vi.fn();

    expect(
      resolveOptions({
        key: 'pk_live_x',
        endpoint,
        pathRules: ['/orders/:id'],
        autoPageViews: false,
        debug: { dryRun: true, onBatch },
      }),
    ).toEqual({
      ok: true,
      options: {
        key: 'pk_live_x',
        batchUrl: 'https://api.pyxis.example.com/v1/batch',
        pathRules: ['/orders/:id'],
        autoPageViews: false,
        dryRun: true,
        onBatch,
      },
    });
  });
});
