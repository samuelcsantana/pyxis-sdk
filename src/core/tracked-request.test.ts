import { describe, expect, it } from 'vitest';
import {
  checkTrackedRequest,
  MAX_REQUEST_DURATION_MS,
  MAX_ROUTE_LENGTH,
  routeOf,
  type TrackedRequest,
} from './tracked-request.js';

const REQUEST: TrackedRequest = {
  method: 'POST',
  url: 'https://api.example.com/orders/42?coupon=X',
  status: 201,
  durationMs: 87,
};

describe('routeOf', () => {
  it.each([
    [
      'an absolute URL, dropping the origin and the query',
      'https://api.example.com/orders/42?x=1',
      '/orders/:id',
    ],
    ['a relative URL', '/orders/9f1c2b3a-1d2e-4f5a-8b6c-7d8e9f0a1b2c/items', '/orders/:id/items'],
    ['a relative URL without a leading slash', 'orders/42', '/orders/:id'],
    ['a URL with a fragment', '/reports/2026#top', '/reports/:id'],
    ['the root', 'https://api.example.com', '/'],
  ])('templates %s', (_, url, route) => {
    expect(routeOf(url, [])).toBe(route);
  });

  it('applies the custom path rules first', () => {
    expect(routeOf('/vendas/abc-123/recibo', ['/vendas/:id/recibo'])).toBe('/vendas/:id/recibo');
  });

  it(`cuts a route at ${String(MAX_ROUTE_LENGTH)} characters`, () => {
    expect(routeOf(`/${'a'.repeat(150)}`, [])).toHaveLength(MAX_ROUTE_LENGTH);
  });

  it.each([['http://[broken'], [42], [undefined]])('refuses %j', (url) => {
    expect(routeOf(url, [])).toBeUndefined();
  });
});

describe('checkTrackedRequest', () => {
  it('turns a request into the api_request properties', () => {
    expect(checkTrackedRequest(REQUEST, [])).toEqual({
      ok: true,
      properties: { method: 'POST', route: '/orders/:id', status: 201, duration_ms: 87 },
      droppedErrorCode: false,
    });
  });

  it('keeps a valid error code', () => {
    expect(
      checkTrackedRequest({ ...REQUEST, status: 422, errorCode: 'order.invalid_total' }, []),
    ).toMatchObject({ ok: true, properties: { error_code: 'order.invalid_total' } });
  });

  it('records a request that got no response as status 0', () => {
    expect(checkTrackedRequest({ ...REQUEST, status: 0 }, [])).toMatchObject({
      ok: true,
      properties: { status: 0 },
    });
  });

  it('drops an invalid error code and keeps the request', () => {
    expect(checkTrackedRequest({ ...REQUEST, errorCode: 'Order Invalid!' }, [])).toEqual({
      ok: true,
      properties: { method: 'POST', route: '/orders/:id', status: 201, duration_ms: 87 },
      droppedErrorCode: true,
    });
  });

  it('accepts the edges of the ranges', () => {
    expect(
      checkTrackedRequest({ ...REQUEST, status: 599, durationMs: MAX_REQUEST_DURATION_MS }, []).ok,
    ).toBe(true);
    expect(checkTrackedRequest({ ...REQUEST, durationMs: 0 }, []).ok).toBe(true);
  });

  it.each([
    ['method', { method: 'HEAD' }],
    ['url', { url: 'http://[broken' }],
    ['status', { status: 600 }],
    ['status', { status: -1 }],
    ['status', { status: 200.5 }],
    ['duration', { durationMs: 12.7 }],
    ['duration', { durationMs: MAX_REQUEST_DURATION_MS + 1 }],
    ['duration', { durationMs: -5 }],
  ])('refuses a request with an invalid %s', (reason, overrides) => {
    expect(checkTrackedRequest({ ...REQUEST, ...overrides } as TrackedRequest, [])).toEqual({
      ok: false,
      reason,
    });
  });
});
