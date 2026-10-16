import type { Page } from '@playwright/test';

const FLUSH_DELAY_MS = 5000;

export async function exercise(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open /pricing' }).click();
  await page.getByRole('button', { name: 'Open /orders/8213' }).click();
  await page.getByRole('button', { name: 'Arrive from an ad click' }).click();
  await page.getByRole('button', { name: "track('cta_clicked')" }).click();
  await page.getByRole('button', { name: "identify('u_demo_42')" }).click();
  await page.getByRole('button', { name: 'trackRequest POST 201' }).click();
  await page.getByRole('button', { name: 'trackRequest POST 409' }).click();
  await page.clock.runFor(FLUSH_DELAY_MS);
}
