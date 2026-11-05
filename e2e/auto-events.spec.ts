import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';

const SITE = 'https://shop.example.test';
const ENDPOINT = 'https://api.example.test';
const BATCH_URL = `${ENDPOINT}/v1/batch`;
const KEY = `pyxis_pk_${'A'.repeat(32)}`;
const FLUSH_DELAY_MS = 5000;
const STATUS_ACCEPTED = 202;
const JAVASCRIPT = 'text/javascript; charset=utf-8';
const BUILT_MODULES = ['index.js', 'auto.js'] as const;

const SHOP_PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Shop</title></head>
  <body>
    <h1>Shop</h1>
    <a href="https://www.partner.example.org/offer?ref=shop&amp;coupon=SECRET10">Partner offer</a>
    <a href="/pricing">Pricing</a>
    <a href="/files/2026110512345/catalog.pdf?signature=S1gn3d">Catalog</a>
    <a href="mailto:sales@shop.example.test">Write to sales</a>
    <form id="quote"><input name="company" value="Acme Invented Ltd" /><button>Ask for a quote</button></form>
    <script type="module">
      import { init } from '/index.js';
      import { autoEvents } from '/auto.js';
      init({ key: '${KEY}', endpoint: '${ENDPOINT}', autoPageViews: false });
      autoEvents({ outboundLinks: true, fileDownloads: true, formSubmits: true });
      const stayOnLinks = (event) => {
        if (event.target.closest('a')) event.preventDefault();
      };
      document.addEventListener('click', stayOnLinks);
      document.addEventListener('auxclick', stayOnLinks);
      document.addEventListener('submit', (event) => event.preventDefault());
    </script>
  </body>
</html>`;

interface SentBatch {
  readonly key: string;
  readonly events: readonly {
    readonly name: string;
    readonly path: string;
    readonly properties?: Readonly<Record<string, unknown>>;
  }[];
}

async function serveShop(page: Page): Promise<void> {
  await page.route(`${SITE}/`, (route) =>
    route.fulfill({ contentType: 'text/html; charset=utf-8', body: SHOP_PAGE }),
  );
  for (const file of BUILT_MODULES) {
    await page.route(`${SITE}/${file}`, (route) =>
      route.fulfill({ contentType: JAVASCRIPT, body: readFileSync(`dist/${file}`) }),
    );
  }
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

test('the built auto entry shares the tracker the page started and sends nothing personal', async ({
  page,
}) => {
  await serveShop(page);
  await page.goto(`${SITE}/`);

  await page.getByRole('link', { name: 'Partner offer' }).click();
  await page.getByRole('link', { name: 'Pricing' }).click();
  await page.getByRole('link', { name: 'Catalog' }).click({ button: 'middle' });
  await page.getByRole('link', { name: 'Write to sales' }).click();
  await page.getByRole('button', { name: 'Ask for a quote' }).click();
  const sent = page.waitForRequest(BATCH_URL);
  await page.clock.runFor(FLUSH_DELAY_MS);
  const request = await sent;
  const batch = request.postDataJSON() as SentBatch;

  expect(batch.key).toBe(KEY);
  expect(batch.events.map(({ name, path, properties }) => ({ name, path, properties }))).toEqual([
    { name: 'outbound_link_clicked', path: '/', properties: { domain: 'partner.example.org' } },
    {
      name: 'file_downloaded',
      path: '/',
      properties: { extension: 'pdf', file_path: '/files/:id/catalog.pdf' },
    },
    { name: 'form_submitted', path: '/', properties: { form: 'quote' } },
  ]);
  const body = request.postData() ?? '';
  for (const secret of ['SECRET10', 'S1gn3d', 'sales@', 'Acme']) {
    expect(body).not.toContain(secret);
  }
});
