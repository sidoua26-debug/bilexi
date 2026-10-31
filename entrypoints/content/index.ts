import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { createEngine } from '../../engine/engine';
import { detectSentenceStart } from '../../engine/case';
import { isFieldEligible } from './policy';
import {
  executeReplacement,
  handleBackspaceUndo,
  revertCorrection,
  clearActiveCorrection,
  isTokenRejected,
  clearRejectedTokens,
  isHandlingProgrammaticChange,
  extractBackwardFromCaret,
} from './replace';
import { showUndoChip, hideUndoChip } from './chip';
import { showSuggestionStrip, hideSuggestionStrip } from './strip';
import {
  getSettings,
  loadSettings,
  subscribeToSettings,
  isSiteDisabled,
  recordWordUsage,
} from './settings';

import './style.css';

const BOUNDARY_CHARS = new Set([' ', '\t', '\n', '\r', '\u00A0', '\u202F', '.', ',', ';', ':', '!', '?', ')', ']', '}', '»', '…', '"', '“', '”', '«']);

function isSearchField(el: HTMLElement): boolean {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'search') return true;
    const name = (el.name || '').toLowerCase();
    if (name === 'q' || name === 'search' || name === 'query') return true;
    const id = (el.id || '').toLowerCase();
    if (id === 'search' || id === 'q') return true;
  }
  if (el.getAttribute('role') === 'searchbox') return true;
  const form = el.closest('form');
  if (form) {
    if (form.getAttribute('role') === 'search') return true;
    const action = (form.getAttribute('action') || '').toLowerCase();
    if (action.includes('search')) return true;
  }
  return false;
}

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_idle',
  cssInjectionMode: 'ui',
  main(ctx) {
    return setupContentListeners(ctx);
  },
});

let engineInstance: ReturnType<typeof createEngine> | null = null;
let engineLoadingPromise: Promise<ReturnType<typeof createEngine> | null> | null = null;

async function loadEngine(): Promise<ReturnType<typeof createEngine> | null> {
  if (engineInstance) return engineInstance;
  if (engineLoadingPromise) return engineLoadingPromise;

  engineLoadingPromise = (async () => {
    try {
      const [enRes, frRes] = await Promise.all([
        fetch(chrome.runtime.getURL('dict/en.bin')),
        fetch(chrome.runtime.getURL('dict/fr.bin')),
      ]);

      const [enBuf, frBuf] = await Promise.all([
        enRes.arrayBuffer(),
        frRes.arrayBuffer(),
      ]);

      let ngBuf: ArrayBuffer | undefined;
      try {
        const ngRes = await fetch(chrome.runtime.getURL('dict/ngram.bin'));
        if (ngRes.ok) {
          ngBuf = await ngRes.arrayBuffer();
        }
      } catch (e) {
        console.warn('[bilingual-autocorrect] Optional n-gram model unavailable:', e);
      }

      const settings = getSettings();
      engineInstance = createEngine(
        { en: enBuf, fr: frBuf, ngram: ngBuf },
        {
          languageMode: settings.languageMode,
          sensitivity: settings.sensitivity,
          layout: 'auto',
          sentenceCaps: settings.sentenceCaps,
          fixLoneI: settings.fixLoneI,
          personalWords: settings.personalWords,
          rejectedWords: settings.rejectedWords,
          shortcuts: settings.shortcuts,
          typographicApostrophe: settings.typographicApostrophe,
        }
      );
      return engineInstance;
    } catch (err) {
      console.warn('[bilingual-autocorrect] Lazy loading engine failed:', err);
      return null;
    } finally {
      engineLoadingPromise = null;
    }
  })();

  return engineLoadingPromise;
}

