import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

const SITE = 'https://shop.example.test';
const ENDPOINT = 'https://api.example.test';
const BATCH_URL = `${ENDPOINT}/v1/batch`;
const KEY = `pyxis_pk_${'C'.repeat(32)}`;
const FLUSH_DELAY_MS = 5000;
const STATUS_ACCEPTED = 202;
const CLASSIC_BUILD = 'dist/pyxis.global.js';
const MODULE_BUILD = 'dist/index.js';
const JAVASCRIPT = 'text/javascript; charset=utf-8';

const PAGE_WITH_SCRIPT_TAG = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Shop</title></head>
  <body>
    <h1>Shop</h1>
    <script src="/pyxis.global.js"></script>
    <script>
      pyxis.init({ key: '${KEY}', endpoint: '${ENDPOINT}' });
      pyxis.track('cta_clicked', { plan: 'pro' });
    </script>
  </body>
</html>`;

const EMPTY_PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Shop</title></head>
  <body><h1>Shop</h1></body>
</html>`;

interface SentBatch {
  readonly key: string;
  readonly events: readonly { readonly name: string; readonly path: string }[];
}

async function serveSite(page: Page, html: string): Promise<void> {
  await page.route(`${SITE}/`, (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: html }),
  );
  await page.route(`${SITE}/pyxis.global.js`, (route) =>
    route.fulfill({ contentType: JAVASCRIPT, body: readFileSync(CLASSIC_BUILD) }),
  );
  await page.route(`${SITE}/index.js`, (route) =>
    route.fulfill({ contentType: JAVASCRIPT, body: readFileSync(MODULE_BUILD) }),
  );
}

async function acceptBatches(page: Page): Promise<void> {
  await page.route(BATCH_URL, (route) =>
    route.fulfill({
      status: STATUS_ACCEPTED,
      headers: { 'access-control-allow-origin': SITE },
    }),
  );
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test('a page that loads the classic build with a plain script tag sends a batch through window.pyxis', async ({
  page,
}) => {
  await serveSite(page, PAGE_WITH_SCRIPT_TAG);
  await acceptBatches(page);
  await page.goto(`${SITE}/`);

  const sent = page.waitForRequest(BATCH_URL);
  await page.clock.runFor(FLUSH_DELAY_MS);
  const batch = (await sent).postDataJSON() as SentBatch;

  expect(batch.key).toBe(KEY);
  expect(batch.events.map(({ name, path }) => ({ name, path }))).toEqual([
    { name: 'page_view', path: '/' },
    { name: 'cta_clicked', path: '/' },
  ]);
});

test('a classic script inserted the way a tag manager does it exposes every function the module build exports', async ({
  page,
}) => {
  await serveSite(page, EMPTY_PAGE);
  await page.goto(`${SITE}/`);

  const shapes = await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/pyxis.global.js';
      script.addEventListener('load', () => {
        resolve();
      });
      script.addEventListener('error', () => {
        reject(new Error('the classic build did not load'));
      });
      document.head.append(script);
    });
    const globalApi = Reflect.get(window, 'pyxis') as Record<string, unknown>;
    const moduleApi = (await import(`${location.origin}/index.js`)) as Record<string, unknown>;
    return {
      globalNames: Object.keys(globalApi).sort(),
      moduleNames: Object.keys(moduleApi).sort(),
      globalKinds: Object.values(globalApi).map((value) => typeof value),
    };
  });

  expect(shapes.globalNames).toEqual(shapes.moduleNames);
  expect(shapes.globalNames).toEqual([
    'identify',
    'init',
    'optIn',
    'optOut',
    'reset',
    'track',
    'trackRequest',
    'trackingStatus',
  ]);
  expect(new Set(shapes.globalKinds)).toEqual(new Set(['function']));
});
