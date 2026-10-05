import type { KeyValueStore } from './adapters/storage.js';
import type { Transport } from './adapters/transport.js';
import {
  type Batch,
  type BatchAttribution,
  type BatchEvent,
  buildBatch,
  type PropertyValue,
  serializeBatch,
} from './core/batch.js';
import { chunkEvents, enqueue, FLUSH_DELAY_MS, shouldFlushNow } from './core/batch-policy.js';
import type { ResolvedOptions } from './core/options.js';
import { judgeOutcome, retryDelay, type SendOutcome } from './core/retry-policy.js';
import {
  parseSession,
  type SessionState,
  serializeSession,
  touchSession,
} from './core/session-policy.js';

export const SESSION_KEY = 'pyxis:session';

export interface TrackerDependencies {
  readonly now: () => number;
  readonly createId: () => string;
  readonly random: () => number;
  readonly sessionStore: KeyValueStore;
  readonly transport: Transport;
}

export interface EventInput {
  readonly name: string;
  readonly path: string;
  readonly attribution?: BatchAttribution;
  readonly properties?: Readonly<Record<string, PropertyValue>>;
}

export interface Tracker {
  enqueue(input: EventInput): void;
  flush(pageHidden?: boolean): void;
  dispose(): void;
}

const NETWORK_ERROR: SendOutcome = { kind: 'network-error' };

export function createTracker(options: ResolvedOptions, deps: TrackerDependencies): Tracker {
  let queue: readonly BatchEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  const retryTimers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;

  const touchCurrentSession = (): SessionState => {
    const stored = parseSession(deps.sessionStore.read(SESSION_KEY));
    const { session } = touchSession(stored, deps.now(), deps.createId);
    deps.sessionStore.write(SESSION_KEY, serializeSession(session));
    return session;
  };

  const tryNotifyBatch = (batch: Batch): void => {
    try {
      options.onBatch?.(batch);
    } catch (error) {
      console.warn('[pyxis] debug.onBatch threw; the batch is sent anyway', error);
    }
  };

  const scheduleRetry = (
    events: readonly BatchEvent[],
    attempt: number,
    outcome: SendOutcome,
  ): void => {
    if (disposed || judgeOutcome(outcome) !== 'retry') {
      return;
    }
    const retryAfter = outcome.kind === 'response' ? outcome.retryAfterSeconds : undefined;
    const delay = retryDelay(attempt, deps.random, retryAfter);
    if (delay === undefined) {
      return;
    }
    const timer = setTimeout(() => {
      retryTimers.delete(timer);
      send(events, attempt + 1, false);
    }, delay);
    retryTimers.add(timer);
  };

  const send = (events: readonly BatchEvent[], attempt: number, pageHidden: boolean): void => {
    const batch = buildBatch(options.key, deps.now(), events);
    tryNotifyBatch(batch);
    if (options.dryRun) {
      return;
    }
    void deps.transport.send(options.batchUrl, serializeBatch(batch), pageHidden).then(
      (outcome) => {
        scheduleRetry(events, attempt, outcome);
      },
      () => {
        scheduleRetry(events, attempt, NETWORK_ERROR);
      },
    );
  };

  const flush = (pageHidden = false): void => {
    if (flushTimer !== undefined) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    if (disposed || queue.length === 0) {
      return;
    }
    const { chunks } = chunkEvents(queue, (events) =>
      serializeBatch(buildBatch(options.key, deps.now(), events)),
    );
    queue = [];
    for (const chunk of chunks) {
      send(chunk, 0, pageHidden);
    }
  };

  return {
    enqueue: (input) => {
      if (disposed) {
        return;
      }
      const session = touchCurrentSession();
      const event: BatchEvent = {
        id: deps.createId(),
        name: input.name,
        occurred_at: new Date(deps.now()).toISOString(),
        session_id: session.id,
        path: input.path,
        ...(session.userId === undefined ? {} : { user_id: session.userId }),
        ...(input.attribution === undefined ? {} : { attribution: input.attribution }),
        ...(input.properties === undefined ? {} : { properties: input.properties }),
      };
      queue = enqueue(queue, event).queue;
      if (shouldFlushNow(queue.length)) {
        flush();
        return;
      }
      flushTimer ??= setTimeout(() => {
        flushTimer = undefined;
        flush();
      }, FLUSH_DELAY_MS);
    },
    flush,
    dispose: () => {
      disposed = true;
      queue = [];
      if (flushTimer !== undefined) {
        clearTimeout(flushTimer);
      }
      retryTimers.forEach((timer) => {
        clearTimeout(timer);
      });
      retryTimers.clear();
    },
  };
}
