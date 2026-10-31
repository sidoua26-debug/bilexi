/**
 * scripts/generate-store-assets.ts
 *
 * Generates Chrome Web Store promotional and screenshot assets:
 * 1. Small Promo Tile (440x280)
 * 2. Marquee Promo Banner (1400x560)
 * 3. Feature In-Page Screenshot (1280x800)
 * 4. Options Page Screenshot (1280x800)
 */

import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

async function main() {
  const extPath = path.resolve('.output/chrome-mv3');
  const screensDir = path.resolve('docs/screens');
  if (!fs.existsSync(screensDir)) fs.mkdirSync(screensDir, { recursive: true });

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--no-sandbox',
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });

  const page = await context.newPage();

  // 1. Generate Small Promo Tile (440x280)
  await page.setViewportSize({ width: 440, height: 280 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          width: 440px;
          height: 280px;
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f766e 100%);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: white;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 24px;
          position: relative;
          overflow: hidden;
        }
        .header { display: flex; align-items: center; gap: 12px; }
        .icon {
          width: 44px;
          height: 44px;
          background: #0ea5e9;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 800;
          box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
        }
        .title { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
        .subtitle { font-size: 11px; color: #94a3b8; font-weight: 500; }
        .badge-row { display: flex; gap: 8px; margin-top: 4px; }
        .badge {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          color: #38bdf8;
        }
        .demo-box {
          background: rgba(15, 23, 42, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 12px;
          margin-top: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .text-demo { font-size: 13px; line-height: 1.5; color: #e2e8f0; }
        .corrected { color: #38bdf8; font-weight: 600; border-bottom: 2px solid #0284c7; }
        .footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #64748b;
          font-weight: 500;
        }
        .privacy-pill {
          display: flex;
          align-items: center;
          gap: 4px;
          color: #10b981;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="icon">BX</div>
        <div>
          <div class="title">Bilexi</div>
          <div class="subtitle">Bilingual Autocorrect · EN + FR · 100% Offline</div>
        </div>
      </div>
      <div class="demo-box">
        <div class="text-demo">
          I went to <span class="corrected">l'école</span> and <span class="corrected">j'espère</span> all works!
        </div>
      </div>
      <div class="footer">
        <div class="privacy-pill">🔒 Zero Data Sent · 100% Local</div>
        <div>v0.5.0 MV3</div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: path.join(screensDir, 'promo-small-440x280.png') });
  console.log('✅ Generated promo-small-440x280.png');

  // 2. Generate Marquee Promo Banner (1400x560)
  await page.setViewportSize({ width: 1400, height: 560 });
  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          width: 1400px;
          height: 560px;
          background: radial-gradient(circle at 80% 20%, #0369a1 0%, #0f172a 60%, #020617 100%);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          color: white;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 60px 80px;
          position: relative;
          overflow: hidden;
        }
        .left { max-width: 650px; }
        .tagline {
          font-size: 14px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #38bdf8;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .main-title {
          font-size: 46px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1.15;
          margin-bottom: 18px;
          background: linear-gradient(135deg, #ffffff 0%, #bae6fd 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .desc {
          font-size: 18px;
          line-height: 1.5;
          color: #94a3b8;
          margin-bottom: 28px;
        }
        .features { display: flex; gap: 16px; }
        .feat-item {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .right {
          width: 500px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 16px;
          padding: 28px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(12px);
        }
        .card-header {
          font-size: 12px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 16px;
        }
        .chat-bubble {
          background: #1e293b;
          border-radius: 10px;
          padding: 14px 18px;
          font-size: 16px;
          color: #f1f5f9;
          margin-bottom: 14px;
          border-left: 3px solid #38bdf8;
        }
        .highlight { color: #38bdf8; font-weight: 600; }
        .strip-preview {
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 8px 12px;
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .strip-slot {
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 13px;
          font-weight: 500;
        }
        .slot-active { background: #0284c7; color: white; }
        .slot-alt { color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="left">
        <div class="tagline">🔒 100% Offline Manifest V3</div>
        <h1 class="main-title">Bilexi: Bilingual Autocorrect for English & French</h1>
        <p class="desc">
          Smartphone-smooth typing in your desktop browser. Restores accents, repairs French elisions, and catches typos in real time without sending a single byte to the cloud.
        </p>
        <div class="features">
          <div class="feat-item">⚡ Sub-millisecond NLP</div>
          <div class="feat-item">⌨️ Alt+2/Alt+3 Suggestions</div>
          <div class="feat-item">↩️ Instant Backspace Undo</div>
        </div>
      </div>
      <div class="right">
        <div class="card-header">Interactive In-Page Correction</div>
        <div class="chat-bubble">
          Hier j'ai visité <span class="highlight">l'école</span> et nous avons parlé de notre projet.
        </div>
        <div class="strip-preview">
          <div class="strip-slot slot-active">1: l'école</div>
          <div class="strip-slot slot-alt">2: l'écoule</div>
          <div class="strip-slot slot-alt">3: l'étoile</div>
        </div>
      </div>
    </body>
    </html>
  `);
  await page.screenshot({ path: path.join(screensDir, 'promo-marquee-1400x560.png') });
  console.log('✅ Generated promo-marquee-1400x560.png');

  // Find extension ID from background service worker
  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extensionId = worker.url().split('/')[2];

  // 3. Generate Options Page Screenshot (1280x800)
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`chrome-extension://${extensionId}/options.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(screensDir, 'store-options.png') });
  console.log('✅ Generated store-options.png');

  // 4. Generate Popup Screenshot (1280x800 background with centered popup)
  const popupPage = await context.newPage();
  await popupPage.setViewportSize({ width: 1280, height: 800 });
  await popupPage.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            margin: 0;
            width: 1280px;
            height: 800px;
            background: #0f172a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }
          iframe {
            width: 320px;
            height: 480px;
            border: 1px solid #334155;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.6);
          }
        </style>
      </head>
      <body>
        <iframe src="chrome-extension://${extensionId}/popup.html"></iframe>
      </body>
    </html>
  `);
  await popupPage.waitForTimeout(600);
  await popupPage.screenshot({ path: path.join(screensDir, 'store-popup.png') });
  console.log('✅ Generated store-popup.png');
  await popupPage.close();

  await context.close();
  console.log('🎉 Store assets generation complete!');
}

main().catch(console.error);
