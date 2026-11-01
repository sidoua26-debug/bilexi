/**
 * scripts/generate-redesigned-store-assets.ts
 *
 * Professional Chrome Web Store Asset Redesign Suite for Bilexi:
 * - 5 Marketing Screenshot Slides (1280 x 800 px, 16:10)
 * - 1 Small Promo Tile (440 x 280 px)
 * - 1 Marquee Banner (1400 x 560 px)
 * - Complete Icon & Logo Suite (512, 256, 128, 48, 32, 16 px)
 */

import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SCREENS_DIR = path.resolve('docs/screens');
const REDESIGN_DIR = path.resolve('docs/screens/redesign');
const ICONS_DIR = path.resolve('public/icons');

if (!fs.existsSync(REDESIGN_DIR)) fs.mkdirSync(REDESIGN_DIR, { recursive: true });

// Read refined SVG icon
const ICON_SVG = fs.readFileSync(path.join(REDESIGN_DIR, 'bilexi-icon.svg'), 'utf-8');

// Shared CSS styles for all slides
const COMMON_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  
  * { box-sizing: border-box; margin: 0; padding: 0; }
  
  body {
    width: 1280px;
    height: 800px;
    background-color: #080C14;
    background-image: 
      radial-gradient(circle at 50% -10%, #1E3A8A 0%, rgba(15, 23, 42, 0) 55%),
      radial-gradient(circle at 90% 90%, #0369A1 0%, rgba(15, 23, 42, 0) 45%),
      radial-gradient(rgba(255, 255, 255, 0.07) 1px, transparent 1px);
    background-size: 100% 100%, 100% 100%, 24px 24px;
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #F8FAFC;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 44px 56px 40px 56px;
  }

  .header-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 960px;
    z-index: 10;
  }

  .badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(37, 99, 235, 0.14);
    border: 1px solid rgba(56, 189, 248, 0.35);
    padding: 6px 14px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #38BDF8;
    width: fit-content;
    box-shadow: 0 0 16px rgba(56, 189, 248, 0.2);
  }

  .headline {
    font-size: 38px;
    font-weight: 800;
    letter-spacing: -0.025em;
    line-height: 1.15;
    background: linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 60%, #93C5FD 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subheadline {
    font-size: 16px;
    line-height: 1.45;
    color: #94A3B8;
    font-weight: 500;
    max-width: 820px;
  }

  .stage-container {
    flex: 1;
    position: relative;
    margin-top: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  /* macOS Style Window Frame */
  .window-card {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    box-shadow: 0 25px 60px -10px rgba(0, 0, 0, 0.7), 0 0 40px rgba(37, 99, 235, 0.15);
    backdrop-filter: blur(16px);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .window-topbar {
    height: 40px;
    background: rgba(30, 41, 59, 0.6);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 8px;
  }

  .dot { width: 11px; height: 11px; border-radius: 50%; }
  .dot-red { background: #EF4444; }
  .dot-yellow { background: #F59E0B; }
  .dot-green { background: #10B981; }

  .window-title {
    margin-left: auto;
    margin-right: auto;
    font-size: 12px;
    font-weight: 600;
    color: #64748B;
    letter-spacing: 0.02em;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .footer-bar {
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 600;
    color: #64748B;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 12px;
    margin-top: auto;
  }

  .footer-pills {
    display: flex;
    gap: 16px;
  }

  .footer-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #94A3B8;
  }

  .footer-pill.green { color: #10B981; font-weight: 700; }
`;

async function generateAllAssets() {
  console.log('🚀 Starting Chrome Web Store Redesign Asset Generation...');
  const browser = await chromium.launch({ headless: true });

  // -------------------------------------------------------------
  // SLIDE 1: Hero — Real-Time Bilingual Autocorrect (EN/FR)
  // -------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${COMMON_CSS}
          .editor-body {
            padding: 32px 40px;
            font-size: 20px;
            line-height: 1.8;
            color: #E2E8F0;
            position: relative;
          }
          .caret {
            display: inline-block;
            width: 2px;
            height: 24px;
            background: #38BDF8;
            vertical-align: text-bottom;
            animation: blink 1s infinite;
          }
          .corrected-word {
            color: #38BDF8;
            font-weight: 700;
            position: relative;
            background: rgba(56, 189, 248, 0.12);
            padding: 2px 6px;
            border-radius: 4px;
            border-bottom: 2px solid #0284C7;
          }
          .undo-chip-floating {
            position: absolute;
            top: 80px;
            left: 320px;
            background: #1E293B;
            border: 1px solid #38BDF8;
            border-radius: 8px;
            padding: 8px 14px;
            display: flex;
            align-items: center;
            gap: 10px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 16px rgba(56,189,248,0.25);
            font-size: 13px;
            color: #F8FAFC;
            z-index: 20;
          }
          .undo-chip-btn {
            background: rgba(56, 189, 248, 0.2);
            color: #38BDF8;
            border: none;
            padding: 3px 8px;
            border-radius: 4px;
            font-weight: 700;
            font-size: 12px;
            cursor: pointer;
          }
          .feature-card-row {
            display: flex;
            gap: 16px;
            margin-top: 24px;
            padding: 0 40px 32px 40px;
          }
          .feat-card {
            flex: 1;
            background: rgba(30, 41, 59, 0.5);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 14px 18px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .feat-icon {
            font-size: 20px;
            width: 36px;
            height: 36px;
            background: rgba(37, 99, 235, 0.2);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .feat-text h4 { font-size: 13px; font-weight: 700; color: #F1F5F9; }
          .feat-text p { font-size: 11px; color: #94A3B8; margin-top: 2px; }
        </style>
      </head>
      <body>
        <div class="header-group">
          <div class="badge-pill">⚡ Real-Time NLP Engine · Manifest V3</div>
          <h1 class="headline">Effortless Bilingual Typing in Real Time</h1>
          <p class="subheadline">
            Seamlessly type across English and French without switching modes. Restores accents, repairs contractions, and fixes keyboard slips instantly.
          </p>
        </div>

        <div class="stage-container">
          <div class="window-card" style="width: 1100px;">
            <div class="window-topbar">
              <div class="dot dot-red"></div>
              <div class="dot dot-yellow"></div>
              <div class="dot dot-green"></div>
              <div class="window-title">📝 bilingual-notes.md · Bilexi Live Protection</div>
            </div>

            <div class="editor-body">
              <div style="position: relative; margin-bottom: 56px;">
                Hier matin, nous sommes allés à <span class="corrected-word">l'école</span> pour finaliser le projet.
                <div class="undo-chip-floating" style="position: absolute; top: 42px; left: 280px;">
                  <span>↩ Replaced <strong>"lecole"</strong> → <strong>"l'école"</strong></span>
                  <span class="undo-chip-btn">Backspace to Undo</span>
                </div>
              </div>
              <p style="color: #94A3B8;">
                The entire report is finished, and <span class="corrected-word">don't</span> forget to submit your feedback today<span class="caret"></span>
              </p>
            </div>

            <div class="feature-card-row">
              <div class="feat-card">
                <div class="feat-icon">🎯</div>
                <div class="feat-text">
                  <h4>Accent Restoration</h4>
                  <p>ecole → école · deja → déjà</p>
                </div>
              </div>
              <div class="feat-card">
                <div class="feat-icon">✨</div>
                <div class="feat-text">
                  <h4>Elision Repair</h4>
                  <p>cest → c'est · dont → don't</p>
                </div>
              </div>
              <div class="feat-card">
                <div class="feat-icon">↩️</div>
                <div class="feat-text">
                  <h4>Zero-Friction Undo</h4>
                  <p>Instant revert with Backspace</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-bar">
          <div class="footer-pills">
            <div class="footer-pill green">🔒 100% Offline & Private</div>
            <div class="footer-pill">⚡ Sub-0.2ms Keystroke Latency</div>
            <div class="footer-pill">🌐 Zero Cloud Network Telemetry</div>
          </div>
          <div>Bilexi v0.5.1</div>
        </div>
      </body>
      </html>
    `);
    const file1 = path.join(REDESIGN_DIR, 'store-screenshot-01-hero.png');
    await page.screenshot({ path: file1 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'store-screenshot-01.png') });
    console.log('✅ Generated Screenshot 1: Hero');
    await page.close();
  }

  // -------------------------------------------------------------
  // SLIDE 2: Interactive Suggestion Strip (Alt+2 / Alt+3)
  // -------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${COMMON_CSS}
          .strip-stage {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            gap: 28px;
          }
          .input-mockup {
            width: 900px;
            background: #0F172A;
            border: 2px solid #2563EB;
            border-radius: 12px;
            padding: 24px 30px;
            font-size: 22px;
            color: #F1F5F9;
            box-shadow: 0 0 35px rgba(37, 99, 235, 0.25);
            position: relative;
          }
          .suggestion-strip {
            position: absolute;
            top: -56px;
            left: 280px;
            background: #0F172A;
            border: 1px solid #38BDF8;
            border-radius: 10px;
            padding: 6px 10px;
            display: flex;
            gap: 10px;
            align-items: center;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.35);
            z-index: 30;
          }
          .slot {
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
          }
          .slot-best {
            background: #0284C7;
            color: #FFFFFF;
            border: 1px solid #38BDF8;
          }
          .slot-alt {
            background: rgba(30, 41, 59, 0.8);
            color: #E2E8F0;
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .slot-badge {
            background: rgba(0, 0, 0, 0.3);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            font-family: 'JetBrains Mono', monospace;
            color: #BAE6FD;
          }
          .slot-orig {
            color: #64748B;
            font-size: 13px;
          }
          .key-guide-row {
            display: flex;
            gap: 24px;
            width: 900px;
            justify-content: center;
          }
          .key-guide-card {
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            padding: 16px 22px;
            display: flex;
            align-items: center;
            gap: 14px;
            flex: 1;
          }
          .key-badge {
            background: #1E293B;
            border: 1px solid #475569;
            border-bottom: 3px solid #334155;
            padding: 6px 12px;
            border-radius: 6px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 14px;
            font-weight: 700;
            color: #38BDF8;
          }
          .key-desc h5 { font-size: 14px; font-weight: 700; color: #F8FAFC; }
          .key-desc p { font-size: 12px; color: #94A3B8; margin-top: 2px; }
        </style>
      </head>
      <body>
        <div class="header-group">
          <div class="badge-pill">⌨️ Two-Tier Interactive Suggestion Strip</div>
          <h1 class="headline">Multi-Candidate Suggestions at Your Fingertips</h1>
          <p class="subheadline">
            For ambiguous or multi-choice words, Bilexi presents an interactive strip. Press Alt+2, Alt+3, or click to apply alternatives without losing caret focus.
          </p>
        </div>

        <div class="stage-container">
          <div class="strip-stage">
            <div class="input-mockup">
              <div class="suggestion-strip">
                <div class="slot slot-best">
                  <span class="slot-badge">Space</span>
                  <span>1: j'espère</span>
                </div>
                <div class="slot slot-alt">
                  <span class="slot-badge">Alt+2</span>
                  <span>2: j'espérais</span>
                </div>
                <div class="slot slot-alt">
                  <span class="slot-badge">Alt+3</span>
                  <span>3: j'espérerai</span>
                </div>
                <div class="slot-orig">
                  <span style="font-size: 11px;">[Esc]</span> jespere
                </div>
              </div>

              <span>Dans ce contexte, </span>
              <span style="background: rgba(56,189,248,0.15); border-bottom: 2px solid #38BDF8; padding: 0 4px;">jespere</span>
              <span class="caret" style="display: inline-block; width: 2px; height: 26px; background: #38BDF8; vertical-align: text-bottom;"></span>
              <span style="color: #64748B;"> que vous viendrez demain.</span>
            </div>

            <div class="key-guide-row">
              <div class="key-guide-card">
                <div class="key-badge">Space</div>
                <div class="key-desc">
                  <h5>Automatic Primary</h5>
                  <p>Accepts the #1 ranked candidate instantly</p>
                </div>
              </div>
              <div class="key-guide-card">
                <div class="key-badge">Alt + 2</div>
                <div class="key-desc">
                  <h5>Alternate Slot 2</h5>
                  <p>Instant selection across AZERTY & QWERTY</p>
                </div>
              </div>
              <div class="key-guide-card">
                <div class="key-badge">Escape</div>
                <div class="key-desc">
                  <h5>Verbatim Keystrokes</h5>
                  <p>Dismisses suggestions and keeps raw typed text</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-bar">
          <div class="footer-pills">
            <div class="footer-pill green">⚡ Zero Focus Desync</div>
            <div class="footer-pill">🛡️ Strict Double-Rejection Auto-Ignore</div>
            <div class="footer-pill">🎨 Automatic Dark & Light Mode Support</div>
          </div>
          <div>Bilexi v0.5.1</div>
        </div>
      </body>
      </html>
    `);
    const file2 = path.join(REDESIGN_DIR, 'store-screenshot-02-suggestions.png');
    await page.screenshot({ path: file2 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'store-screenshot-02.png') });
    console.log('✅ Generated Screenshot 2: Suggestions');
    await page.close();
  }

  // -------------------------------------------------------------
  // SLIDE 3: 100% Offline Architecture & Absolute Privacy
  // -------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${COMMON_CSS}
          .arch-row {
            display: flex;
            gap: 24px;
            width: 1100px;
          }
          .arch-card {
            flex: 1;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            padding: 28px;
            display: flex;
            flex-direction: column;
            gap: 18px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
          }
          .arch-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding-bottom: 14px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }
          .shield-icon {
            width: 42px;
            height: 42px;
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.3);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
          }
          .arch-header h3 { font-size: 18px; font-weight: 700; color: #F8FAFC; }
          .arch-item {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            font-size: 14px;
            line-height: 1.5;
            color: #CBD5E1;
          }
          .check-bullet {
            color: #10B981;
            font-weight: 800;
            font-size: 16px;
          }
          .metric-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 10px;
          }
          .metric-box {
            background: rgba(30, 41, 59, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
            padding: 14px;
            text-align: center;
          }
          .metric-num {
            font-size: 28px;
            font-weight: 800;
            color: #38BDF8;
            font-family: 'JetBrains Mono', monospace;
          }
          .metric-num.green { color: #10B981; }
          .metric-label {
            font-size: 11px;
            font-weight: 600;
            color: #94A3B8;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-top: 4px;
          }
          .alert-box {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.25);
            border-radius: 8px;
            padding: 10px 14px;
            font-size: 12px;
            color: #FCA5A5;
            display: flex;
            align-items: center;
            gap: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header-group">
          <div class="badge-pill">🔒 100% Offline & Private by Design</div>
          <h1 class="headline">Zero Keystrokes Ever Leave Your Browser</h1>
          <p class="subheadline">
            All dictionaries and language models execute inside the browser's local sandbox. No remote servers, no cloud telemetry, and zero network requests.
          </p>
        </div>

        <div class="stage-container">
          <div class="arch-row">
            <!-- Left Card: Security & Offline Guarantee -->
            <div class="arch-card">
              <div class="arch-header">
                <div class="shield-icon">🛡️</div>
                <div>
                  <h3>Local Sandbox Isolation</h3>
                  <p style="font-size: 12px; color: #10B981; font-weight: 600;">Verified Zero-Network Architecture</p>
                </div>
              </div>
              <div class="arch-item">
                <span class="check-bullet">✓</span>
                <div><strong>100% On-Device NLP:</strong> High-performance binary dictionaries (7.6 MB) run in-memory with zero remote calls.</div>
              </div>
              <div class="arch-item">
                <span class="check-bullet">✓</span>
                <div><strong>Zero Analytics or Telemetry:</strong> No tracking pixels, crash reporters, or external network requests.</div>
              </div>
              <div class="arch-item">
                <span class="check-bullet">✓</span>
                <div><strong>Strict Password & OTP Guards:</strong> Automatically ignores password fields, credit cards, and sensitive forms.</div>
              </div>
              <div class="arch-item">
                <span class="check-bullet">✓</span>
                <div><strong>Code Editor Protection:</strong> Disables on Monaco, Ace, and terminal inputs to protect developers.</div>
              </div>
            </div>

            <!-- Right Card: Performance Metrics -->
            <div class="arch-card">
              <div class="arch-header">
                <div class="shield-icon" style="background: rgba(56, 189, 248, 0.15); border-color: rgba(56, 189, 248, 0.3);">⚡</div>
                <div>
                  <h3>Benchmarked Engine Speed</h3>
                  <p style="font-size: 12px; color: #38BDF8; font-weight: 600;">Sub-Millisecond Keystroke Processing</p>
                </div>
              </div>
              <div class="metric-grid">
                <div class="metric-box">
                  <div class="metric-num green">0.00 B</div>
                  <div class="metric-label">Network Egress</div>
                </div>
                <div class="metric-box">
                  <div class="metric-num">0.34 ms</div>
                  <div class="metric-label">Stream Latency (p95)</div>
                </div>
                <div class="metric-box">
                  <div class="metric-num">97.96%</div>
                  <div class="metric-label">English Precision</div>
                </div>
                <div class="metric-box">
                  <div class="metric-num">96.33%</div>
                  <div class="metric-label">French Precision</div>
                </div>
              </div>
              <div class="alert-box">
                <span>🛡️</span>
                <span>Permissions Snapshot: Strictly <code>storage</code> & <code>activeTab</code> only.</span>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-bar">
          <div class="footer-pills">
            <div class="footer-pill green">🔒 Zero Network Activity</div>
            <div class="footer-pill">🛡️ Chrome Web Store Limited Use Compliant</div>
            <div class="footer-pill">📄 Open Source MIT & MPL Licenses</div>
          </div>
          <div>Bilexi v0.5.1</div>
        </div>
      </body>
      </html>
    `);
    const file3 = path.join(REDESIGN_DIR, 'store-screenshot-03-privacy.png');
    await page.screenshot({ path: file3 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'store-screenshot-03.png') });
    console.log('✅ Generated Screenshot 3: Privacy');
    await page.close();
  }

  // -------------------------------------------------------------
  // SLIDE 4: Personal Dictionary & Text Expansion Shortcuts
  // -------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${COMMON_CSS}
          .options-mockup {
            width: 1050px;
            background: #0F172A;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 14px;
            overflow: hidden;
            display: flex;
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
          }
          .options-sidebar {
            width: 240px;
            background: #0B1120;
            border-right: 1px solid rgba(255, 255, 255, 0.08);
            padding: 24px 16px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .side-tab {
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            color: #94A3B8;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .side-tab.active {
            background: #1E293B;
            color: #38BDF8;
            border: 1px solid rgba(56, 189, 248, 0.3);
          }
          .options-content {
            flex: 1;
            padding: 28px 36px;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .content-title {
            font-size: 18px;
            font-weight: 700;
            color: #F8FAFC;
          }
          .shortcut-table {
            width: 100%;
            border-collapse: collapse;
          }
          .shortcut-table th {
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            color: #64748B;
            text-transform: uppercase;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          }
          .shortcut-table td {
            padding: 10px 0;
            font-size: 13px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            color: #E2E8F0;
          }
          .chip-tag {
            background: rgba(37, 99, 235, 0.2);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: #38BDF8;
            font-family: 'JetBrains Mono', monospace;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
          }
          .personal-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 8px;
          }
          .word-chip {
            background: #1E293B;
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #F1F5F9;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
        </style>
      </head>
      <body>
        <div class="header-group">
          <div class="badge-pill">📚 Personal Vocabulary & Productivity</div>
          <h1 class="headline">Tailored to Your Personal Workflow</h1>
          <p class="subheadline">
            Add custom technical vocabulary, ignore proprietary jargon, and configure lightning-fast text expansion shortcuts that expand as you type.
          </p>
        </div>

        <div class="stage-container">
          <div class="options-mockup">
            <div class="options-sidebar">
              <div class="side-tab">⚙️ General Settings</div>
              <div class="side-tab">📖 Personal Dictionary</div>
              <div class="side-tab active">⚡ Text Shortcuts</div>
              <div class="side-tab">🌐 Excluded Sites</div>
              <div class="side-tab">ℹ️ About Bilexi</div>
            </div>

            <div class="options-content">
              <div>
                <div class="content-title">⚡ Custom Text Expansion Shortcuts</div>
                <p style="font-size: 12px; color: #94A3B8; margin-top: 2px;">Type a shortcut trigger followed by Space or punctuation to expand.</p>
              </div>

              <table class="shortcut-table">
                <thead>
                  <tr>
                    <th>Trigger</th>
                    <th>Expansion Replacement</th>
                    <th>Casing</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span class="chip-tag">cdlt</span></td>
                    <td>Cordialement,</td>
                    <td><span style="color: #10B981; font-size: 11px;">Matches Case</span></td>
                  </tr>
                  <tr>
                    <td><span class="chip-tag">omw</span></td>
                    <td>On my way!</td>
                    <td><span style="color: #10B981; font-size: 11px;">Matches Case</span></td>
                  </tr>
                  <tr>
                    <td><span class="chip-tag">bx</span></td>
                    <td>Bilexi Autocorrect</td>
                    <td><span style="color: #10B981; font-size: 11px;">Preserved</span></td>
                  </tr>
                  <tr>
                    <td><span class="chip-tag">tyvm</span></td>
                    <td>Thank you very much!</td>
                    <td><span style="color: #10B981; font-size: 11px;">Matches Case</span></td>
                  </tr>
                </tbody>
              </table>

              <div style="margin-top: 8px;">
                <div style="font-size: 13px; font-weight: 700; color: #F1F5F9;">Personal Dictionary Words (Protected from Autocorrect)</div>
                <div class="personal-chips">
                  <div class="word-chip">Kubernetes <span style="color: #64748B;">×</span></div>
                  <div class="word-chip">TypeScript <span style="color: #64748B;">×</span></div>
                  <div class="word-chip">PostgreSQL <span style="color: #64748B;">×</span></div>
                  <div class="word-chip">Supabase <span style="color: #64748B;">×</span></div>
                  <div class="word-chip">Bilexi <span style="color: #64748B;">×</span></div>
                  <div class="word-chip">+ Add Word</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-bar">
          <div class="footer-pills">
            <div class="footer-pill green">💾 Syncs with Local Storage</div>
            <div class="footer-pill">📤 Export / Import JSON Backups</div>
            <div class="footer-pill">⚡ Instant Real-Time Propagation</div>
          </div>
          <div>Bilexi v0.5.1</div>
        </div>
      </body>
      </html>
    `);
    const file4 = path.join(REDESIGN_DIR, 'store-screenshot-04-customization.png');
    await page.screenshot({ path: file4 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'store-screenshot-04.png') });
    console.log('✅ Generated Screenshot 4: Customization');
    await page.close();
  }

  // -------------------------------------------------------------
  // SLIDE 5: Universal Web Compatibility & Toolbar Popup
  // -------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${COMMON_CSS}
          .split-stage {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 1080px;
            gap: 40px;
          }
          .compat-left {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .app-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .app-card {
            background: rgba(15, 23, 42, 0.7);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 14px 18px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .app-icon {
            font-size: 22px;
          }
          .app-info h5 { font-size: 14px; font-weight: 700; color: #F1F5F9; }
          .app-info p { font-size: 11px; color: #10B981; font-weight: 600; margin-top: 2px; }

          /* Popup Card Replica */
          .popup-card {
            width: 320px;
            background: #0F172A;
            border: 1px solid #38BDF8;
            border-radius: 14px;
            box-shadow: 0 25px 60px rgba(0,0,0,0.7), 0 0 30px rgba(56, 189, 248, 0.25);
            overflow: hidden;
          }
          .popup-header {
            background: #1E293B;
            padding: 14px 18px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .popup-logo-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 15px;
            font-weight: 700;
            color: #FFFFFF;
          }
          .status-badge {
            font-size: 10px;
            font-weight: 700;
            color: #10B981;
            background: rgba(16, 185, 129, 0.15);
            padding: 2px 6px;
            border-radius: 4px;
          }
          .popup-body {
            padding: 18px;
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .toggle-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            background: #1E293B;
            border-radius: 8px;
          }
          .toggle-switch {
            width: 40px;
            height: 22px;
            background: #0284C7;
            border-radius: 11px;
            position: relative;
          }
          .toggle-knob {
            width: 18px;
            height: 18px;
            background: white;
            border-radius: 50%;
            position: absolute;
            top: 2px;
            right: 2px;
          }
        </style>
      </head>
      <body>
        <div class="header-group">
          <div class="badge-pill">🌐 Universal Web Compatibility</div>
          <h1 class="headline">Works Everywhere You Write</h1>
          <p class="subheadline">
            Native support across textareas, inputs, React controlled forms, and contenteditable suites. Easily toggle autocorrect per-site from the toolbar.
          </p>
        </div>

        <div class="stage-container">
          <div class="split-stage">
            <div class="compat-left">
              <div style="font-size: 16px; font-weight: 700; color: #F1F5F9;">Universal Field & Form Integration</div>
              <div class="app-grid">
                <div class="app-card">
                  <div class="app-icon">📝</div>
                  <div class="app-info">
                    <h5>Text Inputs & Web Forms</h5>
                    <p>✓ Instant Inline Autocorrect</p>
                  </div>
                </div>
                <div class="app-card">
                  <div class="app-icon">✍️</div>
                  <div class="app-info">
                    <h5>Rich Contenteditable</h5>
                    <p>✓ Fast Bounded DOM Extraction</p>
                  </div>
                </div>
                <div class="app-card">
                  <div class="app-icon">⚛️</div>
                  <div class="app-info">
                    <h5>React Controlled Inputs</h5>
                    <p>✓ Zero State Desynchronization</p>
                  </div>
                </div>
                <div class="app-card">
                  <div class="app-icon">🛡️</div>
                  <div class="app-info">
                    <h5>Code & Password Blocks</h5>
                    <p>✓ Automatic Sensitive Opt-Out</p>
                  </div>
                </div>
              </div>
            </div>

            <div class="popup-card">
              <div class="popup-header">
                <div class="popup-logo-row">
                  <span style="color: #38BDF8;">⚡</span> Bilexi
                </div>
                <div class="status-badge">Ready · EN + FR</div>
              </div>
              <div class="popup-body">
                <div class="toggle-row">
                  <div>
                    <div style="font-size: 13px; font-weight: 700;">Global Autocorrect</div>
                    <div style="font-size: 11px; color: #94A3B8;">Enabled everywhere</div>
                  </div>
                  <div class="toggle-switch"><div class="toggle-knob"></div></div>
                </div>

                <div class="toggle-row">
                  <div>
                    <div style="font-size: 13px; font-weight: 700;">Active Site</div>
                    <div style="font-size: 11px; color: #38BDF8;">webform.org</div>
                  </div>
                  <div class="toggle-switch"><div class="toggle-knob"></div></div>
                </div>

                <div style="padding: 10px; background: rgba(30, 41, 59, 0.4); border-radius: 8px;">
                  <div style="font-size: 11px; color: #94A3B8; margin-bottom: 4px;">Language Mode:</div>
                  <div style="font-size: 12px; font-weight: 700; color: #38BDF8;">Automatic Bilingual (EN / FR)</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-bar">
          <div class="footer-pills">
            <div class="footer-pill green">✓ Standard Inputs, Textareas & Contenteditable</div>
            <div class="footer-pill">🛡️ Strict Grammar & Spellcheck Attribute Respect</div>
            <div class="footer-pill">⚡ Instant Single-Click Site Exclusion</div>
          </div>
          <div>Bilexi v0.5.1</div>
        </div>
      </body>
      </html>
    `);
    const file5 = path.join(REDESIGN_DIR, 'store-screenshot-05-compatibility.png');
    await page.screenshot({ path: file5 });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'store-screenshot-05.png') });
    console.log('✅ Generated Screenshot 5: Compatibility');
    await page.close();
  }

  // -------------------------------------------------------------
  // PROMOTIONAL MARQUEE BANNER (1400 x 560 px)
  // -------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 560 }, deviceScaleFactor: 1 });
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
            background-color: #070B14;
            background-image: 
              radial-gradient(circle at 75% 25%, #1E3A8A 0%, rgba(7, 11, 20, 0) 60%),
              radial-gradient(circle at 20% 85%, #0284C7 0%, rgba(7, 11, 20, 0) 50%);
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #FFFFFF;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 50px 80px;
            position: relative;
            overflow: hidden;
          }
          .left { max-width: 660px; z-index: 10; }
          .marquee-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(37, 99, 235, 0.2);
            border: 1px solid rgba(56, 189, 248, 0.4);
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 700;
            color: #38BDF8;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 16px;
          }
          .marquee-title {
            font-size: 50px;
            font-weight: 800;
            line-height: 1.1;
            letter-spacing: -0.03em;
            margin-bottom: 18px;
            background: linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 60%, #93C5FD 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .marquee-desc {
            font-size: 17px;
            line-height: 1.5;
            color: #94A3B8;
            margin-bottom: 26px;
          }
          .marquee-pills {
            display: flex;
            gap: 12px;
          }
          .m-pill {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            color: #E2E8F0;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .right {
            width: 520px;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(56, 189, 248, 0.3);
            border-radius: 18px;
            padding: 28px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 35px rgba(37, 99, 235, 0.2);
            backdrop-filter: blur(16px);
            z-index: 10;
          }
          .demo-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
          }
          .demo-icon-box {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #1D4ED8 0%, #0284C7 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 800;
            color: white;
            box-shadow: 0 6px 16px rgba(2, 132, 199, 0.4);
          }
          .demo-icon-box svg { width: 48px; height: 48px; }
          .chat-preview {
            background: #1E293B;
            border-radius: 10px;
            padding: 14px 18px;
            font-size: 16px;
            line-height: 1.5;
            color: #F8FAFC;
            margin-bottom: 14px;
            border-left: 3px solid #38BDF8;
          }
          .strip-preview {
            background: #0F172A;
            border: 1px solid #38BDF8;
            border-radius: 8px;
            padding: 8px 12px;
            display: flex;
            gap: 10px;
            align-items: center;
          }
          .sp-slot {
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
          }
          .sp-active { background: #0284C7; color: white; }
          .sp-alt { background: rgba(255, 255, 255, 0.05); color: #94A3B8; }
        </style>
      </head>
      <body>
        <div class="left">
          <div class="marquee-badge">🔒 100% Offline · Chrome MV3</div>
          <h1 class="marquee-title">Effortless Bilingual Autocorrect for Desktop</h1>
          <p class="marquee-desc">
            Smartphone-grade bilingual fluency right in your desktop browser. Restores French accents, fixes English & French slips, and suggests alternatives in real time with zero cloud telemetry.
          </p>
          <div class="marquee-pills">
            <div class="m-pill">⚡ Sub-0.2ms Latency</div>
            <div class="m-pill">⌨️ Alt+2/Alt+3 Suggestions</div>
            <div class="m-pill">↩️ Instant Backspace Undo</div>
          </div>
        </div>

        <div class="right">
          <div class="demo-row">
            <div class="demo-icon-box" style="padding:0; background:transparent; box-shadow:none;">${ICON_SVG}</div>
            <div>
              <div style="font-size: 16px; font-weight: 700;">Bilexi Autocorrect</div>
              <div style="font-size: 12px; color: #10B981; font-weight: 600;">Active · 100% Local Engine</div>
            </div>
          </div>
          <div class="chat-preview">
            Hier j'ai visité <span style="color: #38BDF8; font-weight: 700; border-bottom: 2px solid #0284C7;">l'école</span> et nous avons finalisé le projet.
          </div>
          <div class="strip-preview">
            <div class="sp-slot sp-active">1: l'école</div>
            <div class="sp-slot sp-alt">Alt+2: l'écoule</div>
            <div class="sp-slot sp-alt">Alt+3: l'étoile</div>
          </div>
        </div>
      </body>
      </html>
    `);
    const fileMarquee = path.join(REDESIGN_DIR, 'promo-marquee-1400x560.png');
    await page.screenshot({ path: fileMarquee });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'promo-marquee-1400x560.png') });
    console.log('✅ Generated Promo Marquee: 1400x560');
    await page.close();
  }

  // -------------------------------------------------------------
  // SMALL PROMOTIONAL TILE (440 x 280 px)
  // -------------------------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: 440, height: 280 }, deviceScaleFactor: 1 });
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
            background: linear-gradient(135deg, #070B14 0%, #0F172A 50%, #0369A1 100%);
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #FFFFFF;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 24px;
            position: relative;
            overflow: hidden;
          }
          .top-row {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .tile-logo {
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .tile-logo svg { width: 44px; height: 44px; }
          .tile-title {
            font-size: 20px;
            font-weight: 800;
            letter-spacing: -0.02em;
            line-height: 1.1;
          }
          .tile-sub {
            font-size: 11px;
            color: #94A3B8;
            font-weight: 600;
            margin-top: 2px;
          }
          .demo-box {
            background: rgba(15, 23, 42, 0.8);
            border: 1px solid rgba(56, 189, 248, 0.25);
            border-radius: 8px;
            padding: 12px 14px;
            font-size: 13px;
            color: #F1F5F9;
            box-shadow: 0 8px 20px rgba(0,0,0,0.4);
          }
          .corrected {
            color: #38BDF8;
            font-weight: 700;
            border-bottom: 2px solid #0284C7;
          }
          .tile-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 11px;
            font-weight: 600;
          }
          .offline-tag {
            color: #10B981;
            display: flex;
            align-items: center;
            gap: 4px;
          }
        </style>
      </head>
      <body>
        <div class="top-row">
          <div class="tile-logo">${ICON_SVG}</div>
          <div>
            <div class="tile-title">Bilexi</div>
            <div class="tile-sub">Offline Bilingual Autocorrect (EN/FR)</div>
          </div>
        </div>

        <div class="demo-box">
          Hier j'ai visité <span class="corrected">l'école</span> et tout est <span class="corrected">parfait</span>!
        </div>

        <div class="tile-footer">
          <div class="offline-tag">🔒 100% Offline · Local NLP</div>
          <div style="color: #64748B;">Manifest V3</div>
        </div>
      </body>
      </html>
    `);
    const fileSmall = path.join(REDESIGN_DIR, 'promo-small-440x280.png');
    await page.screenshot({ path: fileSmall });
    await page.screenshot({ path: path.join(SCREENS_DIR, 'promo-small-440x280.png') });
    console.log('✅ Generated Small Promo Tile: 440x280');
    await page.close();
  }

  // Update public/icons with new icon suite
  fs.copyFileSync(path.join(REDESIGN_DIR, 'icon-128.png'), path.join(ICONS_DIR, 'icon-128.png'));
  fs.copyFileSync(path.join(REDESIGN_DIR, 'icon-48.png'), path.join(ICONS_DIR, 'icon-48.png'));
  fs.copyFileSync(path.join(REDESIGN_DIR, 'icon-32.png'), path.join(ICONS_DIR, 'icon-32.png'));
  fs.copyFileSync(path.join(REDESIGN_DIR, 'icon-16.png'), path.join(ICONS_DIR, 'icon-16.png'));
  fs.copyFileSync(path.join(REDESIGN_DIR, 'icon-128.png'), path.join(SCREENS_DIR, 'logo.png'));
  fs.copyFileSync(path.join(REDESIGN_DIR, 'icon-128.png'), path.join(SCREENS_DIR, 'store-icon-128x128.png'));

  // Also copy to brain artifacts directory for easy embedding
  const brainDirs = [
    '/home/sid/.gemini/antigravity/brain/b159c509-3764-4ca0-a2a7-775c8ef41fbc',
    '/home/sid/.gemini/antigravity/brain/57f5ddc7-02db-4729-8575-d30e555659db',
  ];
  for (const bDir of brainDirs) {
    if (fs.existsSync(bDir)) {
      fs.copyFileSync(path.join(REDESIGN_DIR, 'icon-128.png'), path.join(bDir, 'logo.png'));
      fs.copyFileSync(path.join(REDESIGN_DIR, 'store-screenshot-01-hero.png'), path.join(bDir, 'store-screenshot-01-hero.png'));
      fs.copyFileSync(path.join(REDESIGN_DIR, 'store-screenshot-02-suggestions.png'), path.join(bDir, 'store-screenshot-02-suggestions.png'));
      fs.copyFileSync(path.join(REDESIGN_DIR, 'store-screenshot-03-privacy.png'), path.join(bDir, 'store-screenshot-03-privacy.png'));
      fs.copyFileSync(path.join(REDESIGN_DIR, 'store-screenshot-04-customization.png'), path.join(bDir, 'store-screenshot-04-customization.png'));
      fs.copyFileSync(path.join(REDESIGN_DIR, 'store-screenshot-05-compatibility.png'), path.join(bDir, 'store-screenshot-05-compatibility.png'));
      fs.copyFileSync(path.join(REDESIGN_DIR, 'promo-marquee-1400x560.png'), path.join(bDir, 'promo-marquee-1400x560.png'));
      fs.copyFileSync(path.join(REDESIGN_DIR, 'promo-small-440x280.png'), path.join(bDir, 'promo-small-440x280.png'));
    }
  }

  await browser.close();
  console.log('🎉 All Chrome Web Store Redesigned Assets Successfully Generated!');
}

generateAllAssets().catch(console.error);
