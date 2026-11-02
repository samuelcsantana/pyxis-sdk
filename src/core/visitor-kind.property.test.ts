import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  parseStoredPeriod,
  parseVisitorPeriod,
  periodAnswerOf,
  serializePeriod,
  visitorKindOf,
} from './visitor-kind.js';

const EARLIEST = Date.UTC(2000, 0, 1);
const LATEST = Date.UTC(2100, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MONTH_MS = 31 * DAY_MS;

const instant = fc.integer({ min: EARLIEST, max: LATEST });

const period = fc
  .tuple(instant, fc.integer({ min: 0, max: MAX_MONTH_MS }))
  .map(([dayEnd, untilMonthEnd]) => ({
    day_ends_at: new Date(dayEnd).toISOString(),
    month_ends_at: new Date(dayEnd + untilMonthEnd).toISOString(),
  }));

const garbage = fc.oneof(
  fc.anything(),
  fc.record({ day_ends_at: fc.anything(), month_ends_at: fc.anything() }),
  fc.record({ day_ends_at: fc.string(), month_ends_at: fc.string() }),
);

describe('visitorKindOf, for any period and any device clock', () => {
  it('follows the day and month boundaries, with the month first', () => {
    fc.assert(
      fc.property(period, instant, (marker, now) => {
        const dayEnd = Date.parse(marker.day_ends_at);
        const monthEnd = Date.parse(marker.month_ends_at);
        const expected =
          now >= monthEnd ? 'first_this_month' : now >= dayEnd ? 'first_today' : 'again_today';

        expect(visitorKindOf(marker, now)).toBe(expected);
      }),
    );
  });

  it('changes kind exactly at each boundary', () => {
    fc.assert(
      fc.property(period, (marker) => {
        const dayEnd = Date.parse(marker.day_ends_at);
        const monthEnd = Date.parse(marker.month_ends_at);

        expect(visitorKindOf(marker, dayEnd - 1)).toBe('again_today');
        expect(visitorKindOf(marker, monthEnd)).toBe('first_this_month');
        if (dayEnd < monthEnd) {
          expect(visitorKindOf(marker, dayEnd)).toBe('first_today');
          expect(visitorKindOf(marker, monthEnd - 1)).toBe('first_today');
        }
      }),
    );
  });

  it('calls every visit without a marker the first of this browser', () => {
    fc.assert(
      fc.property(instant, (now) => {
        expect(visitorKindOf(undefined, now)).toBe('first_visit');
      }),
    );
  });
});

describe('the marker, for any period the API can answer', () => {
  it('survives storage unchanged', () => {
    fc.assert(
      fc.property(period, (marker) => {
        expect(parseStoredPeriod(serializePeriod(marker))).toEqual(marker);
      }),
    );
  });

  it('is read from an answer that carries it', () => {
    fc.assert(
      fc.property(period, (marker) => {
        const body = JSON.stringify({
          accepted: 1,
          duplicates: 0,
          rejected: 0,
          visitor_period: marker,
        });

        expect(periodAnswerOf(body)).toEqual(marker);
      }),
    );
  });
});

describe('garbage, stored or answered', () => {
  it('is never a marker, and a marker read from it never ends a day after its month', () => {
    fc.assert(
      fc.property(garbage, (value) => {
        const parsed = parseVisitorPeriod(value);
        if (parsed !== undefined) {
          expect(Object.keys(parsed).sort()).toEqual(['day_ends_at', 'month_ends_at']);
          expect(Date.parse(parsed.day_ends_at)).toBeLessThanOrEqual(
            Date.parse(parsed.month_ends_at),
          );
        }
      }),
    );
  });

  it('read back from storage never throws', () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(() => parseStoredPeriod(raw)).not.toThrow();
      }),
    );
  });

  it('as an answer body never deletes the marker unless it is the answer to a batch', () => {
    const notAnAnswer = fc.oneof(fc.string(), fc.json()).filter((body) => {
      try {
        const value: unknown = JSON.parse(body);
        return !(typeof value === 'object' && value !== null && 'accepted' in value);
      } catch {
        return true;
      }
    });

    fc.assert(
      fc.property(notAnAnswer, (body) => {
        expect(periodAnswerOf(body)).toBeUndefined();
      }),
    );
  });
});
