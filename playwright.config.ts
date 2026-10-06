import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${String(PORT)}`;

export default defineConfig({
  testDir: './e2e',
  forbidOnly: process.env.CI !== undefined,
  reporter: 'list',
  use: { baseURL: BASE_URL, ...devices['Desktop Chrome'] },
  webServer: {
    command: 'npm run build:playground && node scripts/serve-playground.mts',
    url: BASE_URL,
    reuseExistingServer: false,
    env: { PLAYGROUND_PORT: String(PORT) },
  },
});
