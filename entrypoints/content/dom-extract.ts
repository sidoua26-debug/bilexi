/**
 * entrypoints/content/dom-extract.ts
 * Pure, importable DOM extraction utilities for contenteditable and rich-text editors.
 * Implements true backward traversal bounded to <= 500 characters and block/BR boundaries.
 */

export const BLOCK_TAGS = new Set([
  'DIV', 'P', 'LI', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'BLOCKQUOTE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'ASIDE', 'PRE',
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'UL', 'OL', 'DL', 'DT', 'DD',
]);

export function isBlockElement(el: Node | null): boolean {
  if (!el || el.nodeType !== 1) return false;
  return BLOCK_TAGS.has((el as Element).tagName.toUpperCase());
}

export function getNearestBlockAncestor(node: Node, root: HTMLElement): HTMLElement {
  let curr: Node | null = node.nodeType === 1 ? node : node.parentElement;
  while (curr && curr !== root) {
    if (curr.nodeType === 1 && isBlockElement(curr)) {
      return curr as HTMLElement;
    }
    curr = curr.parentNode;
  }
  return root;
}

export interface TextSegment {
  node: Node;
  start: number;
  end: number;
}

export interface BoundedExtractionResult {
  text: string;
  caretOffset: number;
  segments: TextSegment[];
  blockElement: HTMLElement;
}

/**
 * Gets the previous node in reverse document order within the boundary of root.
 */
function getPreviousNode(node: Node, boundary: Node): Node | null {
  if (node === boundary) return null;

  if (node.previousSibling) {
    let curr = node.previousSibling;
    while (curr.lastChild) {
      if (curr.nodeType === 1 && (isBlockElement(curr) || (curr as Element).tagName.toUpperCase() === 'BR')) {
        break;
      }
      curr = curr.lastChild;
    }
    return curr;
  }

  return node.parentNode && node.parentNode !== boundary ? node.parentNode : null;
}

/**
 * Extracts up to maxChars (default 500) of text immediately preceding the caret
 * using a true backward DOM traversal.
 *
 * Traversal stops at:
 * 1. maxChars limit reached.
 * 2. Block boundary (e.g. <p>, <div>, <li>).
 * 3. Line break element (<br>).
 */
export function extractBackwardFromCaret(
  root: HTMLElement,
  anchorNode: Node,
  anchorOffset: number,
  maxChars = 500
): BoundedExtractionResult {
  const blockElement = getNearestBlockAncestor(anchorNode, root);
  const backwardChunks: Array<{ node: Node; text: string }> = [];
  let totalChars = 0;

  // 1. First extract text from the anchor node itself
  let currentNode: Node | null = anchorNode;

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
    // If anchor is an element, anchorOffset is child index
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

  // 2. Walk backwards through preceding siblings and parent branches within blockElement
  while (totalChars < maxChars && currentNode) {
    const prev: Node | null = getPreviousNode(currentNode, blockElement);
    if (!prev) break;

    // Check if we hit a block element or BR tag
    if (prev.nodeType === 1) {
      const tag = (prev as Element).tagName.toUpperCase();
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

  // 3. Reconstruct forward order
  backwardChunks.reverse();

  let text = '';
  const segments: TextSegment[] = [];

  for (const chunk of backwardChunks) {
    const start = text.length;
    text += chunk.text;
    segments.push({
      node: chunk.node,
      start,
      end: text.length,
    });
  }

  return {
    text,
    caretOffset: text.length,
    segments,
    blockElement,
  };
}
