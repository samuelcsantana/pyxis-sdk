import { describe, expect, it } from 'vitest';
import { OPT_OUT_KEY, OPT_OUT_VALUE } from '../core/privacy.js';
import { readPrivacySignals } from './privacy-signals.js';
import { memoryStore } from './storage.js';

describe('readPrivacySignals', () => {
  it('reports no signal on a default browser', () => {
    expect(readPrivacySignals({}, {}, memoryStore())).toEqual({
      globalPrivacyControl: false,
      doNotTrack: false,
      optedOut: false,
    });
  });

  it('reads Global Privacy Control', () => {
    expect(readPrivacySignals({ globalPrivacyControl: true }, {}, memoryStore())).toMatchObject({
      globalPrivacyControl: true,
    });
  });

  it('reads Do Not Track from the navigator or from the window', () => {
    expect(readPrivacySignals({ doNotTrack: '1' }, {}, memoryStore()).doNotTrack).toBe(true);
    expect(readPrivacySignals({}, { doNotTrack: '1' }, memoryStore()).doNotTrack).toBe(true);
  });

  it('reads the opt-out marker from storage', () => {
    const store = memoryStore();
    store.write(OPT_OUT_KEY, OPT_OUT_VALUE);

    expect(readPrivacySignals({}, {}, store).optedOut).toBe(true);
  });
});
