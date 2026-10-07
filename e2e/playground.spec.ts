import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const FLUSH_DELAY_MS = 5000;

function batchValidator() {
  const ajv = new Ajv2020.default({ strict: false, allErrors: true });
  addFormats.default(ajv);
  ajv.addSchema(
    JSON.parse(readFileSync('contract/openapi.json', 'utf8')) as object,
    'openapi.json',
  );
  const validate = ajv.getSchema('openapi.json#/components/schemas/BatchRequest');
  if (validate === undefined) {
    throw new Error('The contract has no named BatchRequest schema.');
  }
  return validate;
}

async function shownBatches(page: Page): Promise<unknown[]> {
  const bodies = await page.locator('#batches pre').allTextContents();
  return bodies.map((body) => JSON.parse(body) as unknown);
}

function recordRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    urls.push(request.url());
  });
  return urls;
}

async function exercise(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open /pricing' }).click();
  await page.getByRole('button', { name: 'Open /orders/8213' }).click();
  await page.getByRole('button', { name: 'Arrive from an ad click' }).click();
  await page.getByRole('button', { name: "track('cta_clicked')" }).click();
  await page.getByRole('button', { name: "identify('u_demo_42')" }).click();
  await page.getByRole('button', { name: 'trackRequest POST 201' }).click();
  await page.getByRole('button', { name: 'trackRequest POST 409' }).click();
  await page.clock.runFor(FLUSH_DELAY_MS);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test('shows the batches it would send, valid against the API contract, and sends nothing', async ({
  page,
  baseURL,
}) => {
  const requests = recordRequests(page);
  await page.goto('/');

  await exercise(page);

  await expect(page.locator('#batches > li').first()).toBeVisible();
  const batches = await shownBatches(page);
  const validate = batchValidator();
  for (const batch of batches) {
    expect(validate(batch), JSON.stringify(validate.errors)).toBe(true);
  }
  const text = JSON.stringify(batches);
  expect(text).toContain('/orders/:id');
  expect(text).not.toContain('8213');
  expect(text).not.toContain('Te5t-123');
  expect(text).toContain('order_number_in_use');
  expect(requests.filter((url) => !url.startsWith(baseURL ?? ''))).toEqual([]);
});

test('sends nothing at all with Global Privacy Control on', async ({ page }) => {
  await page.goto('/?gpc=1');

  await exercise(page);

  await expect(page.getByRole('status')).toHaveText(/Global Privacy Control is on/);
  await expect(page.locator('#batches > li')).toHaveCount(0);
  await expect(page.locator('#tracking-status')).toHaveText(
    "trackingStatus(): 'blocked-by-browser'",
  );
  await expect(page.getByLabel('Opt out on this browser')).toBeDisabled();
});

test('shows the tracking status following the opt-out box, across a reload', async ({ page }) => {
  await page.goto('/');
  const status = page.locator('#tracking-status');
  const optOutBox = page.getByLabel('Opt out on this browser');

  await expect(status).toHaveText("trackingStatus(): 'on'");
  await optOutBox.check();
  await expect(status).toHaveText("trackingStatus(): 'opted-out'");
  await page.reload();
  await expect(optOutBox).toBeChecked();
  await expect(status).toHaveText("trackingStatus(): 'opted-out'");
  await optOutBox.uncheck();
  await expect(status).toHaveText("trackingStatus(): 'on'");
});

test('stops queueing once the visitor opts out, and remembers it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'Opt out on this browser' }).check();

  await exercise(page);

  await expect(page.locator('#batches > li')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('checkbox', { name: 'Opt out on this browser' })).toBeChecked();
});
