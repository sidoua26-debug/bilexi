import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/specs',
  timeout: 30000,
  retries: 0,
  workers: 1, // Extensions run best sequentially in persistent contexts
  use: {
    headless: false, // Chrome extensions need visible UI / head mode to run content scripts reliably
    viewport: { width: 1280, height: 800 },
  },
});
