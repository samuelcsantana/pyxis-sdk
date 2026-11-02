import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type KeyValueStore, memoryStore } from './adapters/storage.js';
import type { Transport } from './adapters/transport.js';
import type { Batch } from './core/batch.js';
import { buildAttribution } from './core/attribution.js';
import type { ResolvedOptions } from './core/options.js';
import { checkTrackedRequest } from './core/tracked-request.js';
import { PERIOD_KEY, periodAnswerOf, type VisitorPeriod } from './core/visitor-kind.js';
import { createTracker } from './tracker.js';

const CONTRACT_FILE = 'contract/openapi.json';
const BATCH_REQUEST = 'openapi.json#/components/schemas/BatchRequest';
const INGEST_RESULT = 'openapi.json#/components/schemas/IngestResult';
const PERIOD: VisitorPeriod = {
  day_ends_at: '2026-10-07T03:00:00.000Z',
  month_ends_at: '2026-11-01T03:00:00.000Z',
};

const OPTIONS: ResolvedOptions = {
  key: `pyxis_pk_${'C'.repeat(32)}`,
  batchUrl: 'https://api.pyxis.example.com/v1/batch',
  pathRules: [],
  autoPageViews: true,
  dryRun: false,
};

function contractValidator(schema: string) {
  const ajv = new Ajv2020.default({ strict: false, allErrors: true });
  addFormats.default(ajv);
  ajv.addSchema(JSON.parse(readFileSync(CONTRACT_FILE, 'utf8')) as object, 'openapi.json');
  const validate = ajv.getSchema(schema);
  if (validate === undefined) {
    throw new Error(`The contract has no schema ${schema}.`);
  }
  return validate;
}

function recordedBatches(periodStore: KeyValueStore = memoryStore()) {
  const bodies: string[] = [];
  const transport: Transport = {
    send: (_url, body) => {
      bodies.push(body);
      return Promise.resolve({ kind: 'response', status: 202 });
    },
  };
  let nextId = 0;
  const tracker = createTracker(OPTIONS, {
    now: () => Date.now(),
    createId: () => {
      nextId += 1;
      return `6f1c2b3a-1d2e-4f5a-8b6c-${String(nextId).padStart(12, '0')}`;
    },
    random: () => 0.5,
    sessionStore: memoryStore(),
    periodStore,
    transport,
  });
  return { tracker, batches: () => bodies.map((body) => JSON.parse(body) as Batch) };
}

describe('batches against the API contract', () => {
  const validate = contractValidator(BATCH_REQUEST);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 6, 14, 3, 10, 4));
  });

  it('builds batches the API accepts: an attributed page view, an event with properties, an identify and an api_request', () => {
    const { tracker, batches } = recordedBatches();

    tracker.enqueue({
      name: 'page_view',
      path: '/pricing',
      entryAttribution: buildAttribution({
        search: '?utm_source=newsletter&utm_medium=email&gclid=abc',
        referrer: 'https://www.google.com.br/',
        ownHost: 'shop.example.com',
      }),
    });
    tracker.enqueue({
      name: 'calculator_result_shown',
      path: '/calculator',
      properties: { calculator: 'ifood', used_plan_preset: true, monthly_sales: 12_500.5 },
    });
    tracker.identify('user_42', '/dashboard');
    const request = checkTrackedRequest(
      {
        method: 'POST',
        url: '/orders/42',
        status: 422,
        durationMs: 87,
        errorCode: 'order.invalid',
      },
      [],
    );
    if (request.ok) {
      tracker.enqueue({ name: 'api_request', path: '/dashboard', properties: request.properties });
    }
    tracker.flush();

    const [batch] = batches();
    expect(batch?.events[0]?.visitor).toBe('first_visit');
    expect(batch?.events.map((event) => event.name)).toEqual([
      'page_view',
      'calculator_result_shown',
      'identify',
      'api_request',
    ]);
    expect(validate(batch)).toBe(true);
    expect(validate.errors ?? []).toEqual([]);
  });

  it.each([
    ['again_today', Date.UTC(2026, 9, 6, 14, 3, 10, 4)],
    ['first_today', Date.parse(PERIOD.day_ends_at)],
    ['first_this_month', Date.parse(PERIOD.month_ends_at)],
  ])('builds an entry labelled %s that the API accepts', (kind, now) => {
    vi.setSystemTime(now);
    const periodStore = memoryStore();
    periodStore.write(PERIOD_KEY, JSON.stringify(PERIOD));
    const { tracker, batches } = recordedBatches(periodStore);

    tracker.enqueue({ name: 'page_view', path: '/', entryAttribution: { from_ad_click: false } });
    tracker.flush();

    const [batch] = batches();
    expect(batch?.events[0]?.visitor).toBe(kind);
    expect(validate(batch), JSON.stringify(validate.errors)).toBe(true);
  });

  it('notices a batch the contract does not describe', () => {
    const { tracker, batches } = recordedBatches();
    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    const [batch] = batches();

    expect(validate({ ...batch, event_list: batch?.events })).toBe(false);
  });
});

describe('answers against the API contract', () => {
  const validate = contractValidator(INGEST_RESULT);
  const counts = { accepted: 3, duplicates: 0, rejected: 0 };

  it('reads the period from an answer the contract describes', () => {
    const answer = { ...counts, visitor_period: PERIOD };

    expect(validate(answer), JSON.stringify(validate.errors)).toBe(true);
    expect(periodAnswerOf(JSON.stringify(answer))).toEqual(PERIOD);
  });

  it('reads an answer the contract describes without a period as the option being off', () => {
    expect(validate(counts), JSON.stringify(validate.errors)).toBe(true);
    expect(periodAnswerOf(JSON.stringify(counts))).toBe('off');
  });

  it('notices an answer the contract does not describe', () => {
    expect(validate({ ...counts, visitor_period: { day_ends_at: PERIOD.day_ends_at } })).toBe(
      false,
    );
  });
});
