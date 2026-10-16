import { describe, expect, it } from 'vitest';
import { isDoNotTrack, isTrackingAllowed, trackingStatusOf } from './privacy.js';

const NO_SIGNAL = {
  globalPrivacyControl: false,
  doNotTrack: false,
  optedOut: false,
  automated: false,
};

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
  it('allows tracking when no signal is set', () => {
    expect(isTrackingAllowed(NO_SIGNAL)).toBe(true);
  });

  it.each(['globalPrivacyControl', 'doNotTrack', 'optedOut', 'automated'] as const)(
    'blocks tracking when %s is set',
    (signal) => {
      expect(isTrackingAllowed({ ...NO_SIGNAL, [signal]: true })).toBe(false);
    },
  );
});

describe('trackingStatusOf', () => {
  it('is on when no signal is set', () => {
    expect(trackingStatusOf(NO_SIGNAL)).toBe('on');
  });

  it('is opted-out when only the visitor opted out', () => {
    expect(trackingStatusOf({ ...NO_SIGNAL, optedOut: true })).toBe('opted-out');
  });

  it.each(['globalPrivacyControl', 'doNotTrack'] as const)(
    'is blocked-by-browser when %s is set, even after an opt-out',
    (signal) => {
      expect(trackingStatusOf({ ...NO_SIGNAL, [signal]: true })).toBe('blocked-by-browser');
      expect(trackingStatusOf({ ...NO_SIGNAL, [signal]: true, optedOut: true })).toBe(
        'blocked-by-browser',
      );
    },
  );

  it('ignores automation, which is no choice a visitor can make or undo with a switch', () => {
    expect(trackingStatusOf({ ...NO_SIGNAL, automated: true })).toBe('on');
    expect(trackingStatusOf({ ...NO_SIGNAL, automated: true, optedOut: true })).toBe('opted-out');
  });
});
