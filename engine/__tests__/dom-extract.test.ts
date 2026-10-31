/**
 * engine/__tests__/dom-extract.test.ts
 *
 * Unit tests for extractBackwardFromCaret covering all required edge cases:
 * 1. Caret at node start
 * 2. Caret at node end
 * 3. Inside inline span/link
 * 4. After <br>
 * 5. Nested list
 * 6. Empty block
 * 7. >500 chars (bounded extraction)
 * 8. Non-breaking space (NBSP)
 * 9. Mid-word caret
 */

import { describe, it, expect } from 'vitest';
import { extractBackwardFromCaret } from '../../entrypoints/content/dom-extract';

// Use linkedom for real DOM structure in unit test environment
const { parseHTML } = require('../../node_modules/.pnpm/linkedom@0.18.13/node_modules/linkedom');

describe('extractBackwardFromCaret', () => {
  it('1. Caret at node start (offset 0): returns empty text if at very start of block', () => {
    const { document } = parseHTML('<div contenteditable="true"><p id="p">Hello world</p></div>');
    const root = document.querySelector('div') as HTMLElement;
    const p = document.querySelector('#p') as HTMLElement;
    const textNode = p.firstChild as Node;

    const res = extractBackwardFromCaret(root, textNode, 0);
    expect(res.text).toBe('');
    expect(res.caretOffset).toBe(0);
  });

  it('2. Caret at node end (offset = text length): extracts complete text', () => {
    const { document } = parseHTML('<div contenteditable="true"><p id="p">Hello world</p></div>');
    const root = document.querySelector('div') as HTMLElement;
    const p = document.querySelector('#p') as HTMLElement;
    const textNode = p.firstChild as Node;

    const res = extractBackwardFromCaret(root, textNode, 11);
    expect(res.text).toBe('Hello world');
  });

  it('3. Inside inline span/link: traverses backward across span boundaries within block', () => {
    const { document } = parseHTML(
      '<div contenteditable="true"><p id="p">Click <a href="#">this <span id="s">link</span></a> here</p></div>'
    );
    const root = document.querySelector('div') as HTMLElement;
    const span = document.querySelector('#s') as HTMLElement;
    const spanText = span.firstChild as Node; // "link"

    // Caret at end of "link" inside span
    const res = extractBackwardFromCaret(root, spanText, 4);
    expect(res.text).toBe('Click this link');
  });

  it('4. After <br>: stops backward traversal at line break element', () => {
    const { document } = parseHTML(
      '<div contenteditable="true"><p id="p">Line 1<br>Line 2</p></div>'
    );
    const root = document.querySelector('div') as HTMLElement;
    const p = document.querySelector('#p') as HTMLElement;
    // childNodes: [TextNode("Line 1"), HTMLBRElement, TextNode("Line 2")]
    const line2Text = p.childNodes[2] as Node;

    // Caret at end of "Line 2"
    const res = extractBackwardFromCaret(root, line2Text, 6);
    expect(res.text).toBe('Line 2');
    expect(res.text).not.toContain('Line 1');
  });

  it('5. Nested list: stops at <li> boundary', () => {
    const { document } = parseHTML(
      '<div contenteditable="true"><ul><li>Item 1</li><li>Item 2<ul><li>Subitem 1</li></ul></li></ul></div>'
    );
    const root = document.querySelector('div') as HTMLElement;
    const subLi = document.querySelectorAll('li')[2] as HTMLElement;
    const textNode = subLi.firstChild as Node; // "Subitem 1"

    const res = extractBackwardFromCaret(root, textNode, 9);
    expect(res.text).toBe('Subitem 1');
    expect(res.text).not.toContain('Item 2');
    expect(res.text).not.toContain('Item 1');
  });

  it('6. Empty block: handles empty block gracefully', () => {
    const { document } = parseHTML('<div contenteditable="true"><p id="p"></p></div>');
    const root = document.querySelector('div') as HTMLElement;
    const p = document.querySelector('#p') as HTMLElement;

    const res = extractBackwardFromCaret(root, p, 0);
    expect(res.text).toBe('');
  });

  it('7. >500 chars: strictly bounds extraction to maxChars (500)', () => {
    const longString = 'abcde '.repeat(150); // 900 chars
    const { document } = parseHTML(`<div contenteditable="true"><p id="p">${longString}</p></div>`);
    const root = document.querySelector('div') as HTMLElement;
    const p = document.querySelector('#p') as HTMLElement;
    const textNode = p.firstChild as Node;

    const res = extractBackwardFromCaret(root, textNode, 900, 500);
    expect(res.text.length).toBe(500);
    expect(res.text).toBe(longString.slice(400, 900));
  });

  it('8. NBSP (\\u00a0): preserves non-breaking spaces correctly', () => {
    const { document } = parseHTML('<div contenteditable="true"><p id="p">bonjour\u00a0monde</p></div>');
    const root = document.querySelector('div') as HTMLElement;
    const p = document.querySelector('#p') as HTMLElement;
    const textNode = p.firstChild as Node;

    const res = extractBackwardFromCaret(root, textNode, 13);
    expect(res.text).toBe('bonjour\u00a0monde');
  });

  it('9. Mid-word caret: extracts up to the exact caret offset within token', () => {
    const { document } = parseHTML('<div contenteditable="true"><p id="p">supercalifragilistic</p></div>');
    const root = document.querySelector('div') as HTMLElement;
    const p = document.querySelector('#p') as HTMLElement;
    const textNode = p.firstChild as Node;

    // Caret after "super" (offset 5)
    const res = extractBackwardFromCaret(root, textNode, 5);
    expect(res.text).toBe('super');
  });
});
