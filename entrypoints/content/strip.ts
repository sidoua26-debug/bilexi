/**
 * Suggestion Strip (Phone-Style 3 Candidates): entrypoints/content/strip.ts
 * Implemented using WXT createShadowRootUi and @floating-ui/dom
 */

import { computePosition, offset, flip, shift } from '@floating-ui/dom';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';

let activeStripUi: ShadowRootContentScriptUi<any> | null = null;
let currentMountGeneration = 0;

export function isSuggestionStripVisible(): boolean {
  return activeStripUi !== null || document.querySelector('bilexi-strip') !== null;
}

export function hideSuggestionStrip(): void {
  currentMountGeneration++;
  if (activeStripUi) {
    try {
      activeStripUi.remove();
    } catch {
      // Ignore removal error if already disconnected
    }
    activeStripUi = null;
  }
  // Remove any orphan strip hosts if present in DOM
  const existingHosts = document.querySelectorAll('bilexi-strip');
  existingHosts.forEach((h) => {
    try { h.remove(); } catch {}
  });
}

export interface ShowStripOptions {
  ctx: ContentScriptContext;
  anchor: HTMLElement;
  caretRect?: DOMRect | null;
  rawToken: string;
  candidates: string[]; // up to 3 candidates
  onSelect: (selected: string) => void;
}

export function showSuggestionStrip(options: ShowStripOptions): void {
  hideSuggestionStrip();
  const generation = ++currentMountGeneration;

  const { ctx, anchor, caretRect, rawToken, candidates, onSelect } = options;
  if (!candidates || candidates.length === 0) return;

  // Virtual element for caret positioning if available, otherwise anchor
  const virtualElement = caretRect ? {
    getBoundingClientRect: () => caretRect,
  } : anchor;

  // Detect dark theme & platform modifier
  const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const modLabel = isMac ? '⌥' : 'Alt+';

  createShadowRootUi(ctx, {
    name: 'bilexi-strip',
    position: 'overlay',
    anchor: 'body',
    append: 'last',
    onMount(container) {
      if (generation !== currentMountGeneration) {
        return document.createElement('div');
      }

      const strip = document.createElement('div');
      strip.setAttribute('role', 'listbox');
      strip.setAttribute('aria-label', 'Autocorrect suggestions');
      strip.setAttribute('aria-live', 'off'); // Off by default to prevent screen-reader chatter
      strip.className = `autocorrect-strip-container ${isDark ? 'theme-dark' : 'theme-light'}`;

      const style = document.createElement('style');
      style.textContent = `
        .autocorrect-strip-container {
          position: absolute;
          z-index: 2147483647;
          display: inline-flex;
          align-items: stretch;
          background: #ffffff;
          color: #1e293b;
          border: 1px solid #cbd5e1;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
          border-radius: 8px;
          padding: 2px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.4;
          user-select: none;
          pointer-events: none;
          overflow: hidden;
        }

        .autocorrect-strip-container.theme-dark {
          background: #0f172a;
          color: #f8fafc;
          border-color: #334155;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
        }

        .strip-slot {
          padding: 6px 12px;
          border: none;
          background: none;
          color: inherit;
          font-size: 13px;
          cursor: pointer;
          pointer-events: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: background 100ms ease;
          border-radius: 6px;
          outline: none;
          white-space: nowrap;
        }

        .strip-slot:hover {
          background: rgba(0, 0, 0, 0.05);
        }

        .autocorrect-strip-container.theme-dark .strip-slot:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .strip-slot.slot-best {
          font-weight: 700;
          color: #0284c7;
        }

        .autocorrect-strip-container.theme-dark .strip-slot.slot-best {
          color: #38bdf8;
        }

        .strip-slot.slot-original {
          font-style: italic;
          opacity: 0.85;
        }

        .strip-separator {
          width: 1px;
          background: #e2e8f0;
          margin: 4px 0;
        }

        .autocorrect-strip-container.theme-dark .strip-separator {
          background: #334155;
        }

        .strip-kbd {
          font-size: 10px;
          opacity: 0.55;
          font-family: monospace;
          background: rgba(0,0,0,0.06);
          padding: 1px 4px;
          border-radius: 3px;
        }

        .autocorrect-strip-container.theme-dark .strip-kbd {
          background: rgba(255,255,255,0.1);
        }
      `;
      container.appendChild(style);

      // Build 3 slots:
      // Left = raw verbatim token (or first alternative)
      // Middle = best candidate (bold)
      // Right = next best candidate
      const slotItems: Array<{ text: string; isBest: boolean; isOriginal: boolean; index: number }> = [];

      const best = candidates[0]!;
      const second = candidates[1];

      // Left: raw token verbatim
      slotItems.push({ text: rawToken, isBest: false, isOriginal: true, index: 1 });
      // Middle: best candidate (bold)
      slotItems.push({ text: best, isBest: true, isOriginal: false, index: 2 });
      // Right: second candidate if available
      if (second && second.toLowerCase() !== best.toLowerCase() && second.toLowerCase() !== rawToken.toLowerCase()) {
        slotItems.push({ text: second, isBest: false, isOriginal: false, index: 3 });
      }

      slotItems.forEach((item, idx) => {
        if (idx > 0) {
          const sep = document.createElement('div');
          sep.className = 'strip-separator';
          strip.appendChild(sep);
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'option');
        btn.setAttribute('data-slot-index', String(item.index));
        btn.className = `strip-slot ${item.isBest ? 'slot-best' : ''} ${item.isOriginal ? 'slot-original' : ''}`;

        const textSpan = document.createElement('span');
        textSpan.textContent = item.text;
        btn.appendChild(textSpan);

        const kbdSpan = document.createElement('span');
        kbdSpan.className = 'strip-kbd';
        kbdSpan.textContent = `${modLabel}${item.index}`;
        btn.appendChild(kbdSpan);

        // Mousedown must call preventDefault so focus never leaves the field!
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          hideSuggestionStrip();
          onSelect(item.text);
        });

        strip.appendChild(btn);
      });

      container.appendChild(strip);

      computePosition(virtualElement as any, strip, {
        placement: 'top-start',
        middleware: [
          offset(6),
          flip({ fallbackPlacements: ['bottom-start'] }),
          shift({ padding: 8 }),
        ],
      }).then(({ x, y }) => {
        if (generation === currentMountGeneration) {
          strip.style.left = `${Math.round(x)}px`;
          strip.style.top = `${Math.round(y)}px`;
        }
      });

      return strip;
    },
    onRemove() {
      if (activeStripUi) {
        activeStripUi = null;
      }
    },
  })
    .then((ui) => {
      if (generation !== currentMountGeneration) {
        try { ui.remove(); } catch {}
        return;
      }
      activeStripUi = ui;
      ui.mount();
    })
    .catch((err) => {
      console.warn('[bilingual-autocorrect] Failed to create suggestion strip:', err);
    });
}
