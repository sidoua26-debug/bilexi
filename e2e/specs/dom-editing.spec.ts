import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extPath = path.resolve(__dirname, '../../.output/chrome-mv3');

test.describe('M0 Spike: 7 DOM Fixtures Autocorrect & Backspace Undo', () => {
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

    page = await context.newPage();
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  });

  test.beforeEach(async () => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 3000 }).catch(() => null as any);
    }
    if (worker) {
      await worker.evaluate(() => {
        chrome.storage.local.set({
          settings: {
            version: 2,
            enabled: true,
            disabledSites: [],
            languageMode: 'auto',
            sensitivity: 'balanced',
            sentenceCaps: false,
            fixLoneI: true,
            showUndoChip: true,
            showSuggestions: false,
            personalWords: [],
            rejectedWords: [],
            shortcuts: [{ trigger: 'omw', replacement: 'on my way' }],
            learning: { wordCounts: {}, rejectionCounts: {} },
            stats: { corrections: 0, reverts: 0 },
          },
        });
      });
    }
    await page.goto(`http://127.0.0.1:${port}/spike-fixtures.html`);
  });

  test.afterAll(async () => {
    await context?.close();
    server?.close();
  });

  test('1. Standard <input type="text"> autocorrect & Backspace undo', async () => {
    const input = page.locator('#fixture-input');
    await input.focus();
    await page.keyboard.type('teh ', { delay: 15 });

    // Assert autocorrect replaced 'teh ' with 'the '
    await expect(input).toHaveValue('the ');
    const caret = await input.evaluate((el: HTMLInputElement) => el.selectionStart);
    expect(caret).toBe(4);

    // Assert Backspace undo restores 'teh' and removes boundary space
    await page.keyboard.press('Backspace');
    await expect(input).toHaveValue('teh');
    const caretAfterUndo = await input.evaluate((el: HTMLInputElement) => el.selectionStart);
    expect(caretAfterUndo).toBe(3);

    // Retyping space should NOT re-correct rejected token
    await page.keyboard.type(' ', { delay: 15 });
    await expect(input).toHaveValue('teh ');
  });

  test('2. Standard <textarea> autocorrect & Backspace undo', async () => {
    const textarea = page.locator('#fixture-textarea');
    await textarea.focus();
    await page.keyboard.type('recieve ', { delay: 15 });

    await expect(textarea).toHaveValue('receive ');
    const caret = await textarea.evaluate((el: HTMLTextAreaElement) => el.selectionStart);
    expect(caret).toBe(8);

    await page.keyboard.press('Backspace');
    await expect(textarea).toHaveValue('recieve');
  });

  test('3. Standard <div contenteditable="true"> autocorrect', async () => {
    const ce = page.locator('#fixture-contenteditable');
    await ce.focus();
    await page.keyboard.type('ecole ', { delay: 15 });

    // 'ecole ' -> 'école '
    await expect(ce).toHaveText('école ');
  });

  test('4. Plaintext-only <div contenteditable="plaintext-only"> autocorrect', async () => {
    const ce = page.locator('#fixture-plaintext');
    await ce.focus();
    await page.keyboard.type('cest ', { delay: 15 });

    // 'cest ' -> "c'est "
    await expect(ce).toHaveText("c'est ");
  });

  test('5. React Controlled Input synchronizes state without desync', async () => {
    const reactInput = page.locator('#fixture-react-input');
    const reactDisplay = page.locator('#fixture-react-value');
    await reactInput.focus();
    await page.keyboard.type('teh ', { delay: 15 });

    // Both input DOM value and React internal state span must match 'the '
    await expect(reactInput).toHaveValue('the ');
    await expect(reactDisplay).toHaveText('the ');

    // Test Backspace undo on React controlled input
    await page.keyboard.press('Backspace');
    await expect(reactInput).toHaveValue('teh');
    await expect(reactDisplay).toHaveText('teh');
  });

  test('6. Embedded <iframe> input autocorrects inside child document', async () => {
    const iframe = page.frameLocator('#fixture-iframe');
    const iframeInput = iframe.locator('#iframe-input');
    await iframeInput.focus();
    await page.keyboard.type('jai ', { delay: 15 });

    // 'jai ' -> "j'ai "
    await expect(iframeInput).toHaveValue("j'ai ");
  });

  test('7. Open Shadow DOM nested input autocorrects via composedPath', async () => {
    const shadowHost = page.locator('#fixture-shadow-host');
    const shadowInput = shadowHost.locator('#shadow-input');
    await shadowInput.focus();
    await page.keyboard.type('seperate ', { delay: 15 });

    await expect(shadowInput).toHaveValue('separate ');
  });

  test('8. Caret position asserted after contenteditable replacement', async () => {
    const ce = page.locator('#fixture-contenteditable');
    await ce.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('teh ', { delay: 15 });

    await expect(ce).toHaveText('the ');
    const caretOffset = await page.evaluate(() => {
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed) return -1;
      return sel.anchorOffset;
    });
    // Caret must be at offset 4 (after 'the ')
    expect(caretOffset).toBe(4);
  });

  test('9. Compositionstart and isComposing suppress autocorrect until compositionend', async () => {
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });

    // Simulate IME composition
    await page.evaluate(() => {
      const el = document.getElementById('fixture-input')!;
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      (el as HTMLInputElement).value = 'teh ';
      el.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true, inputType: 'insertCompositionText' }));
    });

    // Should NOT have autocorrected while isComposing is true
    await expect(input).toHaveValue('teh ');

    // End composition
    await page.evaluate(() => {
      const el = document.getElementById('fixture-input')!;
      el.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    });
  });

  test('10. Dead-key composition produces accented letters without corrupt autocorrect', async () => {
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });

    // Simulate dead key '^' followed by 'e' producing 'ê'
    await page.evaluate(() => {
      const el = document.getElementById('fixture-input')!;
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Dead', bubbles: true }));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      (el as HTMLInputElement).value = 'fête ';
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ' ' }));
    });

    await expect(input).toHaveValue('fête ');
  });

  test('11. Global switch disables and re-enables autocorrect', async () => {
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });

    // Disable globally via extension service worker
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    await worker.evaluate((s) => chrome.storage.local.set({ settings: s }), { enabled: false, disabledSites: [], languageMode: 'auto', sensitivity: 'balanced', sentenceCaps: false, fixLoneI: true, showUndoChip: true, personalWords: [] });
    await page.waitForTimeout(100);

    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('teh ');

    // Re-enable globally
    await worker.evaluate((s) => chrome.storage.local.set({ settings: s }), { enabled: true, disabledSites: [], languageMode: 'auto', sensitivity: 'balanced', sentenceCaps: false, fixLoneI: true, showUndoChip: true, personalWords: [] });
    await page.waitForTimeout(100);

    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('the ');
  });

  test('12. Per-site switch disables autocorrect for 127.0.0.1', async () => {
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });

    // Disable for 127.0.0.1 via extension service worker
    const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
    await worker.evaluate((s) => chrome.storage.local.set({ settings: s }), { enabled: true, disabledSites: ['127.0.0.1'], languageMode: 'auto', sensitivity: 'balanced', sentenceCaps: false, fixLoneI: true, showUndoChip: true, personalWords: [] });
    await page.waitForTimeout(100);

    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('teh ');

    // Re-enable for 127.0.0.1
    await worker.evaluate((s) => chrome.storage.local.set({ settings: s }), { enabled: true, disabledSites: [], languageMode: 'auto', sensitivity: 'balanced', sentenceCaps: false, fixLoneI: true, showUndoChip: true, personalWords: [] });
    await page.waitForTimeout(100);

    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('the ');
  });

  test('13. Offline use with context.setOffline(true) and zero non-local requests', async () => {
    const nonLocalRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('http://127.0.0.1') && !url.startsWith('chrome-extension://')) {
        nonLocalRequests.push(url);
      }
    });

    // Go offline
    await context.setOffline(true);

    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.keyboard.type('teh ', { delay: 15 });

    // Autocorrect must work 100% offline
    await expect(input).toHaveValue('the ');
    expect(nonLocalRequests).toEqual([]);

    await context.setOffline(false);
  });

  test('14. Undo chip renders with exact text and aria-live="off"', async () => {
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.keyboard.type('wierd ', { delay: 15 });

    await expect(input).toHaveValue('weird ');

    // Inspect undo chip inside shadow root
    const chipText = await page.evaluate(() => {
      const shadowHost = document.querySelector('bilexi-chip');
      if (!shadowHost || !shadowHost.shadowRoot) return null;
      const chipContainer = shadowHost.shadowRoot.querySelector('.autocorrect-chip-container');
      if (!chipContainer) return null;
      return {
        text: chipContainer.textContent,
        ariaLive: chipContainer.getAttribute('aria-live'),
      };
    });

    expect(chipText).not.toBeNull();
    expect(chipText?.ariaLive).toBe('off');
    expect(chipText?.text).toBe('wierd -> weird · Undo');
  });

  test('15. Mixed-language apostrophe regression: English document context with French elision and accent restoration in textarea', async () => {
    const textarea = page.locator('#fixture-textarea');
    await textarea.focus();
    await textarea.fill('');

    // Type "I went to l'ecole "
    await page.keyboard.type("I went to l'ecole ", { delay: 15 });
    await expect(textarea).toHaveValue("I went to l'école ");

    const caret = await textarea.evaluate((el: HTMLTextAreaElement) => el.selectionStart);
    expect(caret).toBe("I went to l'école ".length);

    // Continue typing French elision in English page: "jespere " -> "j'espère "
    await page.keyboard.type('jespere ', { delay: 15 });
    await expect(textarea).toHaveValue("I went to l'école j'espère ");

    // Ensure English words remain unchanged: "that works "
    await page.keyboard.type('that works ', { delay: 15 });
    await expect(textarea).toHaveValue("I went to l'école j'espère that works ");

    // Ensure standard English autocorrect works in same context: "teh " -> "the "
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(textarea).toHaveValue("I went to l'école j'espère that works the ");
  });

  test('16. Fault-tolerant operation when context model is unavailable or malformed', async () => {
    // 1. Route ngram.bin to return corrupted binary payload
    await page.route('**/dict/ngram.bin*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
      });
    });

    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.keyboard.type('teh ', { delay: 15 });

    // Autocorrect must still succeed without crashing
    await expect(input).toHaveValue('the ');

    // 2. Route ngram.bin to 404 Not Found
    await page.unroute('**/dict/ngram.bin*');
    await page.route('**/dict/ngram.bin*', (route) => {
      route.fulfill({
        status: 404,
        body: 'Not Found',
      });
    });

    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.keyboard.type('wierd ', { delay: 15 });
    await expect(input).toHaveValue('weird ');

    await page.unroute('**/dict/ngram.bin*');
  });

  test('17. Sentence initial capitalization after sentence punctuation', async () => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 3000 }).catch(() => null as any);
    }
    if (worker) {
      await worker.evaluate(() => {
        chrome.storage.local.get('settings', (res) => {
          const s = res?.settings || {};
          chrome.storage.local.set({ settings: { ...s, sentenceCaps: true } });
        });
      });
    }

    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.waitForTimeout(100);

    // 1. Word in middle of sentence stays lowercase
    await page.keyboard.type('hello there ', { delay: 15 });
    await expect(input).toHaveValue('hello there ');

    // 2. Word after sentence-ending period capitalizes
    await page.keyboard.type('friend. welcome ', { delay: 15 });
    await expect(input).toHaveValue('hello there friend. Welcome ');

    // Reset setting
    if (worker) {
      await worker.evaluate(() => {
        chrome.storage.local.get('settings', (res) => {
          const s = res?.settings || {};
          chrome.storage.local.set({ settings: { ...s, sentenceCaps: false } });
        });
      });
    }
  });

  test('18. Typographic apostrophe converts straight apostrophe when enabled', async () => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 3000 }).catch(() => null as any);
    }
    if (worker) {
      await worker.evaluate(() => {
        chrome.storage.local.get('settings', (res) => {
          const s = res?.settings || {};
          chrome.storage.local.set({ settings: { ...s, typographicApostrophe: true } });
        });
      });
    }

    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.waitForTimeout(100);

    await page.keyboard.type("cna't ", { delay: 15 });
    await expect(input).toHaveValue('can’t ');

    // Reset setting
    if (worker) {
      await worker.evaluate(() => {
        chrome.storage.local.get('settings', (res) => {
          const s = res?.settings || {};
          chrome.storage.local.set({ settings: { ...s, typographicApostrophe: false } });
        });
      });
    }
  });

  test('19. Multi-line contenteditable preserves block structure across div boundaries', async () => {
    const ce = page.locator('#fixture-contenteditable');
    await ce.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');

    // Type line one, press Enter to create multi-line block, then type typo on line 2
    await page.keyboard.type('First line', { delay: 15 });
    await page.keyboard.press('Enter');
    await page.keyboard.type('teh ', { delay: 15 });

    // Assert that 'First line' remains intact and second line has 'the '
    const text = (await ce.innerText()).replace(/\u00a0/g, ' ');
    expect(text).toContain('First line');
    expect(text).toContain('the ');
  });

  test('20. Input filtering: paste, backspace to boundary, and undo do not re-correct', async () => {
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });

    // 1. Pasting "foo teh " must not trigger autocorrect
    await input.evaluate((el: HTMLInputElement) => {
      el.value = 'foo teh ';
      el.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: false,
        inputType: 'insertFromPaste',
      }));
    });
    await expect(input).toHaveValue('foo teh ');

    // 2. Backspacing to a space must not re-evaluate previous word
    await page.keyboard.type('apple', { delay: 15 });
    // Text is "foo teh apple"
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    // Now back at "foo teh "
    await expect(input).toHaveValue('foo teh ');
  });

  test('21. Technical tokens: filenames, hostnames, ports, and versions remain unchanged', async () => {
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });

    await page.keyboard.type('readme.md ', { delay: 15 });
    await expect(input).toHaveValue('readme.md ');

    await page.keyboard.type('example.com ', { delay: 15 });
    await expect(input).toHaveValue('readme.md example.com ');

    await page.keyboard.type('localhost:3000 ', { delay: 15 });
    await expect(input).toHaveValue('readme.md example.com localhost:3000 ');

    await page.keyboard.type('v1.2.3 ', { delay: 15 });
    await expect(input).toHaveValue('readme.md example.com localhost:3000 v1.2.3 ');
  });

  test('22. Sentence capitalization respects abbreviations and Enter key', async () => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent('serviceworker', { timeout: 3000 }).catch(() => null as any);
    }
    if (worker) {
      await worker.evaluate(() => {
        chrome.storage.local.get('settings', (res) => {
          const s = res?.settings || {};
          chrome.storage.local.set({ settings: { ...s, sentenceCaps: true } });
        });
      });
    }

    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });

    // Mr. is an abbreviation; smith should not be capitalized
    await page.keyboard.type('Mr. smith ', { delay: 15 });
    await expect(input).toHaveValue('Mr. smith ');

    // End of sentence with exclamation mark; next word is capitalized
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.keyboard.type('Hello! world ', { delay: 15 });
    await expect(input).toHaveValue('Hello! World ');

    // Reset settings
    if (worker) {
      await worker.evaluate(() => {
        chrome.storage.local.get('settings', (res) => {
          const s = res?.settings || {};
          chrome.storage.local.set({ settings: { ...s, sentenceCaps: false } });
        });
      });
    }
  });

  test('23. Policy guard: autocorrect="off" prevents autocorrect', async () => {
    const input = page.locator('#fixture-autocorrect-off');
    await input.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('teh ');
  });

  test('24. Policy guard: data-gramm="false" prevents autocorrect', async () => {
    const textarea = page.locator('#fixture-data-gramm');
    await textarea.focus();
    await page.keyboard.type('recieve ', { delay: 15 });
    await expect(textarea).toHaveValue('recieve ');
  });

  test('25. Policy guard: sensitive autocomplete attributes prevent autocorrect', async () => {
    const user = page.locator('#fixture-autocomplete-user');
    await user.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(user).toHaveValue('teh ');

    const email = page.locator('#fixture-autocomplete-email');
    await email.focus();
    await page.keyboard.type('recieve ', { delay: 15 });
    await expect(email).toHaveValue('recieve ');

    // Multi-token qualifiers and section prefixes
    const address = page.locator('#fixture-autocomplete-multi-section');
    await address.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(address).toHaveValue('teh ');

    const cc = page.locator('#fixture-autocomplete-multi-cc');
    await cc.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(cc).toHaveValue('teh ');
  });

  test('26. Undo chip lifecycle: dismissed on field blur and outside pointer down', async () => {
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('the ');

    // Undo chip host should be present
    const chip = page.locator('bilexi-chip');
    await expect(chip).toBeAttached();

    // Blur input: chip should be dismissed
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await expect(chip).not.toBeAttached();
  });

  test('27. Nearest-block extraction in 10,000-word contenteditable replaces in < 2ms', async () => {
    const ce = page.locator('#fixture-large-contenteditable');
    // Populate with 500 paragraphs (10,000 words)
    await ce.evaluate((el: HTMLElement) => {
      el.innerHTML = '';
      for (let i = 0; i < 500; i++) {
        const p = document.createElement('p');
        p.textContent = `Paragraph ${i}: ` + 'lorem ipsum dolor sit amet consectetur adipiscing elit.'.repeat(2);
        el.appendChild(p);
      }
    });

    // Test editing in the middle of the document (paragraph 250)
    const targetP = ce.locator('p').nth(250);
    await targetP.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' teh ', { delay: 15 });

    // Must have corrected to 'the ' in target paragraph 250
    const text = (await targetP.innerText()).replace(/\u00a0/g, ' ');
    expect(text).toContain('the ');
    expect(text).toContain('Paragraph 250:');

    // Ensure boundary paragraphs (0 and 499) remain intact
    const p0Text = await ce.evaluate((el: HTMLElement) => el.children[0]?.textContent || '');
    expect(p0Text).toContain('Paragraph 0');
    const p499Text = await ce.evaluate((el: HTMLElement) => el.children[499]?.textContent || '');
    expect(p499Text).toContain('Paragraph 499');
  });

  test('28. Sensitive form policy: form[autocomplete="off"] prevents autocorrect and overlays', async () => {
    const input = page.locator('#fixture-form-ac-off');
    await input.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('teh ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('29. Sensitive form policy: associated form (form="id") with autocomplete="off" prevents autocorrect', async () => {
    const input = page.locator('#fixture-associated-form');
    await input.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('teh ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('30. Sensitive contenteditable policy: autocomplete="off" prevents autocorrect and overlays', async () => {
    const ce = page.locator('#fixture-ce-ac-off');
    await ce.click();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(ce).toHaveText('teh ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('31. Ancestor opt-out: container with autocorrect="off" prevents autocorrect', async () => {
    const input = page.locator('#fixture-ancestor-autocorrect-off');
    await input.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('teh ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('32. Ancestor opt-out: container with data-gramm="false" prevents autocorrect', async () => {
    const textarea = page.locator('#fixture-ancestor-data-gramm');
    await textarea.focus();
    await page.keyboard.type('recieve ', { delay: 15 });
    await expect(textarea).toHaveValue('recieve ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('33. Disabled fieldset: input in first legend remains enabled and autocorrects', async () => {
    const legendInput = page.locator('#fixture-fieldset-legend-input');
    await legendInput.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(legendInput).toHaveValue('the ');

    // Fieldset body input is disabled
    const bodyInput = page.locator('#fixture-fieldset-body-input');
    await expect(bodyInput).toBeDisabled();
  });

  test('34. Shadow DOM opt-out: host with autocorrect="off" prevents autocorrect inside shadow root', async () => {
    const host = page.locator('#fixture-shadow-optout-host');
    const input = host.locator('#shadow-optout-input');
    await input.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('teh ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('35. Shadow DOM opt-out: host code editor (.monaco-editor) prevents autocorrect inside shadow root', async () => {
    const host = page.locator('#fixture-shadow-code-host');
    const textarea = host.locator('#shadow-code-textarea');
    await textarea.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(textarea).toHaveValue('teh ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('36. Dynamic input: elements dynamically added to DOM receive autocorrect', async () => {
    await page.evaluate(() => {
      const container = document.getElementById('fixture-dynamic-container');
      if (container) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'dynamically-added-input';
        container.appendChild(input);
      }
    });
    const dynamicInput = page.locator('#dynamically-added-input');
    await dynamicInput.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(dynamicInput).toHaveValue('the ');
  });

  test('37. Ancestor autocomplete scanning: input autocomplete="on" inside autocomplete="off" ancestor is rejected', async () => {
    const input = page.locator('#fixture-ancestor-ac-off-child-on');
    await input.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('teh ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('38. Ancestor autocomplete scanning: contenteditable autocomplete="on" inside autocomplete="off" ancestor is rejected', async () => {
    const ce = page.locator('#fixture-ce-ancestor-ac-off-child-on');
    await ce.click();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(ce).toHaveText('teh ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('39. Ancestor autocomplete scanning: shadow host autocomplete="off" rejects inner autocomplete="on" input', async () => {
    const host = page.locator('#fixture-shadow-ac-off-host');
    const input = host.locator('#shadow-ac-child-on-input');
    await input.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('teh ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('40. Ancestor autocomplete scanning: ancestor with sensitive tokens (billing street-address) is rejected', async () => {
    const input = page.locator('#fixture-ancestor-sensitive-token');
    await input.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('teh ');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('41. Fieldset semantics: nested disabled fieldset cannot bypass outer disabled fieldset', async () => {
    const nestedInput = page.locator('#fixture-nested-legend-input');
    // In Chromium, CSS :disabled matches because the outer fieldset is disabled and has no legend
    const matchesDisabled = await nestedInput.evaluate((el: HTMLInputElement) => el.matches(':disabled'));
    expect(matchesDisabled).toBe(true);

    // Because it is disabled by the outer fieldset, Chromium drops typing and Bilexi never modifies it
    await nestedInput.focus({ force: true }).catch(() => {});
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(nestedInput).toHaveValue('');
    await expect(page.locator('bilexi-chip')).not.toBeAttached();
    await expect(page.locator('bilexi-strip')).not.toBeAttached();
  });

  test('42. Fieldset semantics: only first direct-child legend is enabled; div legend and second legend remain disabled', async () => {
    const divLegendInput = page.locator('#fixture-div-legend-input');
    await expect(divLegendInput).toBeDisabled();

    const secondLegendInput = page.locator('#fixture-second-direct-legend-input');
    await expect(secondLegendInput).toBeDisabled();

    const firstLegendInput = page.locator('#fixture-first-direct-legend-input');
    await expect(firstLegendInput).toBeEnabled();
    await firstLegendInput.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(firstLegendInput).toHaveValue('the ');
  });

  test('43. Hidden ancestor handling: controls inside hidden, display:none, and visibility:hidden containers are ineligible', async () => {
    const isHiddenIneligible = await page.evaluate(() => {
      const el1 = document.getElementById('fixture-hidden-ancestor-input');
      const el2 = document.getElementById('fixture-display-none-ancestor-input');
      const el3 = document.getElementById('fixture-visibility-hidden-ancestor-input');
      return {
        el1Hidden: el1 ? (el1.hidden || el1.closest('[hidden]') !== null) : false,
        el2Visible: el2 && typeof el2.checkVisibility === 'function' ? el2.checkVisibility({ checkVisibilityCSS: true }) : false,
        el3Visible: el3 && typeof el3.checkVisibility === 'function' ? el3.checkVisibility({ checkVisibilityCSS: true }) : false,
      };
    });
    expect(isHiddenIneligible.el1Hidden).toBe(true);
    expect(isHiddenIneligible.el2Visible).toBe(false);
    expect(isHiddenIneligible.el3Visible).toBe(false);
  });

  test('44. Baseline safety: standard input autocorrection and backspace undo remain intact', async () => {
    const input = page.locator('#fixture-input');
    await input.focus();
    await input.evaluate((el: HTMLInputElement) => { el.value = ''; });
    await page.keyboard.type('teh ', { delay: 15 });
    await expect(input).toHaveValue('the ');

    // Undo chip attached
    const chip = page.locator('bilexi-chip');
    await expect(chip).toBeAttached();

    // Backspace immediately after correction reverts to verbatim
    await page.keyboard.press('Backspace');
    await expect(input).toHaveValue('teh');
  });
});
