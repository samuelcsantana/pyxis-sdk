import { createBrowserDependencies } from './adapters/browser-dependencies.js';
import { watchNavigation } from './adapters/navigation.js';
import { onPageHide } from './adapters/page-lifecycle.js';
import { readPrivacySignals } from './adapters/privacy-signals.js';
import { webStore } from './adapters/storage.js';
import type { PropertyValue } from './core/batch.js';
import { isBrowserLike } from './core/environment.js';
import { checkEventName, isValidUserId, sanitizeProperties } from './core/event-input.js';
import { type PyxisOptions, resolveOptions } from './core/options.js';
import { templatePath } from './core/path-template.js';
import {
  API_REQUEST_EVENT,
  checkTrackedRequest,
  type TrackedRequest,
} from './core/tracked-request.js';
import {
  isTrackingAllowed,
  OPT_OUT_KEY,
  OPT_OUT_VALUE,
  type PrivacySignals,
  type TrackingStatus,
  trackingStatusOf,
} from './core/privacy.js';
import { startPageViews } from './page-views.js';
import { createTracker, type Tracker } from './tracker.js';

export type { Batch, BatchAttribution, BatchEvent, PropertyValue } from './core/batch.js';
export type { PyxisDebugOptions, PyxisOptions } from './core/options.js';
export type { TrackingStatus } from './core/privacy.js';
export type { RequestMethod, TrackedRequest } from './core/tracked-request.js';

export type Properties = Readonly<Record<string, PropertyValue>>;

let started = false;
let debugEnabled = false;
let tracker: Tracker | undefined;
let stoppers: readonly (() => void)[] = [];
let pathRules: readonly string[] = [];
let optedOutThisPage = false;

function guarded<Result>(action: () => Result, fallback: Result): Result {
  try {
    return action();
  } catch (error) {
    if (debugEnabled) {
      console.warn('[pyxis] ignored an internal error', error);
    }
    return fallback;
  }
}

function bestEffort(action: () => void): void {
  guarded(action, undefined);
}

function debugWarn(message: string): void {
  if (debugEnabled) {
    console.warn(`[pyxis] ${message}`);
  }
}

function currentPath(): string {
  return templatePath(window.location.pathname, pathRules);
}

function localStore() {
  return webStore(() => window.localStorage);
}

function currentPrivacySignals(): PrivacySignals {
  const signals = readPrivacySignals(navigator, window, localStore());
  return { ...signals, optedOut: signals.optedOut || optedOutThisPage };
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
    if (!isTrackingAllowed(currentPrivacySignals())) {
      return;
    }
    const current = createTracker(resolution.options, createBrowserDependencies());
    pathRules = resolution.options.pathRules;
    tracker = current;
    const stopFlushingOnHide = onPageHide(() => {
      current.flush(true);
    });
    stoppers = resolution.options.autoPageViews
      ? [stopFlushingOnHide, startAutoPageViews(current, pathRules)]
      : [stopFlushingOnHide];
  });
}

export function track(name: string, properties?: Properties): void {
  bestEffort(() => {
    if (tracker === undefined) {
      return;
    }
    const nameCheck = checkEventName(name);
    if (nameCheck !== 'ok') {
      const why =
        nameCheck === 'reserved' ? 'is reserved for the SDK' : 'is not a valid event name';
      debugWarn(`track() ignored "${name}": the name ${why}`);
      return;
    }
    const sanitized = sanitizeProperties(properties);
    for (const { key, reason } of sanitized.dropped) {
      debugWarn(`track("${name}") dropped the property "${key}" (${reason})`);
    }
    const hasProperties = Object.keys(sanitized.properties).length > 0;
    tracker.enqueue({
      name,
      path: currentPath(),
      ...(hasProperties ? { properties: sanitized.properties } : {}),
    });
  });
}

export function identify(userId: string): void {
  bestEffort(() => {
    if (tracker === undefined) {
      return;
    }
    if (!isValidUserId(userId)) {
      debugWarn('identify() ignored a user id outside [A-Za-z0-9_-]{1,64}; never pass an email');
      return;
    }
    tracker.identify(userId, currentPath());
  });
}

export function reset(): void {
  bestEffort(() => {
    tracker?.reset();
  });
}

export function trackRequest(request: TrackedRequest): void {
  bestEffort(() => {
    if (tracker === undefined) {
      return;
    }
    const check = checkTrackedRequest(request, pathRules);
    if (!check.ok) {
      debugWarn(`trackRequest() ignored a request with an invalid ${check.reason}`);
      return;
    }
    if (check.droppedErrorCode) {
      debugWarn('trackRequest() dropped an errorCode outside [a-z0-9_.]{1,64}');
    }
    tracker.enqueue({ name: API_REQUEST_EVENT, path: currentPath(), properties: check.properties });
  });
}

export function optOut(): void {
  bestEffort(() => {
    if (!isBrowserLike(globalThis)) {
      return;
    }
    optedOutThisPage = true;
    localStore().write(OPT_OUT_KEY, OPT_OUT_VALUE);
    stop();
  });
}

export function trackingStatus(): TrackingStatus {
  return guarded(
    () => (isBrowserLike(globalThis) ? trackingStatusOf(currentPrivacySignals()) : 'on'),
    'on',
  );
}

export function optIn(): void {
  bestEffort(() => {
    if (isBrowserLike(globalThis)) {
      optedOutThisPage = false;
      localStore().remove(OPT_OUT_KEY);
    }
  });
}
