import { chromium } from 'playwright';

async function runBenchmark() {
  console.log('--- Benchmarking Contenteditable Extraction on 10,000-word Document ---');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent('<div id="editor" contenteditable="true" style="white-space: pre-wrap;"></div>');

  const result = await page.evaluate(`(() => {
    const editor = document.getElementById('editor');

    // Construct a realistic 10,000-word rich text contenteditable with 500 paragraphs of 20 words each
    for (let p = 0; p < 500; p++) {
      const pEl = document.createElement('p');
      pEl.textContent = 'Paragraph ' + p + ': ' + 'lorem ipsum dolor sit amet consectetur adipiscing elit '.repeat(2) + 'end ' + p + '.';
      editor.appendChild(pEl);
    }

    // Place caret at paragraph 250
    const targetP = editor.children[250];
    const textNode = targetP.firstChild;
    const offset = 15;

    const BLOCK_TAGS = new Set([
      'DIV', 'P', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'PRE',
    ]);

    const isBlockElement = (el) => BLOCK_TAGS.has(el.tagName.toUpperCase());

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

    const extractContentEditableStructure = (root) => {
      const segments = [];
      let text = '';
      const walk = (node) => {
        if (node.nodeType === 3) {
          const content = node.textContent || '';
          const start = text.length;
          text += content;
          segments.push({ node, start, end: text.length });
        } else if (node.nodeType === 1) {
          const el = node;
          const tag = el.tagName.toUpperCase();
          if (tag === 'BR') {
            text += '\\n';
          } else {
            const block = isBlockElement(el);
            if (block && text.length > 0 && !text.endsWith('\\n')) text += '\\n';
            for (let i = 0; i < el.childNodes.length; i++) walk(el.childNodes[i]);
            if (block && text.length > 0 && !text.endsWith('\\n')) text += '\\n';
          }
        }
      };
      for (let i = 0; i < root.childNodes.length; i++) walk(root.childNodes[i]);
      return { text, segments };
    };

    // Baseline: Full document tree walk
    const warmup = 20;
    const iterations = 100;

    for (let i = 0; i < warmup; i++) {
      extractContentEditableStructure(editor);
    }
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      extractContentEditableStructure(editor);
    }
    const fullTime = (performance.now() - t0) / iterations;

    // Optimized: Nearest-block extraction + bounded context
    for (let i = 0; i < warmup; i++) {
      const block = getNearestBlockAncestor(textNode, editor);
      extractContentEditableStructure(block);
    }
    const t1 = performance.now();
    for (let i = 0; i < iterations; i++) {
      const block = getNearestBlockAncestor(textNode, editor);
      const res = extractContentEditableStructure(block);
      const seg = res.segments.find(s => s.node === textNode);
      const caret = seg ? seg.start + offset : 0;
      const textBefore = res.text.slice(Math.max(0, caret - 500), caret);
    }
    const blockTime = (performance.now() - t1) / iterations;

    // Also test single flat 10,000-word block (unstructured) with bounded extraction
    const flatEditor = document.createElement('div');
    flatEditor.contentEditable = 'true';
    for (let i = 0; i < 100; i++) {
      flatEditor.appendChild(document.createTextNode('word '.repeat(100)));
    }
    const midNode = flatEditor.childNodes[50];
    const t2 = performance.now();
    for (let i = 0; i < iterations; i++) {
      const block = getNearestBlockAncestor(midNode, flatEditor);
      const res = extractContentEditableStructure(block);
      const textBefore = res.text.slice(Math.max(0, 2500 - 500), 2500);
    }
    const flatTime = (performance.now() - t2) / iterations;

    return {
      wordCount: 10000,
      paragraphs: 500,
      fullWalkAvgMs: fullTime,
      nearestBlockAvgMs: blockTime,
      flat10kBlockAvgMs: flatTime,
    };
  })()`);

  console.log(`Word Count: ${result.wordCount} words across ${result.paragraphs} blocks`);
  console.log(`Unoptimized Full Walk: ${result.fullWalkAvgMs.toFixed(3)} ms`);
  console.log(`Nearest-Block Walk:   ${result.nearestBlockAvgMs.toFixed(3)} ms (Target: < 2.0 ms)`);
  console.log(`Flat 10k Block Walk:  ${result.flat10kBlockAvgMs.toFixed(3)} ms`);

  await browser.close();

  if (result.nearestBlockAvgMs >= 2.0) {
    throw new Error(`Nearest-block extraction exceeded 2.0ms budget: ${result.nearestBlockAvgMs} ms`);
  }
  console.log('✅ Extraction benchmark passed successfully under 2 ms!');
}

runBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
