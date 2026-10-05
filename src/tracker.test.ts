import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type KeyValueStore, memoryStore } from './adapters/storage.js';
import type { Transport } from './adapters/transport.js';
import type { Batch } from './core/batch.js';
import { FLUSH_DELAY_MS, FLUSH_EVENT_COUNT } from './core/batch-policy.js';
import type { ResolvedOptions } from './core/options.js';
import { RETRY_DELAYS_MS, type SendOutcome } from './core/retry-policy.js';
import { SESSION_IDLE_TIMEOUT_MS } from './core/session-policy.js';
import { createTracker, SESSION_KEY, type TrackerDependencies } from './tracker.js';

const START = Date.UTC(2026, 9, 6, 14, 3, 10, 4);

const OPTIONS: ResolvedOptions = {
  key: 'pk_live_test',
  batchUrl: 'https://api.pyxis.example.com/v1/batch',
  pathRules: [],
  autoPageViews: true,
  dryRun: false,
};

interface Sent {
  readonly url: string;
  readonly batch: Batch;
  readonly pageHidden: boolean;
}

function fakeTransport(outcomes: SendOutcome[] = []) {
  const sent: Sent[] = [];
  const transport: Transport = {
    send: (url, body, pageHidden) => {
      sent.push({ url, batch: JSON.parse(body) as Batch, pageHidden });
      return Promise.resolve(outcomes.shift() ?? { kind: 'response', status: 202 });
    },
  };
  return { transport, sent };
}

function setup(
  options: Partial<ResolvedOptions> = {},
  outcomes: SendOutcome[] = [],
  sessionStore: KeyValueStore = memoryStore(),
) {
  let nextId = 0;
  const { transport, sent } = fakeTransport(outcomes);
  const deps: TrackerDependencies = {
    now: () => Date.now(),
    createId: () => `id-${String(++nextId)}`,
    random: () => 0.5,
    sessionStore,
    transport,
  };
  return { tracker: createTracker({ ...OPTIONS, ...options }, deps), sent, sessionStore };
}

