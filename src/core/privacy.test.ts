import { describe, expect, it } from 'vitest';
import { isDoNotTrack, isTrackingAllowed, trackingStatusOf } from './privacy.js';

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

describe('trackingStatusOf', () => {
  const none = { globalPrivacyControl: false, doNotTrack: false, optedOut: false };

  it('is on when no signal is set', () => {
    expect(trackingStatusOf(none)).toBe('on');
  });

  it('is opted-out when only the visitor opted out', () => {
    expect(trackingStatusOf({ ...none, optedOut: true })).toBe('opted-out');
  });

  it.each(['globalPrivacyControl', 'doNotTrack'] as const)(
    'is blocked-by-browser when %s is set, even after an opt-out',
    (signal) => {
      expect(trackingStatusOf({ ...none, [signal]: true })).toBe('blocked-by-browser');
      expect(trackingStatusOf({ ...none, [signal]: true, optedOut: true })).toBe(
        'blocked-by-browser',
      );
    },
  );
});
