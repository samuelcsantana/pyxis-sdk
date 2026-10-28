import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  isValidUserId,
  MAX_PROPERTIES,
  MAX_PROPERTY_STRING_LENGTH,
  sanitizeProperties,
} from './event-input.js';

const MAX_GENERATED_ENTRIES = 25;

const propertyKey = fc.oneof(
  fc.stringMatching(/^[a-z0-9_]{1,40}$/),
  fc.constantFrom('__proto__', 'constructor', 'toString', 'hasOwnProperty'),
  fc.string({ unit: 'grapheme', maxLength: 45 }),
);

const propertyValue = fc.oneof(
  fc.boolean(),
  fc.double(),
  fc.string({ unit: 'grapheme', maxLength: 20 }),
  fc.string({
    minLength: MAX_PROPERTY_STRING_LENGTH - 2,
    maxLength: MAX_PROPERTY_STRING_LENGTH + 2,
  }),
  fc.anything(),
);

const propertiesInput = fc
  .array(fc.tuple(propertyKey, propertyValue), { maxLength: MAX_GENERATED_ENTRIES })
  .map((entries): Record<string, unknown> => Object.fromEntries(entries));

function isKeptValue(value: unknown): boolean {
  return (
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (typeof value === 'string' && value.length <= MAX_PROPERTY_STRING_LENGTH)
  );
}

describe('sanitizeProperties properties', () => {
  it(`keeps at most ${String(MAX_PROPERTIES)} properties, each a boolean, a finite number or a short string, for any input`, () => {
    fc.assert(
      fc.property(fc.oneof(fc.anything(), propertiesInput), (input) => {
        const kept = Object.values(sanitizeProperties(input).properties);

        expect(kept.length).toBeLessThanOrEqual(MAX_PROPERTIES);
        expect(kept.every(isKeptValue)).toBe(true);
      }),
    );
  });

  it('accounts for every input key exactly once, as kept or as dropped with a reason', () => {
    fc.assert(
      fc.property(propertiesInput, (input) => {
        const { properties, dropped } = sanitizeProperties(input);
        const keptKeys = Object.keys(properties);
        const accounted = [...keptKeys, ...dropped.map(({ key }) => key)];
        const droppedForCount = dropped.filter(({ reason }) => reason === 'too_many');

        expect(accounted.sort()).toEqual(Object.keys(input).sort());
        expect(droppedForCount.length === 0 || keptKeys.length === MAX_PROPERTIES).toBe(true);
      }),
    );
  });
});

describe('isValidUserId properties', () => {
  it('never accepts a user id that carries an e-mail address, nor anything but a string', () => {
    const carriesEmail = fc
      .tuple(fc.string(), fc.emailAddress(), fc.string())
      .map((parts) => parts.join(''));
    const notAString = fc.anything().filter((value) => typeof value !== 'string');

    fc.assert(
      fc.property(fc.oneof(carriesEmail, notAString), (userId) => {
        expect(isValidUserId(userId)).toBe(false);
      }),
    );
  });
});
