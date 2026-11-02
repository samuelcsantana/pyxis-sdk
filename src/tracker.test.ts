import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type KeyValueStore, memoryStore } from './adapters/storage.js';
import type { Transport } from './adapters/transport.js';
import type { Batch } from './core/batch.js';
import { FLUSH_DELAY_MS, FLUSH_EVENT_COUNT } from './core/batch-policy.js';
import type { ResolvedOptions } from './core/options.js';
import { RETRY_DELAYS_MS, type SendOutcome } from './core/retry-policy.js';
import { SESSION_IDLE_TIMEOUT_MS } from './core/session-policy.js';
import { PERIOD_KEY, type VisitorKind, type VisitorPeriod } from './core/visitor-kind.js';
import {
  createTracker,
  REFUSED_WARNING,
  SESSION_KEY,
  type TrackerDependencies,
} from './tracker.js';

const START = Date.UTC(2026, 9, 6, 14, 3, 10, 4);

const OPTIONS: ResolvedOptions = {
  key: 'pyxis_pk_test',
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
  warn?: (message: string) => void,
) {
  let nextId = 0;
  const { transport, sent } = fakeTransport(outcomes);
  const periodStore = memoryStore();
  const deps: TrackerDependencies = {
    now: () => Date.now(),
    createId: () => `id-${String(++nextId)}`,
    random: () => 0.5,
    sessionStore,
    periodStore,
    transport,
    ...(warn === undefined ? {} : { warn }),
  };
  return {
    tracker: createTracker({ ...OPTIONS, ...options }, deps),
    sent,
    sessionStore,
    periodStore,
  };
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
      key: 'pyxis_pk_test',
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

  it('attaches the identified user of the session', () => {
    const store = memoryStore();
    store.write(
      SESSION_KEY,
      JSON.stringify({ id: 'visit', lastActivityAt: START, userId: 'u_42' }),
    );
    const { tracker, sent } = setup({}, [], store);

    tracker.enqueue({ name: 'cta_clicked', path: '/pricing' });
    tracker.flush();

    expect(sent[0]?.batch.events[0]).toMatchObject({ session_id: 'visit', user_id: 'u_42' });
  });

  it('attaches the entry attribution only to the first claim of each session', async () => {
    const { tracker, sent, sessionStore } = setup();
    const entryAttribution = { from_ad_click: true, referrer_host: 'google.com' };

    tracker.enqueue({ name: 'page_view', path: '/', entryAttribution });
    tracker.enqueue({ name: 'page_view', path: '/pricing', entryAttribution });
    tracker.flush();
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_TIMEOUT_MS + 1);
    tracker.enqueue({ name: 'page_view', path: '/checkout', entryAttribution });
    tracker.flush();

    const events = sent.flatMap((entry) => entry.batch.events);
    expect(events.map((event) => event.attribution)).toEqual([
      entryAttribution,
      undefined,
      entryAttribution,
    ]);
    expect(JSON.parse(sessionStore.read(SESSION_KEY) ?? '{}')).toMatchObject({
      entryRecorded: true,
    });
  });

  it('does not let an event without a claim use up the entry', () => {
    const { tracker, sent } = setup();
    const entryAttribution = { from_ad_click: false, referrer_host: 'blog.example.com' };

    tracker.enqueue({ name: 'cta_clicked', path: '/' });
    tracker.enqueue({ name: 'page_view', path: '/', entryAttribution });
    tracker.flush();

    expect(sent[0]?.batch.events[1]?.attribution).toEqual(entryAttribution);
  });

  it('identifies the visit once per user, and every later event carries the user', () => {
    const { tracker, sent } = setup();

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.identify('user_42', '/dashboard');
    tracker.identify('user_42', '/dashboard');
    tracker.enqueue({ name: 'plan_selected', path: '/dashboard' });
    tracker.flush();

    expect(
      sent[0]?.batch.events.map(({ name, path, user_id }) => ({ name, path, user_id })),
    ).toEqual([
      { name: 'page_view', path: '/', user_id: undefined },
      { name: 'identify', path: '/dashboard', user_id: 'user_42' },
      { name: 'plan_selected', path: '/dashboard', user_id: 'user_42' },
    ]);
    expect(new Set(sent[0]?.batch.events.map((event) => event.session_id)).size).toBe(1);
  });

  it('identifies again when another user signs in on the same visit', () => {
    const { tracker, sent } = setup();

    tracker.identify('user_42', '/');
    tracker.identify('user_7', '/');
    tracker.flush();

    expect(sent[0]?.batch.events.map((event) => event.user_id)).toEqual(['user_42', 'user_7']);
  });

  it('sends what is queued with the old user on reset, then starts an anonymous visit', () => {
    const { tracker, sent } = setup();
    tracker.identify('user_42', '/');
    tracker.enqueue({ name: 'logout_clicked', path: '/settings' });

    tracker.reset();
    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();

    expect(sent).toHaveLength(2);
    const before = sent[0]?.batch.events ?? [];
    const after = sent[1]?.batch.events[0];
    expect(before.map((event) => event.user_id)).toEqual(['user_42', 'user_42']);
    expect(after?.user_id).toBeUndefined();
    expect(after?.session_id).not.toBe(before[0]?.session_id);
  });

  it('does nothing on identify or reset once disposed', () => {
    const { tracker, sent, sessionStore } = setup();
    tracker.dispose();

    tracker.identify('user_42', '/');
    tracker.reset();

    expect(sent).toHaveLength(0);
    expect(sessionStore.read(SESSION_KEY)).toBeNull();
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

  it.each([401, 403])(
    'sends nothing more from the page once the API answers %i',
    async (status) => {
      const { tracker, sent } = setup({}, [{ kind: 'response', status }]);

      tracker.enqueue({ name: 'page_view', path: '/' });
      tracker.flush();
      await settle();
      tracker.enqueue({ name: 'page_view', path: '/next' });
      tracker.flush();
      tracker.identify('user_1', '/next');
      await vi.advanceTimersByTimeAsync(60_000);

      expect(sent).toHaveLength(1);
    },
  );

  it('drops the queue and a pending retry of another batch when the API refuses', async () => {
    const { tracker, sent } = setup({}, [
      { kind: 'network-error' },
      { kind: 'response', status: 401 },
    ]);

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    await settle();
    tracker.enqueue({ name: 'page_view', path: '/next' });
    tracker.flush();
    tracker.enqueue({ name: 'page_view', path: '/queued' });
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(sent.map((entry) => entry.batch.events[0]?.path)).toEqual(['/', '/next']);
  });

  it('warns once when the API refuses batches already in flight', async () => {
    const warn = vi.fn();
    const { tracker, sent } = setup(
      {},
      [
        { kind: 'response', status: 403 },
        { kind: 'response', status: 403 },
      ],
      memoryStore(),
      warn,
    );

    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    tracker.enqueue({ name: 'page_view', path: '/next' });
    tracker.flush();
    await settle();

    expect(sent).toHaveLength(2);
    expect(warn.mock.calls).toEqual([[REFUSED_WARNING]]);
  });

  it('treats a transport that rejects as a network error and retries', async () => {
    let calls = 0;
    const deps: TrackerDependencies = {
      now: () => Date.now(),
      createId: () => 'id',
      random: () => 0.5,
      sessionStore: memoryStore(),
      periodStore: memoryStore(),
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

    expect(onBatch).toHaveBeenCalledWith(expect.objectContaining({ key: 'pyxis_pk_test' }));
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

const PERIOD: VisitorPeriod = {
  day_ends_at: '2026-10-07T03:00:00.000Z',
  month_ends_at: '2026-11-01T03:00:00.000Z',
};
const STORED_PERIOD = JSON.stringify(PERIOD);
const ENTRY = { name: 'page_view', path: '/', entryAttribution: { from_ad_click: false } };
const ANSWER_WITH_PERIOD: SendOutcome = { kind: 'response', status: 202, period: PERIOD };
const ANSWER_WITHOUT_PERIOD: SendOutcome = { kind: 'response', status: 202, period: 'off' };

describe('createTracker and unique visitors', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('labels only the entry event of a visit, as the first of this browser without a marker', () => {
    const { tracker, sent } = setup();

    tracker.enqueue(ENTRY);
    tracker.enqueue({ name: 'cta_clicked', path: '/' });
    tracker.enqueue({ ...ENTRY, path: '/pricing' });
    tracker.flush();

    expect(sent[0]?.batch.events.map((event) => event.visitor)).toEqual([
      'first_visit',
      undefined,
      undefined,
    ]);
  });

  it('labels nothing when no event of the visit claims the entry', () => {
    const { tracker, sent } = setup();

    tracker.enqueue({ name: 'cta_clicked', path: '/' });
    tracker.identify('user_42', '/');
    tracker.flush();

    expect(sent[0]?.batch.events.some((event) => 'visitor' in event)).toBe(false);
  });

  it.each<[string, number, VisitorKind]>([
    ['another one today before the day ends', START, 'again_today'],
    ['the first today once the day ended', Date.parse(PERIOD.day_ends_at), 'first_today'],
    [
      'the first this month once the month ended',
      Date.parse(PERIOD.month_ends_at),
      'first_this_month',
    ],
  ])('labels a visit with a marker %s, by the device clock', (_case, now, kind) => {
    vi.setSystemTime(now);
    const { tracker, sent, periodStore } = setup();
    periodStore.write(PERIOD_KEY, STORED_PERIOD);

    tracker.enqueue(ENTRY);
    tracker.flush();

    expect(sent[0]?.batch.events[0]?.visitor).toBe(kind);
  });

  it('labels a visit the first of this browser when the stored marker is not a period', () => {
    const { tracker, sent, periodStore } = setup();
    periodStore.write(PERIOD_KEY, '{"day_ends_at":"soon"}');

    tracker.enqueue(ENTRY);
    tracker.flush();

    expect(sent[0]?.batch.events[0]?.visitor).toBe('first_visit');
  });

  it('tells the kind once, when the entry is recorded, from the marker at that moment', () => {
    const { tracker, sent, periodStore } = setup();

    tracker.enqueue(ENTRY);
    periodStore.write(PERIOD_KEY, STORED_PERIOD);
    tracker.flush();

    expect(sent[0]?.batch.events[0]?.visitor).toBe('first_visit');
  });

  it('keeps the period the API answers, and tells the next visit from it', async () => {
    const { tracker, sent, periodStore } = setup({}, [ANSWER_WITH_PERIOD]);

    tracker.enqueue(ENTRY);
    tracker.flush();
    await settle();
    const kept = periodStore.read(PERIOD_KEY);
    await vi.advanceTimersByTimeAsync(SESSION_IDLE_TIMEOUT_MS + 1);
    tracker.enqueue(ENTRY);
    tracker.flush();

    expect(JSON.parse(kept ?? 'null')).toEqual(PERIOD);
    expect(sent.map((entry) => entry.batch.events[0]?.visitor)).toEqual([
      'first_visit',
      'again_today',
    ]);
  });

  it('replaces the kept period with the one of a later answer', async () => {
    const tomorrow: VisitorPeriod = {
      day_ends_at: '2026-10-08T03:00:00.000Z',
      month_ends_at: PERIOD.month_ends_at,
    };
    const { tracker, periodStore } = setup({}, [
      { kind: 'response', status: 202, period: tomorrow },
    ]);
    periodStore.write(PERIOD_KEY, STORED_PERIOD);

    tracker.enqueue(ENTRY);
    tracker.flush();
    await settle();

    expect(JSON.parse(periodStore.read(PERIOD_KEY) ?? 'null')).toEqual(tomorrow);
  });

  it('deletes the marker when a successful answer comes without a period', async () => {
    const { tracker, periodStore } = setup({}, [ANSWER_WITHOUT_PERIOD]);
    periodStore.write(PERIOD_KEY, STORED_PERIOD);

    tracker.enqueue(ENTRY);
    tracker.flush();
    await settle();

    expect(periodStore.read(PERIOD_KEY)).toBeNull();
  });

  it.each<[string, SendOutcome]>([
    ['a beacon hand-off', { kind: 'handed-off' }],
    ['a network error', { kind: 'network-error' }],
    ['an answer that is not a success', { kind: 'response', status: 400 }],
    ['a refused batch', { kind: 'response', status: 403 }],
    ['a successful answer whose body says nothing', { kind: 'response', status: 202 }],
  ])('keeps the marker as it was on %s', async (_case, outcome) => {
    const { tracker, periodStore } = setup({}, [outcome]);
    periodStore.write(PERIOD_KEY, STORED_PERIOD);

    tracker.enqueue(ENTRY);
    tracker.flush();
    await settle();

    expect(periodStore.read(PERIOD_KEY)).toBe(STORED_PERIOD);
  });

  it('keeps nothing from an answer that arrives after the tracker was disposed', async () => {
    const { tracker, periodStore } = setup({}, [ANSWER_WITH_PERIOD]);

    tracker.enqueue(ENTRY);
    tracker.flush();
    tracker.dispose();
    await settle();

    expect(periodStore.read(PERIOD_KEY)).toBeNull();
  });

  it('deletes nothing on an answer without a period after the tracker was disposed', async () => {
    const { tracker, periodStore } = setup({}, [ANSWER_WITHOUT_PERIOD]);
    periodStore.write(PERIOD_KEY, STORED_PERIOD);

    tracker.enqueue(ENTRY);
    tracker.flush();
    tracker.dispose();
    await settle();

    expect(periodStore.read(PERIOD_KEY)).toBe(STORED_PERIOD);
  });
});
