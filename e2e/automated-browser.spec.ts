import { expect, test } from '@playwright/test';
import { exercise } from './playground-page.ts';

test.use({ launchOptions: { args: [] } });

test.beforeEach(async ({ page }) => {
  await page.clock.install();
});

test('queues nothing in a browser that reports automation, while trackingStatus() stays on', async ({
  page,
}) => {
  await page.goto('/');
  expect(await page.evaluate(() => navigator.webdriver)).toBe(true);

  await exercise(page);

  await expect(page.locator('#tracking-status')).toHaveText("trackingStatus(): 'on'");
  await expect(page.locator('#batches > li')).toHaveCount(0);
});
