import type { TrackerDependencies } from '../tracker.js';
import { createUuid } from './ids.js';
import { webStore } from './storage.js';
import { browserTransport } from './transport.js';

export function createBrowserDependencies(): TrackerDependencies {
  return {
    now: () => Date.now(),
    createId: () => createUuid(globalThis.crypto),
    random: Math.random,
    sessionStore: webStore(() => window.sessionStorage),
    transport: browserTransport(
      typeof fetch === 'function' ? fetch.bind(globalThis) : undefined,
      typeof navigator.sendBeacon === 'function' ? navigator.sendBeacon.bind(navigator) : undefined,
    ),
  };
}
