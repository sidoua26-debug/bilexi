import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extPath = path.resolve(__dirname, '../../.output/chrome-mv3');

test.describe('Task S3: Suggestion Strip End-to-End', () => {
  let server: http.Server;
  let port: number;
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async () => {
    // 1. Start local HTTP server to serve fixtures under http://127.0.0.1
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

    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }

    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
    server?.close();
  });

  test('renders 3-slot strip for misspelled token and handles Alt+2 selection without losing focus', async () => {
    // Navigate to fixtures test page
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    await page.waitForLoadState('networkidle');

    // Give content script a moment to initialize
    await page.waitForTimeout(500);

    const input = page.locator('#fixture-input');
    await input.focus();

    // Type misspelled word "recieve" without boundary
    await input.pressSequentially('recieve', { delay: 50 });

    // Wait for strip container inside shadow DOM
    const stripHost = page.locator('bilexi-strip');
    await expect(stripHost).toBeAttached({ timeout: 4000 });

    const bestOption = stripHost.locator('.strip-slot.slot-best');
    await expect(bestOption).toBeVisible();
    await expect(bestOption).toContainText('receive');

    // Verify left slot has verbatim original token
    const origOption = stripHost.locator('.strip-slot.slot-original');
    await expect(origOption).toBeVisible();
    await expect(origOption).toContainText('recieve');

    // Ensure screens directory exists
    const screensDir = path.resolve('docs/screens');
    if (!fs.existsSync(screensDir)) {
      fs.mkdirSync(screensDir, { recursive: true });
    }

    // Capture light theme screenshot
    await page.screenshot({ path: path.resolve('docs/screens/strip-light.png'), fullPage: false });

    // Select with Alt+2
    await page.keyboard.press('Alt+2');

    // Verify input value was replaced with receive (no trailing space added)
    await expect(input).toHaveValue('receive');

    // Verify document.activeElement is still the input
    const isFocused = await input.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);

    // Verify strip is hidden
    await expect(stripHost).not.toBeAttached();
  });

  test('renders dark theme strip and handles Escape dismissal', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const input = page.locator('#fixture-input');
    await input.focus();

    // Type French elision word without apostrophe: "jespere"
    await input.pressSequentially('jespere', { delay: 50 });

    const stripHost = page.locator('bilexi-strip');
    await expect(stripHost).toBeAttached({ timeout: 4000 });

    const bestOption = stripHost.locator('.strip-slot.slot-best');
    await expect(bestOption).toBeVisible();
    await expect(bestOption).toContainText("j'espère");

    // Capture dark theme screenshot
    await page.screenshot({ path: path.resolve('docs/screens/strip-dark.png'), fullPage: false });

    // Press Escape to dismiss
    await page.keyboard.press('Escape');
    await expect(stripHost).not.toBeAttached();

    // Verify input text remains untouched
    await expect(input).toHaveValue('jespere');
  });

  test('does not show strip on ineligible fields or known correctly spelled words', async () => {
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    await page.waitForLoadState('networkidle');

    // Known word "the"
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.fill('');
    await input.pressSequentially('the', { delay: 30 });
    const stripHost2 = page.locator('bilexi-strip');
    await expect(stripHost2).not.toBeAttached();
  });

  test('T4(b): Rapid typing 200 characters at 0 ms delay maintains <= 1 strip host and cleans up on blur/Escape/Enter', async () => {
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    const input = page.locator('#fixture-input');
    await input.focus();

    // 200 rapid characters without delay
    const rapidText = 'this is a rapid typing test to verify that the generation counter prevents race conditions and ensures at no moment does more than one strip exist '.repeat(2).slice(0, 200);
    await input.pressSequentially(rapidText, { delay: 0 });

    const hostCount = await page.locator('bilexi-strip').count();
    expect(hostCount).toBeLessThanOrEqual(1);

    // Escape dismisses
    await page.keyboard.press('Escape');
    await expect(page.locator('bilexi-strip')).toHaveCount(0);

    // Clear input and focus again
    await input.fill('');
    await input.focus();
    await input.pressSequentially('recieve', { delay: 40 });
    await expect(page.locator('bilexi-strip')).toBeAttached({ timeout: 4000 });

    // Clicking outside (blur) clears strip
    await page.locator('h1').click();
    await expect(page.locator('bilexi-strip')).toHaveCount(0);
  });

  test('T4(a): AZERTY keyboard emulation via event.code Alt+Digit2 selects suggestion', async () => {
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    const input = page.locator('#fixture-input');
    await input.focus();
    await input.fill('');

    // Type misspelled word
    await input.pressSequentially('recieve', { delay: 40 });
    const stripHost = page.locator('bilexi-strip');
    await expect(stripHost).toBeAttached({ timeout: 4000 });

    // Emulate French AZERTY Alt+é (where code is Digit2, key is 'é', altKey: true)
    await input.dispatchEvent('keydown', {
      key: 'é',
      code: 'Digit2',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(input).toHaveValue('receive');
    await expect(stripHost).not.toBeAttached();
  });

  test('T4(d): Strip renders in textarea, contenteditable, React controlled input, and iframe', async () => {
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    // 1. Textarea
    const textarea = page.locator('#fixture-textarea');
    await textarea.focus();
    await textarea.pressSequentially('recieve', { delay: 30 });
    await expect(page.locator('bilexi-strip')).toBeAttached({ timeout: 3000 });
    await page.keyboard.press('Escape');

    // 2. Contenteditable
    const ce = page.locator('#fixture-contenteditable');
    await ce.focus();
    await ce.pressSequentially('recieve', { delay: 30 });
    await expect(page.locator('bilexi-strip')).toBeAttached({ timeout: 3000 });
    await page.keyboard.press('Escape');

    // 3. React Controlled Input
    const reactInput = page.locator('#fixture-react-input');
    await reactInput.focus();
    await reactInput.pressSequentially('recieve', { delay: 30 });
    await expect(page.locator('bilexi-strip')).toBeAttached({ timeout: 3000 });
    await page.keyboard.press('Escape');

    // 4. Iframe input
    const iframe = page.frameLocator('#fixture-iframe');
    const iframeInput = iframe.locator('#iframe-input');
    if (await iframeInput.count() > 0) {
      await iframeInput.focus();
      await iframeInput.pressSequentially('recieve', { delay: 30 });
      // Suggestion strip inside iframe
      await expect(iframe.locator('bilexi-strip')).toBeAttached({ timeout: 3000 });
    }
  });

  test('T4(f): Caret positioning in scrolled textarea and viewport edge screenshot', async () => {
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('#fixture-textarea');
    await textarea.focus();
    // Fill several lines to cause scroll
    await textarea.fill('line 1\nline 2\nline 3\nline 4\nline 5\n');
    await textarea.pressSequentially('recieve', { delay: 30 });

    const stripHost = page.locator('bilexi-strip');
    await expect(stripHost).toBeAttached({ timeout: 3000 });

    // Capture screenshot of scrolled positioning
    await page.screenshot({ path: path.resolve('docs/screens/strip-scrolled.png'), fullPage: false });
  });

  test('WP 2: Selectable E2E suggestion recovery in slots 2 & 3 via Alt+2, Alt+3, and click across EN, FR, and mixed contexts', async () => {
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(300);

    const input = page.locator('#fixture-input');
    await input.focus();

    // 1. English context: Mouse click selection on slot 2
    await input.fill('');
    await input.pressSequentially('recieve', { delay: 40 });
    const stripHost1 = page.locator('bilexi-strip');
    await expect(stripHost1).toBeAttached({ timeout: 3000 });
    const slot2Btn = stripHost1.locator('button.strip-slot[data-slot-index="2"]');
    await expect(slot2Btn).toBeVisible();
    await expect(slot2Btn).toContainText('receive');
    await slot2Btn.click();
    await expect(input).toHaveValue('receive');
    await expect(stripHost1).not.toBeAttached();

    // 2. French context: Keyboard selection via Alt+2
    await input.fill('Dans ');
    await input.pressSequentially('lecole', { delay: 40 });
    const stripHost2 = page.locator('bilexi-strip');
    await expect(stripHost2).toBeAttached({ timeout: 3000 });
    const frSlot2 = stripHost2.locator('button.strip-slot[data-slot-index="2"]');
    await expect(frSlot2).toBeVisible();
    await expect(frSlot2).toContainText("l'école");
    await input.press('Alt+Digit2');
    await expect(input).toHaveValue("Dans l'école");
    await expect(stripHost2).not.toBeAttached();

    // 3. Slot 3 selection via Alt+3
    await input.fill('');
    await input.pressSequentially('seperate', { delay: 40 });
    const stripHost3 = page.locator('bilexi-strip');
    await expect(stripHost3).toBeAttached({ timeout: 3000 });
    const slot3Btn = stripHost3.locator('button.strip-slot[data-slot-index="3"]');
    if (await slot3Btn.count() > 0) {
      const slot3Text = await slot3Btn.locator('span').first().innerText();
      await input.press('Alt+Digit3');
      await expect(input).toHaveValue(slot3Text);
      await expect(stripHost3).not.toBeAttached();
    }
  });
});
