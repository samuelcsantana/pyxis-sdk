import { describe, expect, it, vi } from 'vitest';
import { BODY_CONTENT_TYPE, browserTransport } from './transport.js';

const URL_ = 'https://api.pyxis.example.com/v1/batch';
const BODY = '{"key":"pk_live_x","sent_at":"2026-10-06T14:03:11.120Z","events":[]}';

function respondWith(status: number, headers: Record<string, string> = {}) {
  return vi.fn(() => Promise.resolve(new Response(null, { status, headers })));
}

describe('browserTransport', () => {
  it('posts the batch as text/plain with keepalive and without credentials', async () => {
    const fetchImpl = respondWith(202);

    const outcome = await browserTransport(fetchImpl).send(URL_, BODY, false);

    expect(outcome).toEqual({ kind: 'response', status: 202 });
    expect(fetchImpl).toHaveBeenCalledWith(URL_, {
      method: 'POST',
      body: BODY,
      keepalive: true,
      credentials: 'omit',
      headers: { 'Content-Type': BODY_CONTENT_TYPE },
    });
  });

  it('passes Retry-After on to the retry policy', async () => {
    const outcome = await browserTransport(respondWith(429, { 'Retry-After': '30' })).send(
      URL_,
      BODY,
      false,
    );

    expect(outcome).toEqual({ kind: 'response', status: 429, retryAfterSeconds: 30 });
  });

  it('reports a network error while the page is visible, without a beacon', async () => {
    const beacon = vi.fn(() => true);
    const failing = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));

    const outcome = await browserTransport(failing, beacon).send(URL_, BODY, false);

    expect(outcome).toEqual({ kind: 'network-error' });
    expect(beacon).not.toHaveBeenCalled();
  });

  it('falls back to a beacon when keepalive fetch fails as the page hides', async () => {
    const beacon = vi.fn(() => true);
    const failing = vi.fn(() => Promise.reject(new TypeError('keepalive quota exceeded')));

    const outcome = await browserTransport(failing, beacon).send(URL_, BODY, true);

    expect(outcome).toEqual({ kind: 'handed-off' });
    expect(beacon).toHaveBeenCalledWith(URL_, expect.any(Blob));
    const blob = (beacon.mock.calls[0] as unknown as [string, Blob])[1];
    expect(blob.type).toBe(BODY_CONTENT_TYPE.toLowerCase());
  });

  it('reports a network error when the browser refuses the beacon', async () => {
    const failing = vi.fn(() => Promise.reject(new TypeError('quota')));

    const outcome = await browserTransport(failing, () => false).send(URL_, BODY, true);

    expect(outcome).toEqual({ kind: 'network-error' });
  });

  it('uses the beacon when fetch does not exist at all', async () => {
    const beacon = vi.fn(() => true);

    expect(await browserTransport(undefined, beacon).send(URL_, BODY, false)).toEqual({
      kind: 'handed-off',
    });
  });

  it('reports a network error when neither fetch nor a beacon exists', async () => {
    expect(await browserTransport(undefined, undefined).send(URL_, BODY, true)).toEqual({
      kind: 'network-error',
    });
  });
});
