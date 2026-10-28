import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseRetryAfter, RETRY_DELAYS_MS, RETRY_JITTER, retryDelay } from './retry-policy.js';

const MAX_GENERATED_RETRY_AFTER_SECONDS = 86_400;
const MAX_GENERATED_DIGITS = 400;
const MAX_GENERATED_ATTEMPT = 1000;
const MILLISECONDS_PER_SECOND = 1000;

const randomValue = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });

const scheduledAttempt = fc.constantFrom(
  ...RETRY_DELAYS_MS.map((base, attempt) => ({ attempt, base })),
);

const jitterBounds = (base: number) => ({
  lowest: Math.round(base * (1 - RETRY_JITTER)),
  highest: Math.round(base * (1 + RETRY_JITTER)),
});

const padding = fc.constantFrom('', ' ', '  ', '\t');

const digits = fc
  .array(fc.nat({ max: 9 }), {
    minLength: 1,
    maxLength: MAX_GENERATED_DIGITS,
    size: 'max',
  })
  .map((values) => values.join(''));

describe('retryDelay properties', () => {
  it('waits a whole number of milliseconds within the jitter of the attempt base delay', () => {
    fc.assert(
      fc.property(scheduledAttempt, randomValue, ({ attempt, base }, random) => {
        const delay = retryDelay(attempt, () => random);
        const { lowest, highest } = jitterBounds(base);

        expect(Number.isInteger(delay)).toBe(true);
        expect(delay).toBeGreaterThanOrEqual(lowest);
        expect(delay).toBeLessThanOrEqual(highest);
      }),
    );
  });

  it('never waits less than Retry-After asks nor less than the jittered delay, and no longer than the larger of the two', () => {
    fc.assert(
      fc.property(
        scheduledAttempt,
        randomValue,
        fc.nat({ max: MAX_GENERATED_RETRY_AFTER_SECONDS }),
        ({ attempt }, random, retryAfterSeconds) => {
          const delay = retryDelay(attempt, () => random, retryAfterSeconds);
          const jittered = retryDelay(attempt, () => random);
          const asked = retryAfterSeconds * MILLISECONDS_PER_SECOND;

          expect(delay).toBeGreaterThanOrEqual(asked);
          expect(delay).toBeGreaterThanOrEqual(jittered ?? Number.POSITIVE_INFINITY);
          expect([asked, jittered]).toContain(delay);
        },
      ),
    );
  });

  it('gives up for any attempt outside the schedule', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: RETRY_DELAYS_MS.length, max: MAX_GENERATED_ATTEMPT }),
          fc.integer({ min: -MAX_GENERATED_ATTEMPT, max: -1 }),
        ),
        randomValue,
        (attempt, random) => {
          expect(retryDelay(attempt, () => random)).toBeUndefined();
        },
      ),
    );
  });
});

describe('parseRetryAfter properties', () => {
  it('returns nothing or a non-negative safe integer, for any header', () => {
    const header = fc.oneof(
      fc.constant(null),
      fc.string({ unit: 'grapheme' }),
      fc.tuple(padding, digits, padding).map((parts) => parts.join('')),
    );

    fc.assert(
      fc.property(header, (value) => {
        const seconds = parseRetryAfter(value);

        expect(seconds === undefined || (Number.isSafeInteger(seconds) && seconds >= 0)).toBe(true);
      }),
    );
  });

  it('reads back any non-negative safe integer written in decimal, with spaces around it', () => {
    fc.assert(
      fc.property(fc.maxSafeNat(), padding, padding, (seconds, before, after) => {
        expect(parseRetryAfter(`${before}${String(seconds)}${after}`)).toBe(seconds);
      }),
    );
  });
});