async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe('createTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends queued events in one batch five seconds after the first one', async () => {
    const { tracker, sent } = setup();

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.enqueue({ name: 'cta_clicked', path: '/', properties: { cta: 'start_trial' } });
    await vi.advanceTimersByTimeAsync(FLUSH_DELAY_MS - 1);
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(OPTIONS.batchUrl);
    expect(sent[0]?.batch).toEqual({
      key: 'pk_live_test',
      sent_at: new Date(START + FLUSH_DELAY_MS).toISOString(),
      events: [
        {
          id: 'id-2',
          name: 'page_view',
          occurred_at: new Date(START).toISOString(),
          session_id: 'id-1',
          path: '/',
        },
        {
          id: 'id-3',
          name: 'cta_clicked',
          occurred_at: new Date(START).toISOString(),
          session_id: 'id-1',
          path: '/',
          properties: { cta: 'start_trial' },
        },
      ],
    });
  });

  it('sends at once when ten events are queued', () => {
    const { tracker, sent } = setup();

    for (let index = 0; index < FLUSH_EVENT_COUNT; index += 1) {
      tracker.enqueue({ name: 'page_view', path: `/${String(index)}` });
    }

    expect(sent).toHaveLength(1);
    expect(sent[0]?.batch.events).toHaveLength(FLUSH_EVENT_COUNT);
  });

  it('flushes on demand and tells the transport when the page is hiding', () => {
    const { tracker, sent } = setup();

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush(true);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.pageHidden).toBe(true);
  });

  it('sends nothing when the queue is empty', () => {
    const { tracker, sent } = setup();

    tracker.flush();

    expect(sent).toHaveLength(0);
  });

  it('attaches attribution and the identified user when present', () => {
    const store = memoryStore();
    store.write(
      SESSION_KEY,
      JSON.stringify({ id: 'visit', lastActivityAt: START, userId: 'u_42' }),
    );
    const { tracker, sent } = setup({}, [], store);

    tracker.enqueue({
      name: 'page_view',
      path: '/pricing',
      attribution: { from_ad_click: true, referrer_host: 'google.com' },
    });
    tracker.flush();

    expect(sent[0]?.batch.events[0]).toMatchObject({
      session_id: 'visit',
      user_id: 'u_42',
      attribution: { from_ad_click: true, referrer_host: 'google.com' },
    });
  });

  it('keeps the visit while active and starts a new one after 30 minutes idle', async () => {
    const { tracker, sent, sessionStore } = setup();

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_TIMEOUT_MS + 1);
    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();

    expect(sent.map((entry) => entry.batch.events[0]?.session_id)).toEqual(['id-1', 'id-3']);
    expect(JSON.parse(sessionStore.read(SESSION_KEY) ?? '{}')).toMatchObject({ id: 'id-3' });
  });

  it('retries a failed batch with the same event ids and a fresh sent_at', async () => {
    const { tracker, sent } = setup({}, [{ kind: 'response', status: 503 }]);

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    await settle();
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] ?? 0);

    expect(sent).toHaveLength(2);
    expect(sent[1]?.batch.events).toEqual(sent[0]?.batch.events);
    expect(sent[1]?.batch.sent_at).toBe(new Date(START + (RETRY_DELAYS_MS[0] ?? 0)).toISOString());
    expect(sent[1]?.pageHidden).toBe(false);
  });

  it('gives up after five retries', async () => {
    const failures: SendOutcome[] = Array.from({ length: 10 }, () => ({
      kind: 'network-error',
    }));
    const { tracker, sent } = setup({}, failures);

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    for (const delay of RETRY_DELAYS_MS) {
      await settle();
      await vi.advanceTimersByTimeAsync(delay);
    }
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sent).toHaveLength(RETRY_DELAYS_MS.length + 1);
  });

  it('waits as long as Retry-After asks on a 429', async () => {
    const { tracker, sent } = setup({}, [{ kind: 'response', status: 429, retryAfterSeconds: 30 }]);

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    await settle();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(sent).toHaveLength(2);
  });

  it('drops a batch the API rejects as invalid', async () => {
    const { tracker, sent } = setup({}, [{ kind: 'response', status: 400 }]);

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sent).toHaveLength(1);
  });

  it('treats a transport that rejects as a network error and retries', async () => {
    let calls = 0;
    const deps: TrackerDependencies = {
      now: () => Date.now(),
      createId: () => 'id',
      random: () => 0.5,
      sessionStore: memoryStore(),
      transport: {
        send: () => {
          calls += 1;
          return calls === 1
            ? Promise.reject(new Error('boom'))
            : Promise.resolve({ kind: 'response', status: 202 });
        },
      },
    };
    const tracker = createTracker(OPTIONS, deps);

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    await settle();
    await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] ?? 0);

    expect(calls).toBe(2);
  });

  it('only hands batches to the debug callback in dry-run mode', () => {
    const onBatch = vi.fn();
    const { tracker, sent } = setup({ dryRun: true, onBatch });

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();

    expect(onBatch).toHaveBeenCalledWith(expect.objectContaining({ key: 'pk_live_test' }));
    expect(sent).toHaveLength(0);
  });

  it('still sends when the debug callback throws, and warns about it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { tracker, sent } = setup({
      onBatch: () => {
        throw new Error('callback bug');
      },
    });

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();

    expect(sent).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('debug.onBatch'), expect.any(Error));
  });

  it('drops everything and sends nothing more once disposed', async () => {
    const { tracker, sent } = setup({}, [{ kind: 'response', status: 503 }]);

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    await settle();
    tracker.enqueue({ name: 'page_view', path: '/next' });
    tracker.dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    tracker.enqueue({ name: 'page_view', path: '/after' });
    tracker.flush();

    expect(sent).toHaveLength(1);
  });

  it('stops a retry that was already scheduled when disposed', async () => {
    const { tracker, sent } = setup({}, [{ kind: 'network-error' }]);

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    await settle();
    tracker.dispose();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sent).toHaveLength(1);
  });

  it('does not schedule a retry when disposed while the request was in flight', async () => {
    const { tracker, sent } = setup({}, [{ kind: 'network-error' }]);

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    tracker.dispose();
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sent).toHaveLength(1);
  });
});
