import { defineConfig } from '@playwright/test';

const port = 24217;
const baseURL = 'http://127.0.0.1:' + port;

export default defineConfig({
  testDir: './tests/browser',
  reporter: 'list',
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server.mjs',
    env: { PORT: String(port) },
    url: baseURL,
    reuseExistingServer: false,
  },
});
