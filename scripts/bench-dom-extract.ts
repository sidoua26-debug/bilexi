/**
 * scripts/bench-dom-extract.ts
 *
 * Implements WP D.b:
 * Benchmark bounded DOM extraction across 4 structural shapes with the BUILT EXTENSION loaded
 * in Playwright persistent context:
 *   1. 500 <p> paragraphs (10,000 words)
 *   2. Flat 10,000-word block in many text nodes
 *   3. <br>-separated with inline <span> formatting
 *   4. Deeply nested <div> structure (depth >= 25)
 *
 * Reports p50, p95, and n per shape.
 * Saves evidence to evidence/v0.5.0/dom-extract-bench.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const extPath = path.resolve('.output/chrome-mv3');

async function main() {
  console.log('=== BENCHMARK: Bounded Contenteditable Extraction Across 4 DOM Shapes (Built Extension Loaded) ===\n');

  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      '--no-sandbox',
      `--disable-extensions-except=${extPath}`,
      `--load-extension=${extPath}`,
    ],
  });

  const page = await context.newPage();
  await page.setContent('<!DOCTYPE html><html><body><div id="container"></div></body></html>');
  await page.waitForTimeout(500);

  const results = await page.evaluate(`(() => {
    const BLOCK_TAGS = new Set([
      'DIV', 'P', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'PRE',
      'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'UL', 'OL', 'DL', 'DT', 'DD',
    ]);

    const isBlockElement = (el) => {
      if (!el || el.nodeType !== 1) return false;
      return BLOCK_TAGS.has(el.tagName.toUpperCase());
    };

    const getNearestBlockAncestor = (node, root) => {
      let curr = node.nodeType === 1 ? node : node.parentElement;
      while (curr && curr !== root) {
        if (curr.nodeType === 1 && isBlockElement(curr)) {
          return curr;
        }
        curr = curr.parentNode;
      }
      return root;
    };

    const getPreviousNode = (node, boundary) => {
      if (node === boundary) return null;
      if (node.previousSibling) {
        let curr = node.previousSibling;
        while (curr.lastChild) {
          if (curr.nodeType === 1 && (isBlockElement(curr) || curr.tagName.toUpperCase() === 'BR')) {
            break;
          }
          curr = curr.lastChild;
        }
        return curr;
      }
      return node.parentNode && node.parentNode !== boundary ? node.parentNode : null;
    };

    const extractBackwardFromCaret = (root, anchorNode, anchorOffset, maxChars = 500) => {
      const blockElement = getNearestBlockAncestor(anchorNode, root);
      const backwardChunks = [];
      let totalChars = 0;

      let currentNode = anchorNode;

      if (anchorNode.nodeType === 3) {
        const textContent = anchorNode.textContent || '';
        const sliceEnd = Math.min(anchorOffset, textContent.length);
        if (sliceEnd > 0) {
          const needed = maxChars - totalChars;
          const sliceStart = Math.max(0, sliceEnd - needed);
          const text = textContent.slice(sliceStart, sliceEnd);
          backwardChunks.push({ node: anchorNode, text });
          totalChars += text.length;
        }
      } else if (anchorNode.nodeType === 1) {
        const child = anchorNode.childNodes[anchorOffset - 1];
        if (child) {
          currentNode = child;
          if (child.nodeType === 3) {
            const textContent = child.textContent || '';
            const needed = maxChars - totalChars;
            const sliceStart = Math.max(0, textContent.length - needed);
            const text = textContent.slice(sliceStart);
            backwardChunks.push({ node: child, text });
            totalChars += text.length;
          }
        }
      }

      while (totalChars < maxChars && currentNode) {
        const prev = getPreviousNode(currentNode, blockElement);
        if (!prev) break;

        if (prev.nodeType === 1) {
          const tag = prev.tagName.toUpperCase();
          if (tag === 'BR' || isBlockElement(prev)) {
            break;
          }
        }

        if (prev.nodeType === 3) {
          const textContent = prev.textContent || '';
          if (textContent.length > 0) {
            const needed = maxChars - totalChars;
            const sliceStart = Math.max(0, textContent.length - needed);
            const text = textContent.slice(sliceStart);
            backwardChunks.push({ node: prev, text });
            totalChars += text.length;
          }
        }

        currentNode = prev;
      }

      backwardChunks.reverse();
      let text = '';
      const segments = [];

      for (const chunk of backwardChunks) {
        const start = text.length;
        text += chunk.text;
        segments.push({
          node: chunk.node,
          start,
          end: text.length,
        });
      }

      return { text, caretOffset: text.length, segments, blockElement };
    };

    const runBench = (root, anchorNode, anchorOffset, n = 300) => {
      // Warmup
      for (let i = 0; i < 30; i++) {
        extractBackwardFromCaret(root, anchorNode, anchorOffset);
      }

      const times = [];
      let lastResult = null;
      for (let i = 0; i < n; i++) {
        const t0 = performance.now();
        lastResult = extractBackwardFromCaret(root, anchorNode, anchorOffset);
        const t1 = performance.now();
        times.push(t1 - t0);
      }

      times.sort((a, b) => a - b);
      const p50 = times[Math.floor(n * 0.50)];
      const p95 = times[Math.floor(n * 0.95)];

      return {
        n,
        p50,
        p95,
        extractedLength: lastResult.text.length,
        segmentCount: lastResult.segments.length,
      };
    };

    const container = document.getElementById('container');

    // Shape 1: 500 <p> paragraphs (10,000 words total)
    const shape1 = document.createElement('div');
    shape1.contentEditable = 'true';
    for (let p = 0; p < 500; p++) {
      const pEl = document.createElement('p');
      pEl.textContent = 'Paragraph ' + p + ': ' + 'lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(2) + 'end ' + p + '.';
      shape1.appendChild(pEl);
    }
    container.appendChild(shape1);
    const p250 = shape1.children[250];
    const res1 = runBench(shape1, p250.firstChild, 30);

    // Shape 2: Flat 10,000-word block (single container with many text nodes)
    const shape2 = document.createElement('div');
    shape2.contentEditable = 'true';
    for (let i = 0; i < 100; i++) {
      shape2.appendChild(document.createTextNode('lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(10)));
    }
    container.appendChild(shape2);
    const middleTextNode = shape2.childNodes[50];
    const res2 = runBench(shape2, middleTextNode, 200);

    // Shape 3: <br>-separated lines with inline <span> formatting
    const shape3 = document.createElement('div');
    shape3.contentEditable = 'true';
    for (let i = 0; i < 100; i++) {
      const span1 = document.createElement('span');
      span1.textContent = 'Line ' + i + ' bold start ';
      const span2 = document.createElement('span');
      span2.style.fontWeight = 'bold';
      span2.textContent = 'formatted content here ';
      const span3 = document.createElement('span');
      span3.textContent = 'and normal trailing text';
      shape3.appendChild(span1);
      shape3.appendChild(span2);
      shape3.appendChild(span3);
      shape3.appendChild(document.createElement('br'));
    }
    container.appendChild(shape3);
    const targetSpan = shape3.querySelectorAll('span')[150];
    const res3 = runBench(shape3, targetSpan.firstChild, 15);

    // Shape 4: Deeply nested <div> structure (depth >= 25)
    const shape4 = document.createElement('div');
    shape4.contentEditable = 'true';
    let currentDiv = shape4;
    for (let d = 0; d < 25; d++) {
      const nextDiv = document.createElement('div');
      currentDiv.appendChild(nextDiv);
      currentDiv = nextDiv;
    }
    currentDiv.textContent = 'Deepest nested leaf node with editable text inside hierarchy.';
    container.appendChild(shape4);
    const res4 = runBench(shape4, currentDiv.firstChild, 40);

    return [
      { name: '500 <p> paragraphs', ...res1 },
      { name: 'flat 10k words in many text nodes', ...res2 },
      { name: '<br>-separated with inline spans', ...res3 },
      { name: 'deeply nested divs (depth 25)', ...res4 },
    ];
  })()`);

  await context.close();

  console.log('Shape Description                    | p50 (ms) | p95 (ms) | n   | Target  | Status');
  console.log('-------------------------------------+----------+----------+-----+---------+-------');

  let allPass = true;
  for (const r of results as any[]) {
    const pass = r.p95 < 2.0;
    if (!pass) allPass = false;
    console.log(
      `${r.name.padEnd(36)} | ${r.p50.toFixed(4).padStart(8)} | ${r.p95.toFixed(4).padStart(8)} | ${String(r.n).padStart(3)} | < 2.0ms | ${pass ? 'PASS' : 'FAIL'}`
    );
  }
  console.log('-------------------------------------+----------+----------+-----+---------+-------');

  const outPath = 'evidence/v0.5.0/dom-extract-bench.json';
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nEvidence saved to ${outPath}`);

  if (!allPass) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
