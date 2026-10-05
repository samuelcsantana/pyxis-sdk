import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryStore } from './adapters/storage.js';
import type { Transport } from './adapters/transport.js';
import type { Batch } from './core/batch.js';
import { buildAttribution } from './core/attribution.js';
import type { ResolvedOptions } from './core/options.js';
import { createTracker } from './tracker.js';

const CONTRACT_FILE = 'contract/openapi.json';
const BATCH_REQUEST = 'openapi.json#/components/schemas/BatchRequest';

const OPTIONS: ResolvedOptions = {
  key: `pyxis_pk_${'C'.repeat(32)}`,
  batchUrl: 'https://api.pyxis.example.com/v1/batch',
  pathRules: [],
  autoPageViews: true,
  dryRun: false,
};

function batchRequestValidator() {
  const ajv = new Ajv2020.default({ strict: false, allErrors: true });
  addFormats.default(ajv);
  ajv.addSchema(JSON.parse(readFileSync(CONTRACT_FILE, 'utf8')) as object, 'openapi.json');
  const validate = ajv.getSchema(BATCH_REQUEST);
  if (validate === undefined) {
    throw new Error('The contract has no named BatchRequest schema.');
  }
  return validate;
}

function recordedBatches() {
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
    transport,
  });
  return { tracker, batches: () => bodies.map((body) => JSON.parse(body) as Batch) };
}

describe('batches against the API contract', () => {
  const validate = batchRequestValidator();

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 6, 14, 3, 10, 4));
  });

  it('builds batches the API accepts: an attributed page view, an event with properties and an identify', () => {
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
    tracker.flush();

    const [batch] = batches();
    expect(batch?.events.map((event) => event.name)).toEqual([
      'page_view',
      'calculator_result_shown',
      'identify',
    ]);
    expect(validate(batch)).toBe(true);
    expect(validate.errors ?? []).toEqual([]);
  });

  it('notices a batch the contract does not describe', () => {
    const { tracker, batches } = recordedBatches();
    tracker.enqueue({ name: 'page_view', path: '/' });
    tracker.flush();
    const [batch] = batches();

    expect(validate({ ...batch, event_list: batch?.events })).toBe(false);
  });
});