export function getTextAndCaret(
  target: HTMLElement,
  win: Window
): {
  textBeforeCaret: string;
  textAfterCaret: string;
  caretPos: number;
  activeElement: HTMLElement;
} {
  let textBeforeCaret = '';
  let textAfterCaret = '';
  let caretPos = 0;
  let activeElement: HTMLElement = target;

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    caretPos = target.selectionStart || 0;
    const fullBefore = target.value.slice(0, caretPos);
    textBeforeCaret = fullBefore.length > 500 ? fullBefore.slice(-500) : fullBefore;
    textAfterCaret = target.value.slice(caretPos);
  } else if (target.isContentEditable) {
    const sel = win.getSelection();
    if (sel && sel.anchorNode) {
      const res = extractBackwardFromCaret(target, sel.anchorNode, sel.anchorOffset, 500);
      activeElement = res.blockElement;
      caretPos = res.caretOffset;
      textBeforeCaret = res.text;
      if (sel.anchorNode.nodeType === 3) {
        const textContent = sel.anchorNode.textContent || '';
        textAfterCaret = textContent.slice(sel.anchorOffset, sel.anchorOffset + 1);
      } else {
        textAfterCaret = '';
      }
    }
  }

  return { textBeforeCaret, textAfterCaret, caretPos, activeElement };
}

function getCaretCoordinates(target: HTMLElement): DOMRect | null {
  if (target.isContentEditable) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0).cloneRange();
      range.collapse(true);
      const rect = range.getBoundingClientRect();
      if (rect && (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0)) {
        return rect;
      }
    }
  } else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    try {
      const caret = target.selectionEnd || target.selectionStart || 0;
      const computed = window.getComputedStyle(target);
      const isInput = target instanceof HTMLInputElement;

      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.style.top = '-9999px';
      div.style.left = '-9999px';
      div.style.visibility = 'hidden';
      div.style.whiteSpace = isInput ? 'nowrap' : 'pre-wrap';
      div.style.wordWrap = 'break-word';
      div.style.width = computed.width;
      div.style.fontFamily = computed.fontFamily;
      div.style.fontSize = computed.fontSize;
      div.style.fontWeight = computed.fontWeight;
      div.style.lineHeight = computed.lineHeight;
      div.style.letterSpacing = computed.letterSpacing;
      div.style.padding = computed.padding;
      div.style.border = computed.border;
      div.style.boxSizing = computed.boxSizing;

      const text = target.value.substring(0, caret);
      div.textContent = text;
      const span = document.createElement('span');
      span.textContent = target.value.substring(caret) || '.';
      div.appendChild(span);

      document.body.appendChild(div);
      const targetRect = target.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();
      const divRect = div.getBoundingClientRect();

      const top = targetRect.top + (spanRect.top - divRect.top) - target.scrollTop;
      const left = targetRect.left + (spanRect.left - divRect.left) - target.scrollLeft;
      const height = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) || 16;

      document.body.removeChild(div);

      return new DOMRect(left, top, 2, height);
    } catch {
      // Fallback to target bounding rect
    }
  }
  return target.getBoundingClientRect();
}

function extractTypedToken(textWithoutBoundary: string, _boundary?: string): { word: string; precedingText: string } | null {
  // Guardrail: do not extract tokens that are part of an email address, URL, file path, or host:port
  const nonWhitespacePrefix = /[^\s\u00A0\u202F]+$/.exec(textWithoutBoundary)?.[0] || '';
  if (
    nonWhitespacePrefix.includes('@') ||
    nonWhitespacePrefix.includes('://') ||
    nonWhitespacePrefix.includes('/') ||
    nonWhitespacePrefix.includes(':')
  ) {
    return null;
  }

  // Defer / ignore if token has an internal dot or digits (e.g. readme.md, example.com, localhost:3000, v1.2.3)
  if (nonWhitespacePrefix.includes('.') || /\d/.test(nonWhitespacePrefix)) {
    return null;
  }

  const prevBoundaryMatch = /[\s\u00A0\u202F.,;!?()[\]{}«»"“”]+([^\s\u00A0\u202F.,;!?()[\]{}«»"“”]+)$/.exec(' ' + textWithoutBoundary);
  const rawToken = prevBoundaryMatch ? prevBoundaryMatch[1] : '';
  if (!rawToken || (rawToken.length < 2 && rawToken.toLowerCase() !== 'i')) return null;

  // Guardrail: no-op tokens (hashtags, handles, URLs, emails, codes)
  if (
    rawToken.startsWith('#') ||
    rawToken.startsWith('@') ||
    rawToken.includes('://') ||
    rawToken.includes('/') ||
    rawToken.includes(':') ||
    rawToken.includes('.') ||
    /\d/.test(rawToken)
  ) {
    return null;
  }

  if (!/^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]+$/.test(rawToken)) return null;

  const precedingText = textWithoutBoundary.slice(0, -rawToken.length);
  return { word: rawToken, precedingText };
}

