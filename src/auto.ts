import { listenToDocument } from './adapters/dom-events.js';
import {
  type AutoEvent,
  type AutoEventsOptions,
  formEventOf,
  linkEventOf,
  resolveAutoEvents,
  watchesLinks,
} from './core/auto-events.js';
import { isBrowserLike } from './core/environment.js';
import { track, trackingStatus } from './index.js';

export type { AutoEventsOptions } from './core/auto-events.js';

const BLOCKED_BY_BROWSER = 'blocked-by-browser';

const NOTHING_TO_STOP = (): void => undefined;

let stopCurrent: () => void = NOTHING_TO_STOP;
let debugEnabled = false;

function bestEffort(action: () => void): void {
  try {
    action();
  } catch (error) {
    if (debugEnabled) {
      console.warn('[pyxis] automatic events ignored an internal error', error);
    }
  }
}

function send(event: AutoEvent | undefined): void {
  if (event !== undefined) {
    track(event.name, event.properties);
  }
}

function listen(options: AutoEventsOptions): () => void {
  const resolved = resolveAutoEvents(options);
  return listenToDocument(document, {
    ...(watchesLinks(resolved)
      ? {
          onLink: (link) => {
            bestEffort(() => {
              send(
                linkEventOf(
                  { ...link, baseUrl: document.baseURI, ownHost: window.location.hostname },
                  resolved,
                ),
              );
            });
          },
        }
      : {}),
    ...(resolved.formSubmits
      ? {
          onForm: (form) => {
            bestEffort(() => {
              send(formEventOf(form));
            });
          },
        }
      : {}),
  });
}

export function autoEvents(options: AutoEventsOptions): () => void {
  stopCurrent();
  bestEffort(() => {
    debugEnabled = options.debug === true;
    const isObservable = isBrowserLike(globalThis) && trackingStatus() !== BLOCKED_BY_BROWSER;
    stopCurrent = isObservable ? listen(options) : NOTHING_TO_STOP;
  });
  return stopCurrent;
}
