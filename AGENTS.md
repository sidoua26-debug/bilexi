# AGENTS.md - Bilexi (EN/FR)

## Overview & Role
Offline bilingual (English + French) autocorrect browser extension for Chrome & Edge (Manifest V3), built with WXT and pure TypeScript. Behaves like a mobile keyboard autocorrect: synchronous replacements on word boundaries, instant Backspace undo, accent restoration, zero external telemetry or network access.

## Essential Commands
- `pnpm install` : Install pinned dependencies.
- `pnpm typecheck` : Run `tsc --noEmit` across all modules.
- `pnpm lint` : Run ESLint (enforcing no DOM/chrome imports in `engine/`).
- `pnpm test` : Run unit tests via Vitest.
- `pnpm test:e2e` : Run extension E2E tests in Playwright Chromium.
- `pnpm build` : Build production extension bundles via WXT.
- `pnpm bench:engine` : Benchmark core engine (latency, precision, recall, memory).
- `pnpm bench:blackbox --ext <path>` : Black-box test extension in Playwright on golden scenarios.
- `/verify` : Run full verification pipeline (lint + typecheck + unit + build + e2e).

## Architecture Boundaries
1. `engine/`: Pure, deterministic TypeScript only.
   - ZERO DOM (`window`, `document`, `HTMLElement`, `Range`, `Selection`).
   - ZERO browser/extension API (`chrome.*`, `browser.*`).
   - ZERO network (`fetch`, `XMLHttpRequest`, `WebSocket`).
   - Zero WebAssembly, zero eval.
2. `entrypoints/content/`: In-page content scripts.
   - Delegated capture-phase window listeners only (`focusin`, `beforeinput`, `input`, `keydown`).
   - No document-wide `MutationObserver`; no per-element listener attachment.
   - Synchronous correction dispatch: no `await` between boundary detection and text replacement.
   - Safe DOM replacement via `document.execCommand('insertText')` with `setRangeText` + native input event fallback. Never assign `.value`, `.innerHTML`, or `.textContent`.
   - UI rendered strictly inside closed/isolated shadow root via WXT `createShadowRootUi`.
3. `entrypoints/popup/`: Extension popup UI.
   - Communicates solely via `chrome.storage.local` and `chrome.tabs.query({ active: true, currentWindow: true })` (using `activeTab`).
4. `scripts/`: Offline data pipeline and benchmark harnesses.

## The NEVER List
- NEVER make any network calls (no remote fetch, no telemetry, no CDN, no fonts, no cloud APIs).
- NEVER use `eval()`, `new Function()`, or WebAssembly (`wasm-unsafe-eval`).
- NEVER use `chrome.storage.sync` (all settings and stats remain strictly on device in `chrome.storage.local`).
- NEVER request unneeded permissions: only `storage` and `activeTab`. Content script only on `http://*/*` and `https://*/*`.
- NEVER touch ineligible fields:
  - `input[type="password"]`, `email`, `url`, `number`, `tel`, `date`.
  - Fields with `spellcheck="false"`.
  - Fields with sensitive `autocomplete` tokens (`username`, `current-password`, `new-password`, `one-time-code`, `cc-*`, `address-*`).
  - Code editors (`.monaco-editor`, `.cm-editor`, `.ace_editor`, `<pre>`, `<code>`).
  - Readonly, disabled, or `contenteditable="false"`.
  - Google Docs / Sheets / Slides and canvas-based surface editors.
- NEVER mutate typed text asynchronously on the critical typing path.
- NEVER commit, push, or mark tasks done without pasting real command execution output.

## Definition of Done (DoD)
1. Code compiles strictly under TypeScript strict mode with no `any` and no `@ts-ignore`.
2. Architecture boundary linter passes (zero DOM/chrome APIs in `engine/`).
3. Unit test suite passes at 100% with high coverage on normalization, tokenization, rules, and edit distance.
4. E2E tests pass across all 7 local fixtures in Chromium.
5. Zero network and zero eval confirmed by static bundle scan.
6. Real command outputs recorded and documented in `walkthrough.md`.

## Audit & Honest Evaluation Ground Rules (Prompt #2)
1. **Golden files are immutable**: Generate `e2e/golden/appendix-a.json` once, verbatim from `SPEC.md` Appendix A. You may add cases, never edit or remove them; a hash check in `/verify` fails otherwise. Failing cases are reported, never deleted.
2. **No tuning on the test set**: Split data into dev and held-out test by sentence id. Choose vocabulary, thresholds and rules on dev only. No word lists of test targets anywhere in build scripts.
3. **Seeded randomness**: All randomness is seeded (`mulberry32`); the seed is printed in every report.
4. **Honest measurement**: Every number states how it was measured: process, Node or browser, machine, runs, units. Treat implausible numbers (negative memory, 9 ms to load 14 MB) as measurement bugs and fix them.
5. **Truthful reporting**: The walkthrough must include 'Deviations from SPEC' and 'Not verified'. No success claim without pasted command output.

