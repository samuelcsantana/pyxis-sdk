import { isDoNotTrack, OPT_OUT_KEY, OPT_OUT_VALUE, type PrivacySignals } from '../core/privacy.js';
import type { KeyValueStore } from './storage.js';

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function readPrivacySignals(nav: object, win: object, store: KeyValueStore): PrivacySignals {
  return {
    globalPrivacyControl: Reflect.get(nav, 'globalPrivacyControl') === true,
    doNotTrack: isDoNotTrack([
      textOrNull(Reflect.get(nav, 'doNotTrack')),
      textOrNull(Reflect.get(win, 'doNotTrack')),
    ]),
    optedOut: store.read(OPT_OUT_KEY) === OPT_OUT_VALUE,
  };
}
