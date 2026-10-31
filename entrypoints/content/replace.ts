import { recordCorrection, recordRevert, recordRejection } from './settings';

export interface CorrectionRecord {
  element: HTMLElement;
  start: number;
  original: string;
  corrected: string;
  boundary: string;
  timestamp: number;
}

let activeCorrection: CorrectionRecord | null = null;
const rejectedTokens = new Set<string>();

export function getActiveCorrection(): CorrectionRecord | null {
  return activeCorrection;
}

export function clearActiveCorrection(): void {
  activeCorrection = null;
}

export function isTokenRejected(token: string): boolean {
  return rejectedTokens.has(token.toLowerCase());
}

export function addRejectedToken(token: string): void {
  rejectedTokens.add(token.toLowerCase());
}

export function clearRejectedTokens(): void {
  rejectedTokens.clear();
}

let isProgrammaticChange = false;

export function isHandlingProgrammaticChange(): boolean {
  return isProgrammaticChange;
}

/**
 * Safely replace word + boundary in input or textarea
 */
function replaceInTextInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  start: number,
  end: number,
  replacementWithBoundary: string
): boolean {
  isProgrammaticChange = true;
  try {
    element.focus();
    element.setSelectionRange(start, end);

    let success = false;
    try {
      success = document.execCommand('insertText', false, replacementWithBoundary);
    } catch {
      success = false;
    }

    // Fallback if execCommand fails or is ignored
    const expectedLength = start + replacementWithBoundary.length;
    if (!success || element.selectionStart !== expectedLength) {
      element.setRangeText(replacementWithBoundary, start, end, 'end');

      // Trigger React / framework value setters
      const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const valueDesc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (valueDesc?.set) {
        valueDesc.set.call(element, element.value);
      }

      element.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: false,
          composed: true,
          inputType: 'insertReplacementText',
        })
      );
    }

    return true;
  } finally {
    isProgrammaticChange = false;
  }
}

import {
  BLOCK_TAGS,
  isBlockElement,
  getNearestBlockAncestor,
  extractBackwardFromCaret,
  type TextSegment,
} from './dom-extract';

export {
  BLOCK_TAGS,
  isBlockElement,
  getNearestBlockAncestor,
  extractBackwardFromCaret,
  type TextSegment,
};

/**
 * Extract text and character offsets while respecting block boundaries and line breaks (<div>, <p>, <br>, etc.)
 */
export function extractContentEditableStructure(root: HTMLElement): {
  text: string;
  segments: TextSegment[];
} {
  const segments: TextSegment[] = [];
  let text = '';

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const content = node.textContent || '';
      const start = text.length;
      text += content;
      segments.push({ node, start, end: text.length });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toUpperCase();
      if (tag === 'BR') {
        text += '\n';
      } else {
        const block = isBlockElement(el);
        if (block && text.length > 0 && !text.endsWith('\n')) {
          text += '\n';
        }
        for (let i = 0; i < el.childNodes.length; i++) {
          walk(el.childNodes[i]!);
        }
        if (block && text.length > 0 && !text.endsWith('\n')) {
          text += '\n';
        }
      }
    }
  };

  for (let i = 0; i < root.childNodes.length; i++) {
    walk(root.childNodes[i]!);
  }

  return { text, segments };
}

/**
 * Safely replace word + boundary in contenteditable with multi-line block awareness
 */
