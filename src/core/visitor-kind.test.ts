import { describe, expect, it } from 'vitest';
import {
  parseStoredPeriod,
  parseVisitorPeriod,
  PERIOD_KEY,
  periodAnswerOf,
  serializePeriod,
  type VisitorPeriod,
  visitorKindOf,
} from './visitor-kind.js';

const PERIOD: VisitorPeriod = {
  day_ends_at: '2026-11-03T03:00:00.000Z',
  month_ends_at: '2026-12-01T03:00:00.000Z',
};
const DAY_END = Date.parse(PERIOD.day_ends_at);
const MONTH_END = Date.parse(PERIOD.month_ends_at);
const INGEST_RESULT = { accepted: 1, duplicates: 0, rejected: 0 };

describe('visitorKindOf', () => {
  it('calls a visit without a marker the first of this browser', () => {
    expect(visitorKindOf(undefined, DAY_END)).toBe('first_visit');
  });

  it('calls a visit before the day ends another one today', () => {
    expect(visitorKindOf(PERIOD, DAY_END - 1)).toBe('again_today');
  });

  it('calls a visit from the instant the day ends until the month ends the first today', () => {
    expect(visitorKindOf(PERIOD, DAY_END)).toBe('first_today');
    expect(visitorKindOf(PERIOD, MONTH_END - 1)).toBe('first_today');
  });

  it('calls a visit from the instant the month ends the first this month', () => {
    expect(visitorKindOf(PERIOD, MONTH_END)).toBe('first_this_month');
    expect(visitorKindOf(PERIOD, MONTH_END + 40 * 24 * 60 * 60 * 1000)).toBe('first_this_month');
  });

  it('calls a visit on the last day of the month the first this month once the month ends', () => {
    const lastDay = { day_ends_at: PERIOD.month_ends_at, month_ends_at: PERIOD.month_ends_at };

    expect(visitorKindOf(lastDay, MONTH_END - 1)).toBe('again_today');
    expect(visitorKindOf(lastDay, MONTH_END)).toBe('first_this_month');
  });
});

describe('parseVisitorPeriod', () => {
  it('keeps the two instants the API answered', () => {
    expect(parseVisitorPeriod(PERIOD)).toEqual(PERIOD);
  });

  it('accepts instants without milliseconds', () => {
    const period = { day_ends_at: '2026-11-03T03:00:00Z', month_ends_at: '2026-12-01T03:00:00Z' };

    expect(parseVisitorPeriod(period)).toEqual(period);
  });

  it('keeps only the two instants when the value carries more', () => {
    expect(parseVisitorPeriod({ ...PERIOD, visits: 3, last_visit_at: PERIOD.day_ends_at })).toEqual(
      PERIOD,
    );
  });

  it('accepts a day that ends with the month', () => {
    const lastDay = { day_ends_at: PERIOD.month_ends_at, month_ends_at: PERIOD.month_ends_at };

    expect(parseVisitorPeriod(lastDay)).toEqual(lastDay);
  });

  it('refuses a day that ends after the month', () => {
    expect(
      parseVisitorPeriod({ day_ends_at: PERIOD.month_ends_at, month_ends_at: PERIOD.day_ends_at }),
    ).toBeUndefined();
  });

  it.each([
    ['a value that is not an object', 'not a period'],
    ['null', null],
    ['a missing day', { month_ends_at: PERIOD.month_ends_at }],
    ['a missing month', { day_ends_at: PERIOD.day_ends_at }],
    ['a day that is a number', { day_ends_at: DAY_END, month_ends_at: PERIOD.month_ends_at }],
    ['a month that is a number', { day_ends_at: PERIOD.day_ends_at, month_ends_at: MONTH_END }],
    [
      'an instant with an offset instead of Z',
      { day_ends_at: '2026-11-03T00:00:00-03:00', month_ends_at: PERIOD.month_ends_at },
    ],
    ['a date without a time', { day_ends_at: '2026-11-03', month_ends_at: '2026-12-01' }],
    [
      'an instant that does not exist',
      { day_ends_at: '2026-13-03T03:00:00.000Z', month_ends_at: PERIOD.month_ends_at },
    ],
    ['words', { day_ends_at: 'tomorrow', month_ends_at: 'next month' }],
  ])('refuses %s', (_case, value) => {
    expect(parseVisitorPeriod(value)).toBeUndefined();
  });
});

describe('parseStoredPeriod and serializePeriod', () => {
  it('stores the marker under pyxis:period', () => {
    expect(PERIOD_KEY).toBe('pyxis:period');
  });

  it('serializes only the two instants and reads them back', () => {
    const periodWithMore = { ...PERIOD, last_visit_at: PERIOD.day_ends_at };
    const stored = serializePeriod(periodWithMore);

    expect(JSON.parse(stored)).toEqual(PERIOD);
    expect(parseStoredPeriod(stored)).toEqual(PERIOD);
  });

  it('reads no marker when nothing is stored', () => {
    expect(parseStoredPeriod(null)).toBeUndefined();
  });

  it('reads no marker from a stored value that is not JSON or not a period', () => {
    expect(parseStoredPeriod('{"day_ends_at":')).toBeUndefined();
    expect(parseStoredPeriod('"2026-11-03T03:00:00.000Z"')).toBeUndefined();
  });
});

describe('periodAnswerOf', () => {
  it('reads the period of an answer that carries it', () => {
    expect(periodAnswerOf(JSON.stringify({ ...INGEST_RESULT, visitor_period: PERIOD }))).toEqual(
      PERIOD,
    );
  });

  it('reads an answer without a period as the option being off', () => {
    expect(periodAnswerOf(JSON.stringify(INGEST_RESULT))).toBe('off');
  });

  it('decides nothing from an answer whose period is malformed', () => {
    expect(
      periodAnswerOf(JSON.stringify({ ...INGEST_RESULT, visitor_period: { day_ends_at: 'soon' } })),
    ).toBeUndefined();
    expect(
      periodAnswerOf(JSON.stringify({ ...INGEST_RESULT, visitor_period: null })),
    ).toBeUndefined();
  });

  it.each([
    ['an empty body', ''],
    ['a body that is not JSON', '<html>proxy</html>'],
    ['a JSON value that is not an object', '202'],
    ['an object that is not the answer to a batch', '{}'],
    ['an answer whose count is not a number', '{"accepted":"1"}'],
  ])('decides nothing from %s', (_case, body) => {
    expect(periodAnswerOf(body)).toBeUndefined();
  });
});
