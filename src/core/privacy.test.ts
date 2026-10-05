import { describe, expect, it } from 'vitest';
import { isDoNotTrack, isTrackingAllowed } from './privacy.js';

describe('isDoNotTrack', () => {
  it.each([[['1']], [['yes']], [[null, '1']], [['0', 'yes']]])('is on for %j', (values) => {
    expect(isDoNotTrack(values)).toBe(true);
  });

  it.each([[[]], [[null]], [[undefined]], [['0']], [['unspecified']]])(
    'is off for %j',
    (values) => {
      expect(isDoNotTrack(values)).toBe(false);
    },
  );
});

describe('isTrackingAllowed', () => {
  const none = { globalPrivacyControl: false, doNotTrack: false, optedOut: false };

  it('allows tracking when no signal is set', () => {
    expect(isTrackingAllowed(none)).toBe(true);
  });

  it.each(['globalPrivacyControl', 'doNotTrack', 'optedOut'] as const)(
    'blocks tracking when %s is set',
    (signal) => {
      expect(isTrackingAllowed({ ...none, [signal]: true })).toBe(false);
    },
  );
});
