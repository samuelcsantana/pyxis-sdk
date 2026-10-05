import { describe, expect, it } from 'vitest';
import type { BatchEvent } from './batch.js';
import {
  byteLength,
  chunkEvents,
  enqueue,
  FLUSH_EVENT_COUNT,
  MAX_BATCH_BYTES,
  MAX_EVENTS_PER_BATCH,
  shouldFlushNow,
} from './batch-policy.js';

function event(index: number, path = '/'): BatchEvent {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: 'page_view',
    occurred_at: '2026-10-06T14:03:10.004Z',
    session_id: '11111111-1111-4111-8111-111111111111',
    path,
  };
}

const serialize = (events: readonly BatchEvent[]) => JSON.stringify({ events });

describe('shouldFlushNow', () => {
  it('flushes once ten events are queued', () => {
    expect(shouldFlushNow(FLUSH_EVENT_COUNT - 1)).toBe(false);
    expect(shouldFlushNow(FLUSH_EVENT_COUNT)).toBe(true);
  });
});

describe('enqueue', () => {
  it('appends without mutating the queue', () => {
    const queue = [event(1)];

    const result = enqueue(queue, event(2));

    expect(result).toEqual({ queue: [event(1), event(2)], accepted: true });
    expect(queue).toHaveLength(1);
  });

  it('refuses an event once the queue is full', () => {
    const full = [event(1), event(2)];

    expect(enqueue(full, event(3), 2)).toEqual({ queue: full, accepted: false });
  });
});

describe('byteLength', () => {
  it('counts UTF-8 bytes, not characters', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('ção')).toBe(5);
  });
});

describe('chunkEvents', () => {
  it('keeps a small queue in one batch', () => {
    const events = [event(1), event(2)];

    expect(chunkEvents(events, serialize)).toEqual({ chunks: [events], oversized: [] });
  });

  it('splits at fifty events per batch', () => {
    const events = Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, (_, index) => event(index));

    const { chunks } = chunkEvents(events, serialize);

    expect(chunks.map((chunk) => chunk.length)).toEqual([MAX_EVENTS_PER_BATCH, 1]);
  });

  it('splits by the serialized byte size, multi-byte characters included', () => {
    const longPath = `/${'ç'.repeat(400)}`;
    const events = Array.from({ length: 6 }, (_, index) => event(index, longPath));
    const oneEventBytes = byteLength(serialize([event(0, longPath)]));

    const limit = Math.floor(oneEventBytes * 2.5);

    const { chunks } = chunkEvents(events, serialize, MAX_EVENTS_PER_BATCH, limit);

    expect(chunks.map((chunk) => chunk.length)).toEqual([2, 2, 2]);
    for (const chunk of chunks) {
      expect(byteLength(serialize(chunk))).toBeLessThanOrEqual(limit);
    }
  });

  it('sets aside an event that cannot fit any batch on its own', () => {
    const huge = event(9, `/${'x'.repeat(MAX_BATCH_BYTES)}`);

    expect(chunkEvents([event(1), huge, event(2)], serialize)).toEqual({
      chunks: [[event(1), event(2)]],
      oversized: [huge],
    });
  });

  it('returns no batch for an empty queue', () => {
    expect(chunkEvents([], serialize)).toEqual({ chunks: [], oversized: [] });
  });
});
