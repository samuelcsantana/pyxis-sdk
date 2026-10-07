export const OPT_OUT_KEY = 'pyxis:opt-out';
export const OPT_OUT_VALUE = '1';

const DO_NOT_TRACK_VALUES = new Set(['1', 'yes']);

export interface PrivacySignals {
  readonly globalPrivacyControl: boolean;
  readonly doNotTrack: boolean;
  readonly optedOut: boolean;
}

export function isDoNotTrack(values: readonly (string | null | undefined)[]): boolean {
  return values.some(
    (value) => value !== null && value !== undefined && DO_NOT_TRACK_VALUES.has(value),
  );
}

export type TrackingStatus = 'on' | 'opted-out' | 'blocked-by-browser';

export function trackingStatusOf(signals: PrivacySignals): TrackingStatus {
  if (signals.globalPrivacyControl || signals.doNotTrack) {
    return 'blocked-by-browser';
  }
  return signals.optedOut ? 'opted-out' : 'on';
}

export function isTrackingAllowed(signals: PrivacySignals): boolean {
  return trackingStatusOf(signals) === 'on';
}
