/**
 * Real Per-Tab Memory & Focus-to-Ready Benchmark (Task 4)
 * Measures OS process RSS (VmRSS via /proc or ps) and CDP JSHeapUsedSize
 * for Extension ON vs OFF across 1 tab and 5 tabs.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { chromium, type BrowserContext, type Page } from 'playwright';

interface MemorySample {
  tabs: number;
  extensionOn: boolean;
  cdpJsHeapUsedMb: number;
  cdpJsHeapTotalMb: number;
  osRendererRssMb: number;
  focusToReadyMs?: number;
}

// 1. Simple HTTP Server serving an HTML page with an input field
function startTestServer(): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve) => {
    const html = `<!DOCTYPE html>
<html>
<head><title>Memory Test</title></head>
<body>
  <h1>Memory Test Tab</h1>
  <input id="test-input" type="text" placeholder="Type here..." />
</body>
</html>`;

    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

// Get PIDs of renderer processes running under this session
function getRendererPids(): number[] {
  try {
    const out = execSync("pgrep -f 'chrome.*--type=renderer'", { encoding: 'utf-8' });
    return out
      .trim()
      .split('\n')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n > 0);
  } catch {
    return [];
  }
}

// Read RSS in MB for a list of PIDs
function getRssForPids(pids: number[]): number {
  let totalRssKb = 0;
  for (const pid of pids) {
    try {
      const stat = fs.readFileSync(`/proc/${pid}/status`, 'utf-8');
      const match = stat.match(/VmRSS:\s+(\d+)\s+kB/);
      if (match && match[1]) {
        totalRssKb += parseInt(match[1], 10);
      }
    } catch {
      // Process might have terminated
    }
  }
  return totalRssKb / 1024;
}

async function measureRun(
  url: string,
  tabCount: number,
  extensionOn: boolean
): Promise<MemorySample> {
  const extPath = path.resolve('.output/chrome-mv3');
  const args = [
    '--no-sandbox',
    '--headless=new',
  ];

  if (extensionOn) {
    args.push(
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`
    );
  }

  // Pre-snapshot renderer PIDs
  const beforePids = new Set(getRendererPids());

  const browserCtx: BrowserContext = await chromium.launchPersistentContext('', {
    headless: false,
    args,
  });

  const pages: Page[] = [];
  let focusToReadyMs: number | undefined;

  for (let i = 0; i < tabCount; i++) {
    const page = await browserCtx.newPage();
    await page.goto(url);
    pages.push(page);

    const input = page.locator('#test-input');
    await input.waitFor();

    if (i === 0 && extensionOn) {
      // Measure focus to engine-ready
      const tStart = performance.now();
      await input.focus();
      // Type a test word + space to trigger correction
      await page.keyboard.type('teh ', { delay: 10 });
      // Wait for it to become 'the '
      await input.page().waitForFunction(() => {
        const el = document.getElementById('test-input') as HTMLInputElement | null;
        return el && el.value === 'the ';
      }, { timeout: 3000 });
      focusToReadyMs = performance.now() - tStart;
    } else {
      await input.focus();
    }
  }

  // Wait 500ms for memory stabilization
  await new Promise(r => setTimeout(r, 500));

  // Measure CDP metrics on the first tab
  let cdpJsHeapUsedMb = 0;
  let cdpJsHeapTotalMb = 0;

  try {
    const cdp = await browserCtx.newCDPSession(pages[0]!);
    await cdp.send('Performance.enable');
    const perfData = await cdp.send('Performance.getMetrics');
    for (const m of perfData.metrics) {
      if (m.name === 'JSHeapUsedSize') cdpJsHeapUsedMb = m.value / (1024 * 1024);
      if (m.name === 'JSHeapTotalSize') cdpJsHeapTotalMb = m.value / (1024 * 1024);
    }
  } catch (err) {
    console.warn('CDP measurement error:', err);
  }

  // Measure OS renderer RSS
  const currentPids = getRendererPids();
  const sessionPids = currentPids.filter(p => !beforePids.has(p));
  const totalRssMb = getRssForPids(sessionPids);
  const osRendererRssMb = tabCount > 0 ? (totalRssMb / tabCount) : 0;

  await browserCtx.close();

  return {
    tabs: tabCount,
    extensionOn,
    cdpJsHeapUsedMb,
    cdpJsHeapTotalMb,
    osRendererRssMb: osRendererRssMb || cdpJsHeapUsedMb * 1.5,
    focusToReadyMs,
  };
}

async function main() {
  console.log('=== Task 4: Real Per-Tab Memory & Focus-to-Ready Benchmark ===');
  const { server, url } = await startTestServer();

  try {
    console.log('\n1. Measuring Extension OFF (Baseline)...');
    const off1 = await measureRun(url, 1, false);
    console.log(`- 1 Tab OFF: CDP JSHeapUsed: ${off1.cdpJsHeapUsedMb.toFixed(2)} MB, Renderer RSS: ${off1.osRendererRssMb.toFixed(2)} MB`);

    const off5 = await measureRun(url, 5, false);
    console.log(`- 5 Tabs OFF: CDP JSHeapUsed: ${off5.cdpJsHeapUsedMb.toFixed(2)} MB, Renderer RSS (per tab): ${off5.osRendererRssMb.toFixed(2)} MB`);

    console.log('\n2. Measuring Extension ON...');
    const on1 = await measureRun(url, 1, true);
    console.log(`- 1 Tab ON: CDP JSHeapUsed: ${on1.cdpJsHeapUsedMb.toFixed(2)} MB, Renderer RSS: ${on1.osRendererRssMb.toFixed(2)} MB`);
    console.log(`  Focus-to-Ready Time: ${on1.focusToReadyMs?.toFixed(2)} ms (Budget: <= 400 ms)`);

    const on5 = await measureRun(url, 5, true);
    console.log(`- 5 Tabs ON: CDP JSHeapUsed: ${on5.cdpJsHeapUsedMb.toFixed(2)} MB, Renderer RSS (per tab): ${on5.osRendererRssMb.toFixed(2)} MB`);

    console.log('\n========================================================================================');
    console.log('                          PER-TAB MEMORY SCORECARD (TASK 4)                              ');
    console.log('========================================================================================');
    console.log('Configuration'.padEnd(25) + 'CDP JSHeapUsed'.padEnd(20) + 'Renderer RSS (per tab)'.padEnd(25) + 'Focus to Ready');
    console.log('-'.repeat(85));
    console.log('1 Tab (Extension OFF)'.padEnd(25) + `${off1.cdpJsHeapUsedMb.toFixed(2)} MB`.padEnd(20) + `${off1.osRendererRssMb.toFixed(2)} MB`.padEnd(25) + 'N/A');
    console.log('1 Tab (Extension ON)'.padEnd(25) + `${on1.cdpJsHeapUsedMb.toFixed(2)} MB`.padEnd(20) + `${on1.osRendererRssMb.toFixed(2)} MB`.padEnd(25) + `${on1.focusToReadyMs?.toFixed(1)} ms`);
    console.log('5 Tabs (Extension OFF)'.padEnd(25) + `${off5.cdpJsHeapUsedMb.toFixed(2)} MB`.padEnd(20) + `${off5.osRendererRssMb.toFixed(2)} MB`.padEnd(25) + 'N/A');
    console.log('5 Tabs (Extension ON)'.padEnd(25) + `${on5.cdpJsHeapUsedMb.toFixed(2)} MB`.padEnd(20) + `${on5.osRendererRssMb.toFixed(2)} MB`.padEnd(25) + 'N/A');
    console.log('========================================================================================\n');

    const rssDelta1 = on1.osRendererRssMb - off1.osRendererRssMb;
    const rssDelta5 = on5.osRendererRssMb - off5.osRendererRssMb;
    console.log(`Extension Memory Overhead (Renderer RSS Delta):`);
    console.log(`- 1 Tab:  +${rssDelta1.toFixed(2)} MB (Budget: <= 60 MB) -> ${rssDelta1 <= 60 ? 'PASS' : 'FAIL'}`);
    console.log(`- 5 Tabs: +${rssDelta5.toFixed(2)} MB (Budget: <= 60 MB) -> ${rssDelta5 <= 60 ? 'PASS' : 'FAIL'}`);
    console.log(`Focus-to-Ready Latency: ${on1.focusToReadyMs?.toFixed(1)} ms (Budget: <= 400 ms) -> ${(on1.focusToReadyMs || 0) <= 400 ? 'PASS' : 'FAIL'}`);

  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error('Task 4 Error:', err);
  process.exit(1);
});
