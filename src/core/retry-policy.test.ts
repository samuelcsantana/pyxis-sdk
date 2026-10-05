import { describe, expect, it } from 'vitest';
import { judgeOutcome, parseRetryAfter, RETRY_DELAYS_MS, retryDelay } from './retry-policy.js';

describe('judgeOutcome', () => {
  it.each([200, 202, 204])('is done on %i', (status) => {
    expect(judgeOutcome({ kind: 'response', status })).toBe('done');
  });

  it.each([429, 500, 502, 503])('retries on %i', (status) => {
    expect(judgeOutcome({ kind: 'response', status })).toBe('retry');
  });

  it.each([400, 401, 403, 404, 413, 302])('drops on %i, which a retry cannot fix', (status) => {
    expect(judgeOutcome({ kind: 'response', status })).toBe('drop');
  });

  it('retries when no response arrived', () => {
    expect(judgeOutcome({ kind: 'network-error' })).toBe('retry');
  });

  it('is done when the batch was handed to the browser as a beacon', () => {
    expect(judgeOutcome({ kind: 'handed-off' })).toBe('done');
  });
});

describe('retryDelay', () => {
  it('follows 1, 2, 4, 8 and 16 seconds without jitter at the midpoint', () => {
    const delays = RETRY_DELAYS_MS.map((_, attempt) => retryDelay(attempt, () => 0.5));

    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000]);
  });

  it('spreads each delay by at most 20% either way', () => {
    expect(retryDelay(0, () => 0)).toBe(800);
    expect(retryDelay(0, () => 1)).toBe(1200);
  });

  it('gives up after the fifth retry', () => {
    expect(retryDelay(RETRY_DELAYS_MS.length, () => 0.5)).toBeUndefined();
  });

  it('waits at least as long as Retry-After asks', () => {
    expect(retryDelay(0, () => 0.5, 30)).toBe(30000);
    expect(retryDelay(4, () => 0.5, 1)).toBe(16000);
  });
});

describe('parseRetryAfter', () => {
  it('reads a number of seconds', () => {
    expect(parseRetryAfter(' 30 ')).toBe(30);
  });

  it.each([null, '', 'Wed, 21 Oct 2026 07:28:00 GMT', '-5', '1.5'])('ignores %j', (header) => {
    expect(parseRetryAfter(header)).toBeUndefined();
  });
});
