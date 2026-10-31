/**
 * E2E Test for Task 5(g): Popup Status from Real Engine State
 * Proves that popup displays live ready state with word counts,
 * and demonstrates explicit error state when a dictionary is missing.
 */

import path from 'node:path';
import fs from 'node:fs';
import { chromium, type BrowserContext } from 'playwright';

async function main() {
  console.log('=== Task 5(g): Testing Popup Live Engine Status ===\n');

  const extPath = path.resolve('.output/chrome-mv3');
  const browserCtx: BrowserContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--no-sandbox',
      '--headless=new',
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });

  try {
    // 1. Get Extension ID
    let extId = '';
    const serviceWorker = browserCtx.serviceWorkers()[0] || (await browserCtx.waitForEvent('serviceworker'));
    const swUrl = serviceWorker.url();
    const match = swUrl.match(/chrome-extension:\/\/([a-z0-9]+)\//);
    if (match && match[1]) {
      extId = match[1];
    } else {
      throw new Error(`Could not determine extension ID from ${swUrl}`);
    }

    console.log(`Extension ID: ${extId}`);
    const popupUrl = `chrome-extension://${extId}/popup.html`;

    // 2. Normal State: Open Popup
    const page = await browserCtx.newPage();
    await page.goto(popupUrl);
    await page.waitForLoadState('networkidle');

    // Wait for status text to populate
    const statusEl = page.locator('.status-bar, [role="status"], span');
    await page.waitForTimeout(500);
    const contentText = await page.content();
    console.log('\n1. Normal Status Check:');
    const readyMatch = contentText.match(/Engine: Ready[^<]*/);
    console.log(`  Rendered Text: "${readyMatch ? readyMatch[0] : 'Not found'}"`);
    if (!readyMatch || !readyMatch[0].includes('EN') || !readyMatch[0].includes('FR')) {
      throw new Error(`Expected ready state with EN and FR counts, got: ${readyMatch ? readyMatch[0] : 'None'}`);
    }
    console.log('  -> Live Ready State with word counts: PASS');

    // 3. Error State Demonstration: Remove fr.bin
    console.log('\n2. Error State Demonstration:');
    const frBinPath = path.join(extPath, 'dict/fr.bin');
    const frBinBackup = path.join(extPath, 'dict/fr.bin.bak');

    fs.renameSync(frBinPath, frBinBackup);
    console.log('  Moved dict/fr.bin -> dict/fr.bin.bak to simulate missing dictionary');

    try {
      // Re-trigger verification by reloading popup
      const pageErr = await browserCtx.newPage();
      await pageErr.goto(popupUrl);
      // Send REVERIFY_ENGINE_STATUS
      await pageErr.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'REVERIFY_ENGINE_STATUS' }, resolve);
        });
      });
      await pageErr.reload();
      await pageErr.waitForTimeout(500);

      const errContent = await pageErr.content();
      const errMatch = errContent.match(/Engine Error:[^<]*/);
      console.log(`  Rendered Error: "${errMatch ? errMatch[0] : 'Not found'}"`);
      if (!errMatch || !errMatch[0].toLowerCase().includes('failed')) {
        throw new Error(`Expected explicit error state, got: ${errMatch ? errMatch[0] : 'None'}`);
      }
      console.log('  -> Explicit Error State on missing dictionary: PASS');
    } finally {
      // Restore fr.bin
      if (fs.existsSync(frBinBackup)) {
        fs.renameSync(frBinBackup, frBinPath);
        console.log('  Restored dict/fr.bin');
      }
    }

  } finally {
    await browserCtx.close();
  }
}

main().catch((err) => {
  console.error('Popup status test failed:', err);
  process.exit(1);
});
