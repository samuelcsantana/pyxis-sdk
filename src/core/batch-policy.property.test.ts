import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildBatch, serializeBatch, type BatchEvent } from './batch.js';
import { byteLength, chunkEvents, enqueue } from './batch-policy.js';

const PROJECT_KEY = 'pyxis_pk_property_tests';
const SENT_AT = Date.parse('2026-10-28T12:00:00.000Z');
const MAX_GENERATED_EVENTS = 40;
const MAX_GENERATED_CAPACITY = 20;

const serialize = (events: readonly BatchEvent[]) =>
  serializeBatch(buildBatch(PROJECT_KEY, SENT_AT, events));

const propertyValue = fc.oneof(
  fc.boolean(),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.string({ unit: 'grapheme', maxLength: 100 }),
);

const batchEvent: fc.Arbitrary<BatchEvent> = fc.record(
  {
    id: fc.uuid(),
    name: fc.stringMatching(/^[a-z][a-z0-9_]{0,63}$/),
    occurred_at: fc
      .date({
        min: new Date('2026-01-01T00:00:00.000Z'),
        max: new Date('2026-12-31T23:59:59.999Z'),
        noInvalidDate: true,
      })
      .map((date) => date.toISOString()),
    session_id: fc.uuid(),
    path: fc.string({ unit: 'grapheme', maxLength: 120 }),
    properties: fc.dictionary(fc.stringMatching(/^[a-z0-9_]{1,40}$/), propertyValue, {
      maxKeys: 10,
    }),
  },
  { requiredKeys: ['id', 'name', 'occurred_at', 'session_id', 'path'] },
);

const events = fc.uniqueArray(batchEvent, {
  maxLength: MAX_GENERATED_EVENTS,
  selector: ({ id }) => id,
});

const idsOf = (list: readonly BatchEvent[]) => list.map(({ id }) => id);

describe('chunkEvents properties', () => {
  it('sends every event that fits on its own exactly once, in order, in non-empty batches within both limits', () => {
    fc.assert(
      fc.property(
        events,
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 200, max: 6000 }),
        (input, maxEvents, maxBytes) => {
          const fits = (candidate: readonly BatchEvent[]) =>
            candidate.length <= maxEvents && byteLength(serialize(candidate)) <= maxBytes;
          const { chunks, oversized } = chunkEvents(input, serialize, maxEvents, maxBytes);

          expect(chunks.every((chunk) => chunk.length > 0 && fits(chunk))).toBe(true);
          expect(idsOf(chunks.flat())).toEqual(idsOf(input.filter((event) => fits([event]))));
          expect(idsOf(oversized)).toEqual(idsOf(input.filter((event) => !fits([event]))));
        },
      ),
    );
  });

  it('never closes a batch that could still take the next event', () => {
    fc.assert(
      fc.property(
        events,
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 200, max: 6000 }),
        (input, maxEvents, maxBytes) => {
          const fits = (candidate: readonly BatchEvent[]) =>
            candidate.length <= maxEvents && byteLength(serialize(candidate)) <= maxBytes;
          const { chunks } = chunkEvents(input, serialize, maxEvents, maxBytes);
          const closedEarly = chunks.some((chunk, index) => {
            const next = chunks[index + 1];
            return next !== undefined && fits([...chunk, ...next.slice(0, 1)]);
          });

          expect(closedEarly).toBe(false);
        },
      ),
    );
  });
});

describe('enqueue properties', () => {
  it('never grows the queue past its capacity: it keeps the oldest events and refuses the rest', () => {
    fc.assert(
      fc.property(
        events,
        fc.integer({ min: 0, max: MAX_GENERATED_CAPACITY }),
        (input, capacity) => {
          const final = input.reduce<{
            readonly queue: readonly BatchEvent[];
            readonly accepted: readonly boolean[];
          }>(
            (state, event) => {
              const result = enqueue(Object.freeze(state.queue), event, capacity);
              return { queue: result.queue, accepted: [...state.accepted, result.accepted] };
            },
            { queue: [], accepted: [] },
          );

          expect(idsOf(final.queue)).toEqual(idsOf(input.slice(0, capacity)));
          expect(final.accepted).toEqual(input.map((_, index) => index < capacity));
        },
      ),
    );
  });
});
