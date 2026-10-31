import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Page } from '@playwright/test';

const extPath = path.resolve('.output/chrome-mv3');

async function run() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html>
<html>
<head><title>Keystroke Latency</title></head>
<body>
  <input id="test-input" type="text" style="width: 400px; font-size: 16px;" />
  <script>
    window.keyLatencies = [];
    const input = document.getElementById('test-input');
    input.addEventListener('keydown', (e) => {
      const start = performance.now();
      requestAnimationFrame(() => {
        // after render/handlers
        window.keyLatencies.push(performance.now() - start);
      });
    });
  </script>
</body>
</html>`);
  });

  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      resolve(addr.port);
    });
  });

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--no-sandbox',
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  const input = page.locator('#test-input');
  await input.focus();

  // Type a mix of normal words and words that trigger the suggestion strip
  const text = 'hello recieve world jespere some words to measure typing overhead ';
  
  // We can measure each keystroke duration from Node or injected in page
  const latencies: number[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const t0 = performance.now();
    await input.pressSequentially(char, { delay: 10 });
    const elapsed = performance.now() - t0;
    latencies.push(elapsed);
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  console.log(`Keystroke Latency (including Playwright IPC & strip render):`);
  console.log(`- Samples: ${latencies.length}`);
  console.log(`- Mean: ${mean.toFixed(2)} ms`);
  console.log(`- p50:  ${p50.toFixed(2)} ms`);
  console.log(`- p95:  ${p95.toFixed(2)} ms`);
  console.log(`- p99:  ${p99.toFixed(2)} ms`);

  // Also query in-page microtask latency
  const inPageLatencies: number[] = await page.evaluate(() => (window as any).keyLatencies || []);
  if (inPageLatencies.length > 0) {
    inPageLatencies.sort((a, b) => a - b);
    const ip50 = inPageLatencies[Math.floor(inPageLatencies.length * 0.50)];
    const ip95 = inPageLatencies[Math.floor(inPageLatencies.length * 0.95)];
    console.log(`\nIn-Page Keystroke to rAF Overhead:`);
    console.log(`- In-Page p50: ${ip50.toFixed(3)} ms`);
    console.log(`- In-Page p95: ${ip95.toFixed(3)} ms`);

    const outPath = 'evidence/v0.5.0/keystroke-overhead.json';
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          keystrokes: latencies.length,
          ipcOverhead: { mean, p50, p95, p99 },
          inPageOverhead: { p50: ip50, p95: ip95 },
        },
        null,
        2
      ),
      'utf-8'
    );
    console.log(`\nEvidence saved to ${outPath}`);
  }

  await context.close();
  server.close();
}

run().catch(console.error);
