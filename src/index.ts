import { createBrowserDependencies } from './adapters/browser-dependencies.js';
import { watchNavigation } from './adapters/navigation.js';
import { onPageHide } from './adapters/page-lifecycle.js';
import { readPrivacySignals } from './adapters/privacy-signals.js';
import { webStore } from './adapters/storage.js';
import type { PropertyValue } from './core/batch.js';
import { isBrowserLike } from './core/environment.js';
import { type PyxisOptions, resolveOptions } from './core/options.js';
import { isTrackingAllowed, OPT_OUT_KEY, OPT_OUT_VALUE } from './core/privacy.js';
import { startPageViews } from './page-views.js';
import { createTracker, type Tracker } from './tracker.js';

export type { Batch, BatchAttribution, BatchEvent, PropertyValue } from './core/batch.js';
export type { PyxisDebugOptions, PyxisOptions } from './core/options.js';

export type Properties = Readonly<Record<string, PropertyValue>>;

let started = false;
let debugEnabled = false;
let tracker: Tracker | undefined;
let stoppers: readonly (() => void)[] = [];

function bestEffort(action: () => void): void {
  try {
    action();
  } catch (error) {
    if (debugEnabled) {
      console.warn('[pyxis] ignored an internal error', error);
    }
  }
}

function localStore() {
  return webStore(() => window.localStorage);
}

function stop(): void {
  stoppers.forEach((stopOne) => {
    stopOne();
  });
  tracker?.dispose();
  stoppers = [];
  tracker = undefined;
}

function startAutoPageViews(current: Tracker, pathRules: readonly string[]): () => void {
  return startPageViews(current, pathRules, {
    location: () => window.location,
    referrer: document.referrer,
    watch: (onNavigate) => watchNavigation(onNavigate, window),
    guard: bestEffort,
  });
}

export function init(options: PyxisOptions): void {
  bestEffort(() => {
    if (started || !isBrowserLike(globalThis)) {
      return;
    }
    started = true;
    debugEnabled = options.debug !== undefined;
    const resolution = resolveOptions(options);
    if (!resolution.ok) {
      return;
    }
    if (!isTrackingAllowed(readPrivacySignals(navigator, window, localStore()))) {
      return;
    }
    const current = createTracker(resolution.options, createBrowserDependencies());
    tracker = current;
    const stopFlushingOnHide = onPageHide(() => {
      current.flush(true);
    });
    stoppers = resolution.options.autoPageViews
      ? [stopFlushingOnHide, startAutoPageViews(current, resolution.options.pathRules)]
      : [stopFlushingOnHide];
  });
}

const doNothing = (): undefined => undefined;

export const track: (name: string, properties?: Properties) => void = doNothing;
export const identify: (userId: string) => void = doNothing;
export const reset: () => void = doNothing;

export function optOut(): void {
  bestEffort(() => {
    if (!isBrowserLike(globalThis)) {
      return;
    }
    localStore().write(OPT_OUT_KEY, OPT_OUT_VALUE);
    stop();
  });
}

export function optIn(): void {
  bestEffort(() => {
    if (isBrowserLike(globalThis)) {
      localStore().remove(OPT_OUT_KEY);
    }
  });
}
