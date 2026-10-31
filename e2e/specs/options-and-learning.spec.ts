import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extPath = path.resolve(__dirname, '../../.output/chrome-mv3');

test.describe('Phase B (M3a): Options Page UI, Shortcuts & Double-Rejection E2E', () => {
  let server: http.Server;
  let port: number;
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;

  test.beforeAll(async () => {
    // 1. Start local HTTP server to serve test fixtures
    server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${port}`);
      let reqPath = parsedUrl.pathname;
      if (reqPath === '/' || reqPath === '') reqPath = '/spike-fixtures.html';

      const filePath = path.join(__dirname, '../fixtures', reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        if (filePath.endsWith('.html')) res.setHeader('Content-Type', 'text/html');
        else if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript');
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 3456;
        resolve();
      });
    });

    // 2. Launch persistent Chromium with extension
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--no-sandbox',
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`,
      ],
    });

    // Find service worker to determine extension ID
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }
    extensionId = worker.url().split('/')[2];

    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
    server?.close();
  });

  test('1. Options Page: tabs navigation and add personal word', async () => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.waitForLoadState('domcontentloaded');

    // Check title and header
    await expect(page.locator('h1')).toContainText('Bilexi');

    // Verify all 5 tab buttons exist
    const generalTab = page.locator('button[role="tab"]:has-text("General")');
    const wordsTab = page.locator('button[role="tab"]:has-text("My Words")');
    const shortcutsTab = page.locator('button[role="tab"]:has-text("Shortcuts")');
    const sitesTab = page.locator('button[role="tab"]:has-text("Disabled Sites")');
    const aboutTab = page.locator('button[role="tab"]:has-text("About")');

    await expect(generalTab).toBeVisible();
    await expect(wordsTab).toBeVisible();
    await expect(shortcutsTab).toBeVisible();
    await expect(sitesTab).toBeVisible();
    await expect(aboutTab).toBeVisible();

    // Switch to "My Words" tab and add a custom personal word
    await wordsTab.click();
    await expect(page.locator('h2:has-text("Personal Dictionary")')).toBeVisible();

    const wordInput = page.locator('input[placeholder*="Add custom word"]');
    await wordInput.fill('antigravitycorp');
    await page.locator('button:has-text("Add Word")').click();

    // Verify word added to personal dictionary
    await expect(page.getByText('antigravitycorp', { exact: true })).toBeVisible();
  });

  test('2. Options Page: add text expansion shortcut', async () => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.waitForLoadState('domcontentloaded');

    // Switch to Shortcuts tab
    const shortcutsTab = page.locator('button[role="tab"]:has-text("Shortcuts")');
    await shortcutsTab.click();
    await expect(page.locator('h2:has-text("Text Expansion Shortcuts")')).toBeVisible();

    // Add new shortcut "tyvm" -> "thank you very much"
    const triggerInput = page.locator('input[placeholder*="Trigger"]');
    const replInput = page.locator('input[placeholder*="Replacement"]');
    await triggerInput.fill('tyvm');
    await replInput.fill('thank you very much');
    await page.locator('button:has-text("Add Shortcut")').click();

    // Verify shortcut row in table
    await expect(page.locator('td:has-text("tyvm")')).toBeVisible();
    await expect(page.locator('td:has-text("thank you very much")')).toBeVisible();
  });

  test('3. In-page Autocorrect: personal word is not corrected', async () => {
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.fill('');

    // Type the personal word added in Test 1: "antigravitycorp "
    await page.keyboard.type('antigravitycorp ', { delay: 15 });
    await expect(input).toHaveValue('antigravitycorp ');
  });

  test('4. In-page Autocorrect: shortcut expands with casing', async () => {
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.fill('');

    // Type shortcut "tyvm "
    await page.keyboard.type('tyvm ', { delay: 15 });
    await expect(input).toHaveValue('thank you very much ');

    // Type capitalized shortcut "Tyvm "
    await input.fill('');
    await page.keyboard.type('Tyvm ', { delay: 15 });
    await expect(input).toHaveValue('Thank you very much ');
  });

  test('5. In-page Autocorrect: double-rejection promotes to ignored words', async () => {
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.fill('');

    // 1st correction and rejection
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('the ');
    await page.keyboard.press('Backspace');
    await expect(input).toHaveValue('teh');

    // Blur and refocus to simulate a new interaction context (clears ephemeral active-field rejection)
    await input.blur();
    await input.focus();
    await input.fill('');
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('the ');
    await page.keyboard.press('Backspace');
    await expect(input).toHaveValue('teh');

    // Now 'teh' has been rejected twice and permanently added to rejectedWords in chrome.storage.local!
    // Blur and refocus again to clear active ephemeral tokens
    await input.blur();
    await input.focus();
    await page.keyboard.type(' ', { delay: 15 });
    // Should NOT autocorrect anymore because it's permanently in rejectedWords!
    await expect(input).toHaveValue('teh ');

    // Check options page to verify 'teh' appears in Ignored Words
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    const wordsTab = page.locator('button[role="tab"]:has-text("My Words")');
    await wordsTab.click();
    await expect(page.locator('h2:has-text("Ignored Words (Double-Rejection)")')).toBeVisible();
    await expect(page.getByText('teh', { exact: true })).toBeVisible();
  });
});
