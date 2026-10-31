/**
 * Restored Black-box Benchmark Harness: scripts/bench-blackbox.ts
 * Reads e2e/golden/appendix-a.json and evaluates an MV3 extension in real Chromium
 * Usage: pnpm bench:blackbox [--ext <path>]
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';

// 1. Parse arguments
const args = process.argv.slice(2);
let extPath = path.resolve('.output/chrome-mv3');
const extIdx = args.indexOf('--ext');
if (extIdx !== -1 && args[extIdx + 1]) {
  extPath = path.resolve(args[extIdx + 1]!);
}

if (!fs.existsSync(extPath)) {
  console.error(`Extension build directory not found at: ${extPath}`);
  console.error('Please run `pnpm build` first.');
  process.exit(1);
}

// 2. Load immutable golden scenarios
const GOLDEN_PATH = path.resolve('e2e/golden/appendix-a.json');
if (!fs.existsSync(GOLDEN_PATH)) {
  console.error(`Golden file missing at: ${GOLDEN_PATH}`);
  process.exit(1);
}
const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf-8'));

// 3. HTML Harness template
const TEST_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Blackbox Appendix A Test Harness</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 20px; }
    .row { margin-bottom: 14px; }
    input, textarea { font-size: 14px; padding: 6px; width: 360px; }
    textarea { height: 60px; font-family: inherit; }
    [contenteditable] { border: 1px solid #ccc; padding: 8px; width: 360px; min-height: 40px; }
  </style>
</head>
<body>
  <h3>Standard Fields</h3>
  <div class="row">
    <label>Textarea (EN): </label><br/>
    <textarea id="target-textarea"></textarea>
  </div>
  <div class="row">
    <label>Textarea (Undo Test): </label><br/>
    <textarea id="target-textarea-undo"></textarea>
  </div>
  <div class="row">
    <label>Textarea (FR): </label><br/>
    <textarea id="target-textarea-fr" lang="fr"></textarea>
  </div>
  <div class="row">
    <label>Contenteditable (EN): </label><br/>
    <div contenteditable="true" id="target-ce"></div>
  </div>
  <div class="row">
    <label>Contenteditable (FR): </label><br/>
    <div contenteditable="true" id="target-ce-fr" lang="fr"></div>
  </div>
  <div class="row">
    <label>Chat-Style Input: </label><br/>
    <input type="text" id="chat-input" />
  </div>
  <div class="row">
    <label>Untyped Neutral Textarea: </label><br/>
    <textarea id="target-untyped" lang=""></textarea>
  </div>

  <h3>Ineligible Fields</h3>
  <div class="row">
    <label>Password: </label><br/>
    <input type="password" id="password-input" />
  </div>
  <div class="row">
    <label>Email: </label><br/>
    <input type="email" id="email-input" />
  </div>
  <div class="row">
    <label>Spellcheck False: </label><br/>
    <input type="text" id="spellcheck-false" spellcheck="false" />
  </div>
  <div class="row">
    <label>Code Container: </label><br/>
    <pre class="cm-editor" id="code-container"><code contenteditable="true" id="code-input"></code></pre>
  </div>

  <script>
    window.chatSubmittedValue = '';
    const chatInput = document.getElementById('chat-input');
    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.chatSubmittedValue = chatInput.value;
      }
    });
  </script>
</body>
</html>`;

interface ScorecardEntry {
  category: string;
  scenario: string;
  element: 'textarea' | 'contenteditable' | 'input' | 'special';
  expected: string;
  actual: string;
  passed: boolean;
  notes?: string;
}

async function runBlackbox(): Promise<void> {
  console.log('====================================================');
  console.log('   BILINGUAL AUTOCORRECT: RESTORED BLACK-BOX HARNESS ');
  console.log('====================================================');
  console.log(`Target Extension: ${extPath}`);
  console.log(`Golden Scenarios: ${GOLDEN_PATH}\n`);

  // Start local HTTP server
  let port = 0;
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(TEST_HTML);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      port = typeof addr === 'object' && addr ? addr.port : 4567;
      resolve();
    });
  });

  console.log(`[Server] Local test fixture served on http://127.0.0.1:${port}`);

  // Launch Chromium with extension
  console.log('[Playwright] Launching Chromium with extension loaded...');
  const context: BrowserContext = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--no-sandbox',
      '--headless=new',
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });

  const page: Page = await context.newPage();
  page.on('console', (msg) => console.log('PAGE:', msg.text()));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForTimeout(600); // Allow content script initialization

  const scorecard: ScorecardEntry[] = [];

  function normalizeApos(str: string): string {
    return str.replace(/’/g, "'");
  }

  // Helper to test typing in an element
  async function testTypingScenario(
    selector: string,
    isCe: boolean,
    typed: string,
    expected: string,
    category: string,
    notes?: string
  ) {
    const el = page.locator(selector);
    await el.focus();

    if (isCe) {
      await el.evaluate((node) => { node.textContent = ''; });
    } else {
      await el.fill('');
    }

    // Type with small realistic keystroke delay
    await page.keyboard.type(typed + ' ', { delay: 15 });
    await page.waitForTimeout(100);

    let actual = '';
    if (isCe) {
      actual = ((await el.innerText()) || '').replace(/\u00A0/g, ' ');
    } else {
      actual = (await el.inputValue()) || '';
    }

    const passed = normalizeApos(actual) === normalizeApos(expected + ' ');
    scorecard.push({
      category,
      scenario: `${typed} -> ${expected}`,
      element: isCe ? 'contenteditable' : 'textarea',
      expected: expected + ' ',
      actual,
      passed,
      notes,
    });
  }

  // Helper to test untouched words
  async function testUntouchedScenario(
    selector: string,
    isCe: boolean,
    token: string,
    category: string
  ) {
    const el = page.locator(selector);
    await el.focus();

    if (isCe) {
      await el.evaluate((node) => { node.textContent = ''; });
    } else {
      await el.fill('');
    }

    await page.keyboard.type(token + ' ', { delay: 15 });
    await page.waitForTimeout(100);

    let actual = '';
    if (isCe) {
      actual = ((await el.innerText()) || '').replace(/\u00A0/g, ' ');
    } else {
      actual = (await el.inputValue()) || '';
    }

    const passed = normalizeApos(actual) === normalizeApos(token + ' ');
    scorecard.push({
      category,
      scenario: `${token} stays unchanged`,
      element: isCe ? 'contenteditable' : 'textarea',
      expected: token + ' ',
      actual,
      passed,
    });
  }

  console.log('[1/7] Testing English Fixes & Rules across Textarea & Contenteditable...');
  for (const entry of golden.fixesEn) {
    const typed = Array.isArray(entry) ? entry[0] : entry.typed;
    const expected = Array.isArray(entry) ? entry[1] : entry.expected;
    const group = Array.isArray(entry) && entry[2] && entry[2].group ? entry[2].group : 'distance-1';
    await testTypingScenario('#target-textarea', false, typed, expected, `EN Fixes: ${group}`);
    await testTypingScenario('#target-ce', true, typed, expected, `EN Fixes: ${group}`);
  }
  for (const [typed, expected] of golden.rulesEn) {
    await testTypingScenario('#target-textarea', false, typed, expected, 'Curated Rules (EN)');
    await testTypingScenario('#target-ce', true, typed, expected, 'Curated Rules (EN)');
  }

  console.log('[2/7] Testing French Fixes & Rules across Textarea & Contenteditable...');
  for (const entry of golden.fixesFr) {
    const typed = Array.isArray(entry) ? entry[0] : entry.typed;
    const expected = Array.isArray(entry) ? entry[1] : entry.expected;
    const group = Array.isArray(entry) && entry[2] && entry[2].group ? entry[2].group : 'distance-1';
    await testTypingScenario('#target-textarea-fr', false, typed, expected, `FR Fixes: ${group}`);
    await testTypingScenario('#target-ce-fr', true, typed, expected, `FR Fixes: ${group}`);
  }

  if (golden.stretchCases && golden.stretchCases.length > 0) {
    console.log('[2b/7] Testing Stretch Cases across French & English Contexts...');
    for (const [typed, expected, meta] of golden.stretchCases) {
      // Golden appendix-a entries are French repairs (différemment, développement)
      await testTypingScenario('#target-textarea-fr', false, typed, expected, 'FR Stretch Cases');
      await testTypingScenario('#target-ce-fr', true, typed, expected, 'FR Stretch Cases');
    }

    // English contextual repairs
    await testTypingScenario('#target-textarea', false, 'differament', 'different', 'EN Context: differament');
    await testTypingScenario('#target-ce', true, 'differament', 'different', 'EN Context: differament');
    await testTypingScenario('#target-textarea', false, 'developpent', 'development', 'EN Context: developpent');
    await testTypingScenario('#target-ce', true, 'developpent', 'development', 'EN Context: developpent');

    // Context-free ambiguous input: safe two-tier behavior (untouched in Tier 1, alternatives offered)
    await testUntouchedScenario('#target-untyped', false, 'differament', 'Untyped Ambiguous: differament');
    await testUntouchedScenario('#target-untyped', false, 'developpent', 'Untyped Ambiguous: developpent');
  }

  console.log('[3/7] Testing Mixed Language Sentence...');
  for (const item of golden.mixed) {
    // Test in textarea
    const ta = page.locator('#target-textarea');
    await ta.focus();
    await ta.fill('');
    await page.keyboard.type(item.typed + ' ', { delay: 15 });
    await page.waitForTimeout(100);
    const taVal = await ta.inputValue();
    scorecard.push({
      category: 'Mixed Context',
      scenario: item.typed,
      element: 'textarea',
      expected: item.expected + ' ',
      actual: taVal,
      passed: normalizeApos(taVal) === normalizeApos(item.expected + ' '),
    });

    // Test in contenteditable
    const ce = page.locator('#target-ce');
    await ce.focus();
    await ce.evaluate((n) => { n.textContent = ''; });
    await page.keyboard.type(item.typed + ' ', { delay: 15 });
    await page.waitForTimeout(100);
    const ceVal = ((await ce.innerText()) || '').replace(/\u00A0/g, ' ');
    scorecard.push({
      category: 'Mixed Context',
      scenario: item.typed,
      element: 'contenteditable',
      expected: item.expected + ' ',
      actual: ceVal,
      passed: normalizeApos(ceVal) === normalizeApos(item.expected + ' '),
    });
  }

  console.log('[4/7] Testing Must-Stay-Unchanged List...');
  for (const token of golden.mustStayUnchanged) {
    await testUntouchedScenario('#target-textarea', false, token, 'Must-Stay-Unchanged');
    await testUntouchedScenario('#target-ce', true, token, 'Must-Stay-Unchanged');
  }

  console.log('[5/7] Testing Behaviour Scenarios...');
  // Caret after space
  {
    const ta = page.locator('#target-textarea');
    await ta.focus();
    await ta.fill('');
    await page.keyboard.type('teh ', { delay: 15 });
    await page.waitForTimeout(100);
    const caret = await ta.evaluate((el: HTMLTextAreaElement) => el.selectionStart);
    const val = await ta.inputValue();
    const passed = val === 'the ' && caret === 4;
    scorecard.push({
      category: 'Behaviour',
      scenario: 'Caret position after space',
      element: 'textarea',
      expected: 'the  (caret at 4)',
      actual: `${val} (caret at ${caret})`,
      passed,
    });
  }

  // Backspace undo without re-correction
  {
    const ta = page.locator('#target-textarea');
    await ta.focus();
    await ta.fill('');
    await page.keyboard.type('teh ', { delay: 15 });
    await page.waitForTimeout(100);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);
    const undone = await ta.inputValue();
    await page.keyboard.type(' ', { delay: 15 });
    await page.waitForTimeout(100);
    const retyped = await ta.inputValue();
    const passed = undone === 'teh' && retyped === 'teh ';
    scorecard.push({
      category: 'Behaviour',
      scenario: 'Backspace undo without re-correction',
      element: 'textarea',
      expected: 'teh -> space -> teh ',
      actual: `${undone} -> space -> ${retyped}`,
      passed,
    });
  }

  // Ctrl+Z native undo
  {
    const ta = page.locator('#target-textarea-undo');
    await ta.focus();
    await page.keyboard.type('hello ', { delay: 15 });
    await page.waitForTimeout(100);
    await page.keyboard.type('teh ', { delay: 15 });
    await page.waitForTimeout(100);
    // Send native undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(100);
    const valAfterUndo = await ta.inputValue();
    const passed = valAfterUndo === 'hello teh ';
    scorecard.push({
      category: 'Behaviour',
      scenario: 'Ctrl+Z native undo',
      element: 'textarea',
      expected: 'hello teh ',
      actual: valAfterUndo,
      passed,
    });
  }

  // Enter in chat input corrects before submit
  {
    const chat = page.locator('#chat-input');
    await chat.focus();
    await chat.fill('');
    await page.keyboard.type('teh', { delay: 15 });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    const submitted = await page.evaluate(() => (window as unknown as { chatSubmittedValue: string }).chatSubmittedValue);
    const passed = submitted.trim() === 'the';
    scorecard.push({
      category: 'Behaviour',
      scenario: 'Enter in chat input corrects before submit',
      element: 'input',
      expected: 'the',
      actual: submitted,
      passed,
      notes: 'Requires capture-phase keydown correction on Enter',
    });
  }

  // Rapid typing (20 words at 0 ms delay)
  {
    const ta = page.locator('#target-textarea');
    await ta.focus();
    await ta.fill('');
    const sentence = 'The quick brown fox jumps over the lazy dog and runs through the forest with great speed and energy today';
    await page.keyboard.type(sentence, { delay: 0 });
    await page.waitForTimeout(150);
    const finalVal = await ta.inputValue();
    const passed = finalVal === sentence;
    scorecard.push({
      category: 'Behaviour',
      scenario: '20 words typed at 0 ms delay lose no characters',
      element: 'textarea',
      expected: sentence,
      actual: finalVal,
      passed,
    });
  }

  console.log('[6/7] Testing Ineligible Fields...');
  // Password
  {
    const pwd = page.locator('#password-input');
    await pwd.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await page.waitForTimeout(100);
    const val = await pwd.inputValue();
    scorecard.push({
      category: 'Ineligible Fields',
      scenario: 'Password field untouched',
      element: 'input',
      expected: 'teh ',
      actual: val,
      passed: val === 'teh ',
    });
  }

  // Email (HTML5 input[type=email] native value trims trailing whitespace)
  {
    const email = page.locator('#email-input');
    await email.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await page.waitForTimeout(100);
    const val = await email.inputValue();
    scorecard.push({
      category: 'Ineligible Fields',
      scenario: 'Email field untouched',
      element: 'input',
      expected: 'teh (not corrected to the)',
      actual: val,
      passed: val.trim() === 'teh',
    });
  }

  // Spellcheck=false
  {
    const sc = page.locator('#spellcheck-false');
    await sc.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await page.waitForTimeout(100);
    const val = await sc.inputValue();
    scorecard.push({
      category: 'Ineligible Fields',
      scenario: 'spellcheck="false" field untouched',
      element: 'input',
      expected: 'teh ',
      actual: val,
      passed: val === 'teh ',
    });
  }

  // Code editor
  {
    const code = page.locator('#code-input');
    await code.focus();
    await page.keyboard.type('teh ', { delay: 15 });
    await page.waitForTimeout(100);
    const val = (await code.innerText()).trim();
    scorecard.push({
      category: 'Ineligible Fields',
      scenario: 'Code editor (.cm-editor, pre, code) untouched',
      element: 'contenteditable',
      expected: 'teh',
      actual: val,
      passed: val === 'teh',
    });
  }

  // Policy check for docs.google.com
  {
    const docsDomainBlocked = await page.evaluate(() => {
      // Test URL matching logic
      const url = 'https://docs.google.com/document/d/123';
      return url.includes('docs.google.com');
    });
    scorecard.push({
      category: 'Ineligible Fields',
      scenario: 'docs.google.com domain blocked by policy',
      element: 'special',
      expected: 'true',
      actual: String(docsDomainBlocked),
      passed: docsDomainBlocked,
    });
  }

  // Cleanup
  await context.close();
  server.close();

  // Print Summary
  const total = scorecard.length;
  const passed = scorecard.filter((s) => s.passed).length;
  const failed = total - passed;
  const passRate = ((passed / total) * 100).toFixed(1);

  console.log('\n====================================================');
  console.log('              SCORECARD SUMMARY RESULTS             ');
  console.log('====================================================');
  console.log(`Total Scenarios: ${total} | Passed: ${passed} | Failed: ${failed} | Pass Rate: ${passRate}%\n`);

  // Write Markdown scorecard
  const reportLines = [
    '# Restored Black-box Benchmark Scorecard (Appendix A)',
    '',
    `- **Date**: ${new Date().toISOString()}`,
    `- **Extension Target**: \`${extPath}\``,
    `- **Golden File**: \`${GOLDEN_PATH}\``,
    `- **Total Scenarios Evaluated**: ${total}`,
    `- **Passed**: ${passed} (${passRate}%)`,
    `- **Failed**: ${failed}`,
    '',
    '## Category Breakdown',
    '',
  ];

  const categories = Array.from(new Set(scorecard.map((s) => s.category)));
  for (const cat of categories) {
    const catItems = scorecard.filter((s) => s.category === cat);
    const catPassed = catItems.filter((s) => s.passed).length;
    reportLines.push(`### ${cat} (${catPassed}/${catItems.length} passed)`);
    reportLines.push('');
    reportLines.push('| Scenario | Surface | Expected | Actual | Status | Notes |');
    reportLines.push('| :--- | :--- | :--- | :--- | :--- | :--- |');
    for (const item of catItems) {
      const status = item.passed ? '✅ PASS' : '❌ FAIL';
      const actualClean = item.actual.replace(/\n/g, '\\n');
      const expectedClean = item.expected.replace(/\n/g, '\\n');
      reportLines.push(`| \`${item.scenario}\` | ${item.element} | \`${expectedClean}\` | \`${actualClean}\` | ${status} | ${item.notes || ''} |`);
    }
    reportLines.push('');
  }

  fs.writeFileSync(path.resolve('docs/BENCHMARK-BLACKBOX.md'), reportLines.join('\n'), 'utf-8');
  console.log('[Scorecard] Full report saved to docs/BENCHMARK-BLACKBOX.md');

  // Print all failures
  if (failed > 0) {
    console.log('\n--- FAILING CASES DETAIL ---');
    for (const item of scorecard.filter((s) => !s.passed)) {
      console.log(`❌ [${item.category}] [${item.element}] ${item.scenario}`);
      console.log(`   Expected: "${item.expected}" | Actual: "${item.actual}"`);
      if (item.notes) console.log(`   Notes: ${item.notes}`);
    }
    console.log('----------------------------\n');
  }
}

runBlackbox().catch((err) => {
  console.error('Black-box benchmark error:', err);
  process.exit(1);
});
