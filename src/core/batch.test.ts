import { describe, expect, it } from 'vitest';
import { buildBatch, serializeBatch } from './batch.js';

describe('buildBatch', () => {
  it('stamps the batch with the time it is sent, as ISO 8601', () => {
    expect(buildBatch('pk_live_x', Date.UTC(2026, 9, 6, 14, 3, 11, 120), [])).toEqual({
      key: 'pk_live_x',
      sent_at: '2026-10-06T14:03:11.120Z',
      events: [],
    });
  });
});

describe('serializeBatch', () => {
  it('writes the batch as JSON', () => {
    const batch = buildBatch('pk_live_x', 0, []);

    expect(JSON.parse(serializeBatch(batch))).toEqual(batch);
  });
});
