import { describe, expect, it } from 'vitest';
import {
  checkEventName,
  isValidUserId,
  MAX_PROPERTIES,
  MAX_PROPERTY_STRING_LENGTH,
  sanitizeProperties,
} from './event-input.js';

describe('checkEventName', () => {
  it.each(['calculator_result_shown', 'signup', 'a', `a${'b'.repeat(63)}`])(
    'accepts %s',
    (name) => {
      expect(checkEventName(name)).toBe('ok');
    },
  );

  it.each(['page_view', 'identify', 'api_request'])('refuses the reserved name %s', (name) => {
    expect(checkEventName(name)).toBe('reserved');
  });

  it.each(['SignUp', '1st_step', 'sign-up', '', `a${'b'.repeat(64)}`, 42, undefined])(
    'refuses %j as invalid',
    (name) => {
      expect(checkEventName(name)).toBe('invalid');
    },
  );
});

describe('isValidUserId', () => {
  it.each(['user_42', '4821', 'a-b_C'])('accepts %s', (userId) => {
    expect(isValidUserId(userId)).toBe(true);
  });

  it.each(['ana@example.com', 'ana souza', '', 'u'.repeat(65), 42, null])(
    'refuses %j',
    (userId) => {
      expect(isValidUserId(userId)).toBe(false);
    },
  );
});

describe('sanitizeProperties', () => {
  it('keeps short strings, finite numbers and booleans', () => {
    expect(sanitizeProperties({ plan: 'pro', seats: 3, trial: true, ratio: -0.5 })).toEqual({
      properties: { plan: 'pro', seats: 3, trial: true, ratio: -0.5 },
      dropped: [],
    });
  });

  it('drops each invalid property on its own and keeps the rest', () => {
    expect(
      sanitizeProperties({
        plan: 'pro',
        'Bad Key': 1,
        nested: { a: 1 },
        list: [1],
        missing: undefined,
        empty: null,
        infinite: Number.POSITIVE_INFINITY,
        nan: Number.NaN,
        long: 'x'.repeat(MAX_PROPERTY_STRING_LENGTH + 1),
      }),
    ).toEqual({
      properties: { plan: 'pro' },
      dropped: [
        { key: 'Bad Key', reason: 'invalid_key' },
        { key: 'nested', reason: 'invalid_value' },
        { key: 'list', reason: 'invalid_value' },
        { key: 'missing', reason: 'invalid_value' },
        { key: 'empty', reason: 'invalid_value' },
        { key: 'infinite', reason: 'invalid_value' },
        { key: 'nan', reason: 'invalid_value' },
        { key: 'long', reason: 'invalid_value' },
      ],
    });
  });

  it(`keeps the first ${String(MAX_PROPERTIES)} valid properties and drops the others`, () => {
    const input = Object.fromEntries(
      Array.from({ length: MAX_PROPERTIES + 2 }, (_, index) => [`key_${String(index)}`, index]),
    );

    const { properties, dropped } = sanitizeProperties(input);

    expect(Object.keys(properties)).toHaveLength(MAX_PROPERTIES);
    expect(dropped).toEqual([
      { key: 'key_10', reason: 'too_many' },
      { key: 'key_11', reason: 'too_many' },
    ]);
  });

  it.each([undefined, null, 'text', 3])('treats %j as no properties', (input) => {
    expect(sanitizeProperties(input)).toEqual({ properties: {}, dropped: [] });
  });
});
