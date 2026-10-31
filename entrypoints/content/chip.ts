/**
 * Floating Undo Chip: entrypoints/content/chip.ts
 * Implemented using WXT createShadowRootUi and @floating-ui/dom
 */

import { computePosition, offset, flip, shift } from '@floating-ui/dom';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { ShadowRootContentScriptUi } from 'wxt/utils/content-script-ui/shadow-root';
import { isSuggestionStripVisible } from './strip';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let activeUi: ShadowRootContentScriptUi<any> | null = null;
let dismissTimeout: ReturnType<typeof setTimeout> | null = null;
let currentMountGeneration = 0;

export function hideUndoChip(): void {
  currentMountGeneration++;
  if (dismissTimeout) {
    clearTimeout(dismissTimeout);
    dismissTimeout = null;
  }
  if (activeUi) {
    try {
      activeUi.remove();
    } catch {
      // Ignore removal error if already disconnected
    }
    activeUi = null;
  }
  // Remove any orphan chip hosts if present in DOM
  const existingHosts = document.querySelectorAll('bilexi-chip');
  existingHosts.forEach((h) => {
    try { h.remove(); } catch {}
  });
}

export interface ShowUndoChipOptions {
  ctx: ContentScriptContext;
  anchor: HTMLElement;
  original: string;
  corrected: string;
  onUndo: () => void;
}

export function showUndoChip(options: ShowUndoChipOptions): void {
  hideUndoChip();
  if (isSuggestionStripVisible()) {
    return;
  }

  const generation = ++currentMountGeneration;
  const { ctx, anchor, original, corrected, onUndo } = options;

  createShadowRootUi(ctx, {
    name: 'bilexi-chip',
    position: 'overlay',
    anchor: 'body',
    append: 'last',
    onMount(container) {
      const chip = document.createElement('div');
      chip.setAttribute('role', 'status');
      chip.setAttribute('aria-live', 'off'); // Off by default to avoid screen-reader chatter
      chip.className = 'autocorrect-chip-container';

      const style = document.createElement('style');
      style.textContent = `
        .autocorrect-chip-container {
          position: absolute;
          z-index: 2147483647;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background-color: #1e293b;
          color: #f8fafc;
          border: 1px solid #334155;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
          border-radius: 6px;
          padding: 3px 8px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          user-select: none;
          opacity: 1;
          transition: opacity 120ms ease-out, transform 120ms ease-out;
          transform: translateY(0);
          pointer-events: auto;
        }

        .autocorrect-chip-container.fading {
          opacity: 0;
          transform: translateY(2px);
        }

        .autocorrect-chip-label {
          color: #e2e8f0;
          font-size: 11px;
        }

        .autocorrect-chip-btn {
          background: none;
          border: none;
          padding: 0;
          color: #38bdf8;
          font-weight: 600;
          cursor: pointer;
          font-size: 11px;
          text-decoration: underline;
          text-underline-offset: 2px;
          outline: none;
        }

        .autocorrect-chip-btn:hover {
          color: #7dd3fc;
        }

        .autocorrect-chip-btn:focus-visible {
          outline: 2px solid #38bdf8;
          border-radius: 2px;
        }
      `;
      container.appendChild(style);

      const label = document.createElement('span');
      label.className = 'autocorrect-chip-label';
      label.textContent = `${original} -> ${corrected} · `;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'autocorrect-chip-btn';
      btn.setAttribute('aria-label', `Undo autocorrect to "${original}"`);
      btn.textContent = 'Undo';

      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideUndoChip();
        onUndo();
      });

      chip.appendChild(label);
      chip.appendChild(btn);
      container.appendChild(chip);

      computePosition(anchor, chip, {
        placement: 'top-start',
        middleware: [
          offset(4),
          flip(),
          shift({ padding: 8 }),
        ],
      }).then(({ x, y }) => {
        if (generation === currentMountGeneration) {
          chip.style.left = `${Math.round(x)}px`;
          chip.style.top = `${Math.round(y)}px`;
        }
      });

      dismissTimeout = setTimeout(() => {
        if (generation === currentMountGeneration) {
          chip.classList.add('fading');
          setTimeout(() => {
            if (generation === currentMountGeneration) {
              hideUndoChip();
            }
          }, 120);
        }
      }, 2500);

      return chip;
    },
    onRemove() {
      if (dismissTimeout) {
        clearTimeout(dismissTimeout);
        dismissTimeout = null;
      }
      activeUi = null;
    },
  })
    .then((ui) => {
      if (generation !== currentMountGeneration) {
        try { ui.remove(); } catch {}
        return;
      }
      activeUi = ui;
      ui.mount();
    })
    .catch((err) => {
      console.warn('[bilingual-autocorrect] Failed to create undo chip:', err);
    });
}
