import { describe, expect, it, vi } from 'vitest';
import { BODY_CONTENT_TYPE, browserTransport } from './transport.js';

const URL_ = 'https://api.pyxis.example.com/v1/batch';
const BODY = '{"key":"pyxis_pk_x","sent_at":"2026-10-06T14:03:11.120Z","events":[]}';

const PERIOD = {
  day_ends_at: '2026-11-03T03:00:00.000Z',
  month_ends_at: '2026-12-01T03:00:00.000Z',
};
const INGEST_RESULT = { accepted: 1, duplicates: 0, rejected: 0 };

function respondWith(status: number, headers: Record<string, string> = {}) {
  return vi.fn(() => Promise.resolve(new Response(null, { status, headers })));
}

function answerWith(status: number, body: BodyInit) {
  return vi.fn(() => Promise.resolve(new Response(body, { status })));
}

function bodyThatBreaks(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start: (controller) => {
      controller.error(new TypeError('the connection was reset'));
    },
  });
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

  it('reads the period from a successful answer that carries it', async () => {
    const answer = JSON.stringify({ ...INGEST_RESULT, visitor_period: PERIOD });

    const outcome = await browserTransport(answerWith(202, answer)).send(URL_, BODY, false);

    expect(outcome).toEqual({ kind: 'response', status: 202, period: PERIOD });
  });

  it('reads a successful answer without a period as the option being off', async () => {
    const outcome = await browserTransport(answerWith(202, JSON.stringify(INGEST_RESULT))).send(
      URL_,
      BODY,
      false,
    );

    expect(outcome).toEqual({ kind: 'response', status: 202, period: 'off' });
  });

  it('decides nothing about the period from a successful answer with an empty body', async () => {
    expect(await browserTransport(respondWith(202)).send(URL_, BODY, false)).toEqual({
      kind: 'response',
      status: 202,
    });
  });

  it('keeps a successful answer whose body breaks off a response, deciding nothing', async () => {
    const beacon = vi.fn(() => true);

    const outcome = await browserTransport(answerWith(202, bodyThatBreaks()), beacon).send(
      URL_,
      BODY,
      true,
    );

    expect(outcome).toEqual({ kind: 'response', status: 202 });
    expect(beacon).not.toHaveBeenCalled();
  });

  it('never reads the period from an answer that is not a success', async () => {
    const answer = JSON.stringify({ ...INGEST_RESULT, visitor_period: PERIOD });

    const outcome = await browserTransport(answerWith(400, answer)).send(URL_, BODY, false);

    expect(outcome).toEqual({ kind: 'response', status: 400 });
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