function replaceInContentEditable(
  element: HTMLElement,
  start: number,
  end: number,
  replacementWithBoundary: string
): boolean {
  isProgrammaticChange = true;
  try {
    element.focus();
    const selection = window.getSelection();
    if (!selection) return false;

    let startNode: Node | null = null;
    let startOffset = 0;
    let endNode: Node | null = null;
    let endOffset = 0;

    // Fast-path: check bounded backward extraction segments first (O(1), <0.01ms)
    if (selection.anchorNode) {
      const backward = extractBackwardFromCaret(element, selection.anchorNode, selection.anchorOffset, 500);
      for (const seg of backward.segments) {
        if (!startNode && start >= seg.start && start <= seg.end) {
          startNode = seg.node;
          startOffset = start - seg.start;
        }
        if (!endNode && end >= seg.start && end <= seg.end) {
          endNode = seg.node;
          endOffset = end - seg.start;
          break;
        }
      }
    }

    // Fallback: extract structure of current block
    if (!startNode || !endNode) {
      const { segments } = extractContentEditableStructure(element);
      for (const seg of segments) {
        if (!startNode && start >= seg.start && start <= seg.end) {
          startNode = seg.node;
          startOffset = start - seg.start;
        }
        if (!endNode && end >= seg.start && end <= seg.end) {
          endNode = seg.node;
          endOffset = end - seg.start;
          break;
        }
      }
    }

    // Fallback to basic text walker if segment lookup failed
    if (!startNode || !endNode) {
      let currentOffset = 0;
      let startFound = false;
      let endFound = false;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let textNode: Node | null;

      while ((textNode = walker.nextNode())) {
        const textLen = textNode.textContent?.length || 0;
        const nextOffset = currentOffset + textLen;

        if (!startFound && start >= currentOffset && start <= nextOffset) {
          startNode = textNode;
          startOffset = start - currentOffset;
          startFound = true;
        }

        if (!endFound && end >= currentOffset && end <= nextOffset) {
          endNode = textNode;
          endOffset = end - currentOffset;
          endFound = true;
          break;
        }

        currentOffset = nextOffset;
      }
    }

    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);

      selection.removeAllRanges();
      selection.addRange(range);
      let success = false;
      try {
        success = document.execCommand('insertText', false, replacementWithBoundary);
      } catch {
        success = false;
      }
      if (!success) {
        range.deleteContents();
        const textNode = document.createTextNode(replacementWithBoundary);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      return true;
    }

    return false;
  } finally {
    isProgrammaticChange = false;
  }
}

/**
 * Execute atomic replacement and record for undo
 */
export function executeReplacement(
  element: HTMLElement,
  start: number,
  end: number,
  original: string,
  corrected: string,
  boundary: string
): boolean {
  const replacementWithBoundary = corrected + boundary;

  let replaced = false;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    replaced = replaceInTextInput(element, start, end, replacementWithBoundary);
  } else if (element.isContentEditable) {
    replaced = replaceInContentEditable(element, start, end, replacementWithBoundary);
  }

  if (replaced) {
    activeCorrection = {
      element,
      start,
      original,
      corrected,
      boundary,
      timestamp: Date.now(),
    };
    recordCorrection().catch(() => {});
  }

  return replaced;
}

/**
 * Handle Backspace undo: restores original word, removes boundary, positions caret at end
 */
export function handleBackspaceUndo(element: HTMLElement): boolean {
  if (
    !activeCorrection ||
    (activeCorrection.element !== element &&
      !element.contains(activeCorrection.element) &&
      !activeCorrection.element.contains(element))
  ) {
    return false;
  }

  const targetEl = activeCorrection.element;
  const { start, original, corrected, boundary } = activeCorrection;
  const replacedLength = corrected.length + boundary.length;
  const expectedCaret = start + replacedLength;

  if (targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement) {
    if (targetEl.selectionStart !== expectedCaret || targetEl.selectionEnd !== expectedCaret) {
      activeCorrection = null;
      return false;
    }

    addRejectedToken(original);
    recordRejection(original).catch(() => {});
    recordRevert().catch(() => {});
    activeCorrection = null;

    // Revert to original without boundary
    replaceInTextInput(targetEl, start, start + replacedLength, original);
    targetEl.setSelectionRange(start + original.length, start + original.length);
  } else if (targetEl.isContentEditable) {
    addRejectedToken(original);
    recordRejection(original).catch(() => {});
    recordRevert().catch(() => {});
    activeCorrection = null;

    replaceInContentEditable(targetEl, start, start + replacedLength, original);
  }

  return true;
}

/**
 * Revert active correction (called from Undo Chip)
 */
export function revertCorrection(element: HTMLElement): boolean {
  if (
    !activeCorrection ||
    (activeCorrection.element !== element &&
      !element.contains(activeCorrection.element) &&
      !activeCorrection.element.contains(element))
  ) {
    return false;
  }

  const targetEl = activeCorrection.element;
  const { start, original, corrected, boundary } = activeCorrection;
  const replacedLength = corrected.length + boundary.length;

  addRejectedToken(original);
  recordRejection(original).catch(() => {});
  recordRevert().catch(() => {});
  activeCorrection = null;

  if (targetEl instanceof HTMLInputElement || targetEl instanceof HTMLTextAreaElement) {
    replaceInTextInput(targetEl, start, start + replacedLength, original + boundary);
    targetEl.focus();
    targetEl.setSelectionRange(start + original.length + boundary.length, start + original.length + boundary.length);
  } else if (targetEl.isContentEditable) {
    replaceInContentEditable(targetEl, start, start + replacedLength, original + boundary);
    targetEl.focus();
  }

  return true;
}