function getFieldLangHint(target: HTMLElement): string | undefined {
  const elementLang = target.getAttribute('lang');
  if (elementLang !== null) {
    return elementLang !== '' ? elementLang : undefined;
  }
  return document.documentElement.lang || undefined;
}

export function setupContentListeners(
  ctx?: ContentScriptContext,
  win: Window = window
): () => void {
  let isComposing = false;
  let currentStripCandidates: string[] = [];
  let currentActiveTarget: HTMLElement | null = null;
  let currentActiveToken: string | null = null;
  let currentActiveBoundary = '';
  let currentActiveStart = 0;
  let currentActiveEnd = 0;
  let stripDismissedForWord = false;

  const onCompStart = () => {
    isComposing = true;
  };
  const onCompEnd = () => {
    isComposing = false;
  };

  // Load settings and subscribe to storage changes
  loadSettings().then(() => {
    if (engineInstance) {
      const s = getSettings();
      engineInstance.updateSettings({
        languageMode: s.languageMode,
        sensitivity: s.sensitivity,
        sentenceCaps: s.sentenceCaps,
        fixLoneI: s.fixLoneI,
        personalWords: s.personalWords,
        rejectedWords: s.rejectedWords,
        shortcuts: s.shortcuts,
        typographicApostrophe: s.typographicApostrophe,
      });
    }
  });

  const unsubscribeSettings = subscribeToSettings((newSettings) => {
    if (engineInstance) {
      engineInstance.updateSettings({
        languageMode: newSettings.languageMode,
        sensitivity: newSettings.sensitivity,
        sentenceCaps: newSettings.sentenceCaps,
        fixLoneI: newSettings.fixLoneI,
        personalWords: newSettings.personalWords,
        rejectedWords: newSettings.rejectedWords,
        shortcuts: newSettings.shortcuts,
        typographicApostrophe: newSettings.typographicApostrophe,
      });
    }
  });

  function getEventTarget(e: Event): HTMLElement | null {
    const path = e.composedPath();
    const target = path.length > 0 ? path[0] : e.target;
    return target instanceof HTMLElement ? target : null;
  }

  function applyStripCandidate(selectedCandidate: string) {
    if (!currentActiveTarget || !currentActiveToken) return;

    const target = currentActiveTarget;
    const origToken = currentActiveToken;
    const boundary = currentActiveBoundary;
    const start = currentActiveStart;
    const end = currentActiveEnd + boundary.length;

    executeReplacement(
      target,
      start,
      end,
      origToken,
      selectedCandidate,
      boundary
    );

    // Position caret after the boundary so typing can continue seamlessly
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const caretAfter = start + selectedCandidate.length + boundary.length;
      target.setSelectionRange(caretAfter, caretAfter);
      target.focus();
    } else if (target.isContentEditable) {
      target.focus();
    }

    hideSuggestionStrip();
    currentStripCandidates = [];
    currentActiveTarget = null;
    currentActiveToken = null;
    currentActiveBoundary = '';
    stripDismissedForWord = true;
  }

  // Prewarm engine on focus of an eligible field
  function handleFocusIn(e: FocusEvent) {
    if (isSiteDisabled()) return;
    const target = getEventTarget(e);
    if (!target || !isFieldEligible(target)) return;

    clearRejectedTokens();
    clearActiveCorrection();
    hideUndoChip();
    hideSuggestionStrip();
    stripDismissedForWord = false;

    if (!engineInstance && !engineLoadingPromise) {
      if ('requestIdleCallback' in win) {
        (win as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(() => {
          loadEngine().catch(() => {});
        });
      } else {
        setTimeout(() => {
          loadEngine().catch(() => {});
        }, 0);
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (isHandlingProgrammaticChange()) return;
    if (isSiteDisabled()) return;
    if (isComposing || e.isComposing) return;
    const target = getEventTarget(e);
    if (!target || !isFieldEligible(target)) return;

    // Esc dismisses strip until next word
    if (e.key === 'Escape') {
      hideSuggestionStrip();
      stripDismissedForWord = true;
      return;
    }

    // Keyboard selection: Alt+1, Alt+2, Alt+3 (or Option on Mac)
    // Using event.code (Digit1, Digit2, Digit3) ensures reliable detection across keyboard layouts (e.g. French AZERTY)
    const isAltDigit = e.altKey && (
      e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' ||
      e.key === '1' || e.key === '2' || e.key === '3' ||
      e.key === '&' || e.key === 'é' || e.key === '"' // AZERTY unshifted number row symbols
    );

    if (isAltDigit) {
      let slotIdx = 0;
      if (e.code === 'Digit1' || e.key === '1' || e.key === '&') slotIdx = 1;
      else if (e.code === 'Digit2' || e.key === '2' || e.key === 'é') slotIdx = 2;
      else if (e.code === 'Digit3' || e.key === '3' || e.key === '"') slotIdx = 3;

      if (currentActiveTarget && currentActiveToken && slotIdx > 0) {
        let chosen: string | null = null;
        if (slotIdx === 1) chosen = currentActiveToken;
        else if (slotIdx === 2 && currentStripCandidates[0]) chosen = currentStripCandidates[0];
        else if (slotIdx === 3 && currentStripCandidates[1]) chosen = currentStripCandidates[1];

        if (chosen) {
          e.preventDefault();
          e.stopPropagation();
          applyStripCandidate(chosen);
          return;
        }
      }
    }

    if (e.key === 'Backspace') {
      if (handleBackspaceUndo(target)) {
        e.preventDefault();
        e.stopPropagation();
        hideUndoChip();
        hideSuggestionStrip();
      }
      return;
    }

    // Capture-phase Enter / Shift+Enter keydown correction before submit
    if (e.key === 'Enter') {
      if (engineInstance) {
        const { textBeforeCaret, caretPos, activeElement } = getTextAndCaret(target, win);
        if (textBeforeCaret && textBeforeCaret.length >= 2) {
          const extracted = extractTypedToken(textBeforeCaret);
          if (extracted && !isTokenRejected(extracted.word)) {
            const preceding = extracted.precedingText ? extracted.precedingText.trim() : '';
            const leftContext = preceding ? preceding.split(/\s+/).slice(-8) : [];
            const isSentenceInitial = detectSentenceStart(extracted.precedingText, {
              capitalizeFieldStart: getSettings().capitalizeFieldStart,
            });
            const langHint = getFieldLangHint(target);

            const decision = engineInstance.analyze({
              token: extracted.word,
              boundary: '',
              leftContext,
              langHint,
              isSentenceInitial,
            });

            if (decision.action === 'replace' && decision.replacement && decision.replacement !== extracted.word) {
              const wordStart = caretPos - extracted.word.length;
              const wordEnd = caretPos;
              executeReplacement(activeElement, wordStart, wordEnd, extracted.word, decision.replacement, '');
            }
          }
        }
      }
      clearActiveCorrection();
      hideUndoChip();
      hideSuggestionStrip();
      return;
    }

    // Any other movement key clears undo state & chip
    if (e.key !== 'Shift' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Meta' && e.key !== 'Dead') {
      clearActiveCorrection();
      hideUndoChip();
    }
  }

  async function handleInput(e: Event) {
    if (isHandlingProgrammaticChange()) return;
    if (isSiteDisabled()) return;
    if (isComposing || (e as InputEvent).isComposing) return;

    const inputEvent = e as InputEvent;
    const inputType = inputEvent.inputType;

    // Explicitly ignore non-typing input types: undo, redo, paste, drop, deletions
    if (
      inputType &&
      (
        inputType.startsWith('delete') ||
        inputType === 'historyUndo' ||
        inputType === 'historyRedo' ||
        inputType === 'insertFromPaste' ||
        inputType === 'insertFromPasteAsQuotation' ||
        inputType === 'insertFromDrop' ||
        inputType === 'insertReplacementText'
      )
    ) {
      hideSuggestionStrip();
      return;
    }

    const target = getEventTarget(e);
    if (!target || !isFieldEligible(target)) return;

    if (!engineInstance) {
      await loadEngine();
    }
    if (!engineInstance) return;

    const { textBeforeCaret, textAfterCaret, caretPos, activeElement } = getTextAndCaret(target, win);
    if (!textBeforeCaret || textBeforeCaret.length < 2) {
      hideSuggestionStrip();
      return;
    }

    const lastChar = textBeforeCaret.slice(-1);
    const isBoundary = BOUNDARY_CHARS.has(lastChar);

    if (isBoundary) {
      if (lastChar === '.') {
        // Deferred trigger on period: do not correct immediately if '.' is typed; wait for following space/boundary
        hideSuggestionStrip();
        return;
      }

      // Input event filtering: only run autocorrect on insertText (with e.data in boundary set) or insertLineBreak
      if (
        inputType &&
        inputType !== 'insertText' &&
        inputType !== 'insertLineBreak'
      ) {
        return;
      }
      if (
        inputEvent.data &&
        !BOUNDARY_CHARS.has(inputEvent.data) &&
        inputType !== 'insertLineBreak'
      ) {
        return;
      }

      // Caret check: verify caret is at the end of the word, not in the middle
      const nextChar = textAfterCaret ? textAfterCaret[0] : '';
      if (nextChar && !BOUNDARY_CHARS.has(nextChar)) {
        return;
      }

      // Word boundary typed - evaluate auto-replace and reset strip
      stripDismissedForWord = false;
      hideSuggestionStrip();

      const boundary = lastChar;
      const textWithoutBoundary = textBeforeCaret.slice(0, -1);

      // Check if preceding token had a deferred period (e.g. "teh. ")
      const hasTrailingPeriod = textWithoutBoundary.endsWith('.') && !textWithoutBoundary.endsWith('..');
      const trailingPunct = hasTrailingPeriod ? '.' : '';
      const textToExtract = trailingPunct ? textWithoutBoundary.slice(0, -1) : textWithoutBoundary;

      const extracted = extractTypedToken(textToExtract);
      if (!extracted) return;

      const word = extracted.word;
      if (isTokenRejected(word)) return;

      const preceding = extracted.precedingText ? extracted.precedingText.trim() : '';
      const leftContext = preceding ? preceding.split(/\s+/).slice(-8) : [];
      const isSentenceInitial = detectSentenceStart(extracted.precedingText, {
        capitalizeFieldStart: getSettings().capitalizeFieldStart,
      });
      const langHint = getFieldLangHint(target);

      const decision = engineInstance.analyze({
        token: word,
        boundary: trailingPunct || boundary,
        leftContext,
        langHint,
        isSentenceInitial,
      });

      if (decision.action !== 'replace' || !decision.replacement) {
        if (
          decision.action === 'none' &&
          decision.reason === 'No candidate within distance threshold' &&
          !isSearchField(target)
        ) {
          const lower = word.toLowerCase();
          const settings = getSettings();
          const isKnownInDict = engineInstance.isKnownWord(word);
          const isPersonal = settings.personalWords.some(w => w.toLowerCase() === lower);
          const isRejected = settings.rejectedWords.some(w => w.toLowerCase() === lower);

          if (!isKnownInDict && !isPersonal && !isRejected && word.length >= 3 && /^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]+$/.test(word)) {
            recordWordUsage(word).catch(() => {});
          }
        }
        return;
      }

      const finalReplacement = trailingPunct ? decision.replacement + trailingPunct : decision.replacement;
      const originalWord = trailingPunct ? word + trailingPunct : word;
      if (finalReplacement.toLowerCase() === originalWord.toLowerCase() && finalReplacement === originalWord) return;

      const wordStart = caretPos - boundary.length - originalWord.length;
      const wordEnd = caretPos;

      const replaced = executeReplacement(activeElement, wordStart, wordEnd, originalWord, finalReplacement, boundary);

      if (replaced && ctx) {
        // Show strip after autocorrect offering alternative candidates
        const showStrip = getSettings().showSuggestions && decision.alternatives && decision.alternatives.length > 0;

        if (showStrip) {
          hideUndoChip();
          const altWords = decision.alternatives.map(a => a.word).slice(0, 2);
          currentActiveTarget = activeElement;
          currentActiveToken = finalReplacement;
          currentActiveBoundary = boundary;
          currentActiveStart = wordStart;
          currentActiveEnd = wordStart + finalReplacement.length;
          currentStripCandidates = altWords;

          showSuggestionStrip({
            ctx,
            anchor: target,
            caretRect: getCaretCoordinates(target),
            rawToken: word, // Left slot doubles as undo to original
            candidates: altWords,
            onSelect: (selected) => {
              applyStripCandidate(selected);
            },
          });
        } else if (getSettings().showUndoChip) {
          showUndoChip({
            ctx,
            anchor: target,
            original: word,
            corrected: finalReplacement,
            onUndo: () => {
              revertCorrection(target);
            },
          });
        }
      }
      return;
    }

    const currentTokenMatch = /([^\s\u00A0.,;!?()[\]{}«»"“”]+)$/.exec(textBeforeCaret);
    const activeToken = currentTokenMatch ? currentTokenMatch[1]! : '';

    // If active token changes, reset stripDismissedForWord so new words show suggestions
    if (!currentActiveToken || !activeToken.startsWith(currentActiveToken)) {
      stripDismissedForWord = false;
    }

    // Non-boundary keystroke: check if currently typing a word of length >= 3
    if (!getSettings().showSuggestions || stripDismissedForWord) {
      hideSuggestionStrip();
      return;
    }

    if (!activeToken || activeToken.length < 3 || !/^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]+$/.test(activeToken)) {
      hideSuggestionStrip();
      return;
    }

    // Check if token is already known and suggestOnlyMisspelled is active
    if (getSettings().suggestOnlyMisspelled && engineInstance.isKnownWord(activeToken)) {
      hideSuggestionStrip();
      return;
    }

    const preceding = textBeforeCaret.slice(0, -activeToken.length).trim();
    const leftContext = preceding ? preceding.split(/\s+/).slice(-8) : [];
    const langHint = getFieldLangHint(target);

    const candidates = engineInstance.suggest({
      token: activeToken,
      boundary: '',
      leftContext,
      langHint,
    });

    if (candidates && candidates.length > 0 && ctx) {
      hideUndoChip();
      currentActiveTarget = target;
      currentActiveToken = activeToken;
      currentActiveBoundary = '';
      currentActiveStart = caretPos - activeToken.length;
      currentActiveEnd = caretPos;
      currentStripCandidates = candidates;

      showSuggestionStrip({
        ctx,
        anchor: target,
        caretRect: getCaretCoordinates(target),
        rawToken: activeToken,
        candidates,
        onSelect: (selected) => {
          applyStripCandidate(selected);
        },
      });
    } else {
      hideSuggestionStrip();
    }
  }

  function handleFocusOut(_e: FocusEvent) {
    // If focus moved outside active element, dismiss chip and strip
    hideSuggestionStrip();
    hideUndoChip();
  }

  function handlePointerDown(e: PointerEvent | MouseEvent) {
    const target = getEventTarget(e);
    // If clicking outside an active autocorrect chip or strip, dismiss chip
    if (target && target.closest('bilexi-chip')) {
      return;
    }
    hideUndoChip();
  }

  function handlePageHide() {
    hideUndoChip();
    hideSuggestionStrip();
  }

  win.addEventListener('compositionstart', onCompStart, true);
  win.addEventListener('compositionend', onCompEnd, true);
  win.addEventListener('focusin', handleFocusIn, true);
  win.addEventListener('focusout', handleFocusOut, true);
  win.addEventListener('pointerdown', handlePointerDown, true);
  win.addEventListener('pagehide', handlePageHide, true);
  win.addEventListener('popstate', handlePageHide, true);
  win.addEventListener('keydown', handleKeyDown, true);
  win.addEventListener('input', handleInput, true);

  return () => {
    unsubscribeSettings();
    win.removeEventListener('compositionstart', onCompStart, true);
    win.removeEventListener('compositionend', onCompEnd, true);
    win.removeEventListener('focusin', handleFocusIn, true);
    win.removeEventListener('focusout', handleFocusOut, true);
    win.removeEventListener('pointerdown', handlePointerDown, true);
    win.removeEventListener('pagehide', handlePageHide, true);
    win.removeEventListener('popstate', handlePageHide, true);
    win.removeEventListener('keydown', handleKeyDown, true);
    win.removeEventListener('input', handleInput, true);
    hideUndoChip();
    hideSuggestionStrip();
  };
}
