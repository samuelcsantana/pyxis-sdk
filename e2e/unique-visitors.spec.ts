import { readFileSync } from 'node:fs';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';

const SITE = 'https://shop.example.test';
const ENDPOINT = 'https://api.example.test';
const BATCH_URL = `${ENDPOINT}/v1/batch`;
const KEY = `pyxis_pk_${'V'.repeat(32)}`;
const FLUSH_DELAY_MS = 5000;
const STATUS_ACCEPTED = 202;
const PERIOD_KEY = 'pyxis:period';
const NOW = new Date('2026-11-02T15:00:00.000Z');
const PERIOD = {
  day_ends_at: '2026-11-03T03:00:00.000Z',
  month_ends_at: '2026-12-01T03:00:00.000Z',
};
const COUNTS = { accepted: 1, duplicates: 0, rejected: 0 };

const PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Shop</title></head>
  <body>
    <h1>Shop</h1>
    <script src="/pyxis.global.js"></script>
    <script>pyxis.init({ key: '${KEY}', endpoint: '${ENDPOINT}' });</script>
  </body>
</html>`;

interface SentEvent {
  readonly name: string;
  readonly visitor?: string;
}

async function serveSite(context: BrowserContext, answer: object): Promise<void> {
  await context.route(`${SITE}/`, (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE }),
  );
  await context.route(`${SITE}/pyxis.global.js`, (route) =>
    route.fulfill({
      contentType: 'text/javascript; charset=utf-8',
      body: readFileSync('dist/pyxis.global.js'),
    }),
  );
  await context.route(BATCH_URL, (route) =>
    route.fulfill({
      status: STATUS_ACCEPTED,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': SITE },
      body: JSON.stringify(answer),
    }),
  );
}

async function visit(page: Page): Promise<readonly SentEvent[]> {
  await page.goto(`${SITE}/`);
  const sent = page.waitForRequest(BATCH_URL);
  await page.clock.runFor(FLUSH_DELAY_MS);
  const batch = (await sent).postDataJSON() as { events: readonly SentEvent[] };
  return batch.events;
}

async function seedMarker(page: Page, alsoGlobalPrivacyControl = false): Promise<void> {
  await page.addInitScript(
    ({ key, value, gpc }) => {
      localStorage.setItem(key, value);
      if (gpc) {
        Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });
      }
    },
    { key: PERIOD_KEY, value: JSON.stringify(PERIOD), gpc: alsoGlobalPrivacyControl },
  );
}

function storedPeriod(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), PERIOD_KEY);
}

test.beforeEach(async ({ context }) => {
  await context.clock.install({ time: NOW });
});

test('labels the first visit, keeps the period the API answers and labels the next visit of the day', async ({
  context,
  page,
}) => {
  await serveSite(context, { ...COUNTS, visitor_period: PERIOD });

  const firstVisit = await visit(page);
  await expect.poll(() => storedPeriod(page)).toBe(JSON.stringify(PERIOD));
  const secondVisit = await visit(await context.newPage());

  expect(firstVisit.map(({ name, visitor }) => ({ name, visitor }))).toEqual([
    { name: 'page_view', visitor: 'first_visit' },
  ]);
  expect(secondVisit.map(({ name, visitor }) => ({ name, visitor }))).toEqual([
    { name: 'page_view', visitor: 'again_today' },
  ]);
});

test('deletes the marker when a successful answer comes without the period', async ({
  context,
  page,
}) => {
  await serveSite(context, COUNTS);
  await seedMarker(page);

  const events = await visit(page);

  expect(events[0]?.visitor).toBe('again_today');
  await expect.poll(() => storedPeriod(page)).toBeNull();
});

test('deletes the marker and sends nothing with Global Privacy Control on', async ({
  context,
  page,
}) => {
  await serveSite(context, { ...COUNTS, visitor_period: PERIOD });
  const batches: string[] = [];
  page.on('request', (request) => {
    if (request.url() === BATCH_URL) {
      batches.push(request.url());
    }
  });
  await seedMarker(page, true);

  await page.goto(`${SITE}/`);
  await page.clock.runFor(FLUSH_DELAY_MS);

  expect(await storedPeriod(page)).toBeNull();
  expect(batches).toEqual([]);
});
