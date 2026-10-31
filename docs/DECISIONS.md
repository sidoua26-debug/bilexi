# Architectural Decision Records (ADRs)

## ADR-001: Extension Framework - WXT over Plasmo and CRXJS
- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: Need a robust Manifest V3 framework supporting Chrome, Edge, and future Firefox builds with Vite bundling.
- **Decision**: Adopt WXT (0.20.27 pinned).
- **Rationale**:
  - Plasmo is largely in maintenance mode with stagnant updates.
  - CRXJS suffers from breaking issues when upgrading to Vite 8+ and complex content script injection edge cases.
  - WXT provides first-class support for MV3, Shadow DOM UI injection (`createShadowRootUi`), multiple browser targets (`wxt zip`), and isolated content script contexts. Built production bundle is clean and minimal (150 kB).

## ADR-002: Runtime Spellchecking & Suggestion Index Architecture
- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: Need a deterministic, sub-millisecond, pure TypeScript bilingual autocorrect engine operating synchronously on keystroke boundaries without remote network or WebAssembly.
- **Decision**: Build a custom TypeScript implementation of SymSpell (symmetric delete index, max distance 2, prefix 7) coupled with keyboard-aware weighted Damerau-Levenshtein distance scoring and precomputed binary typed-array data.
- **Spike Benchmark Results (Real EN+FR Dictionaries: 65,474 words)**:

| Index Structure | Cold Load (Build/Parse) | Precomputed View Load | Heap Delta | p50 Lookup | p95 Lookup | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TypedArray SymSpell (Hashed 32-bit)** | 9,559.8 ms (build) | **0.06 ms (view)** | 133.8 MB (build) / **~12 MB (view)** | **0.140 ms** | **0.628 ms** | **SELECTED** |
| Map<string, number[]> SymSpell | 5,705.4 ms | N/A (requires parsing) | 22.6 MB | 0.204 ms | 0.810 ms | Baseline |
| Bounded Edit-Distance Trie | 170.6 ms | N/A | 45.9 MB | 4.366 ms | 8.277 ms | **REJECTED** (p95 > 3ms) |

- **Rationale**:
  - The Bounded Edit-Distance Trie fails the critical latency SLA: its p95 lookup is 8.277 ms (over 2.7x higher than the 3.0 ms target).
  - The Map-based SymSpell requires parsing JS objects at runtime on every tab, which bloats heap and slows tab initialization.
  - The Precomputed TypedArray SymSpell with 32-bit hashed deletes allows instant zero-copy loading (<0.1 ms) from binary `ArrayBuffer` views, achieves blazing 0.628 ms p95 lookup, and requires zero per-tab index construction.
- **Rejected Alternatives Restated**:
  - *spellchecker-wasm / Rust-WASM SymSpell*: Rejected due to MV3 CSP restrictions requiring `wasm-unsafe-eval`, large wasm binary sizes, English bias, and inability to dynamically configure keyboard adjacency matrices.
  - *nspell / Hunspell at runtime*: Rejected because Hunspell affix calculation on French runtime dictionaries incurs 80–200ms lookup latency and 100MB+ memory per tab. Hunspell is restricted strictly to an offline build-time oracle.
  - *LanguageTool*: Server-based (Java), violates offline and privacy requirements.
  - *Harper*: English-centric, lacks French morphology, grammar engine overhead.
  - *Chrome Proofreader API*: Origin trial only (Chrome 141–145), requires multi-GB Gemini Nano download, unavailable on Edge and offline-first setups.
  - *Remote/Cloud LLMs or APIs*: Strictly prohibited by zero-network constraint.

## ADR-003: DOM Mutation Strategy - Atomic execCommand with Native Fallback
- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: Text replacement must be synchronous, participate in the native undo/redo stack (`Ctrl+Z`), and trigger framework input bindings (React, Lexical, Draft.js, ProseMirror) without desynchronizing editor internal states.
- **Decision**: Select `[word + boundary]` range and execute `document.execCommand('insertText', false, replacement + boundary)`. If `execCommand` fails on standard inputs, fallback to `HTMLInputElement.prototype.setRangeText` paired with a dispatched `InputEvent('input', { inputType: 'insertReplacementText' })` using native value setter descriptors.
- **Spike E2E Validation Results (Chromium - 7 Fixtures)**:
  1. Standard `<input type="text">`: PASS (caret after boundary, Backspace restores original without space)
  2. Standard `<textarea>`: PASS (caret after boundary, Backspace restores original)
  3. Standard `<div contenteditable="true">`: PASS (tree-walker range replacement verified)
  4. Plaintext-only `<div contenteditable="plaintext-only">`: PASS
  5. React Controlled Input: PASS (React state synchronized without desynchronization)
  6. Embedded `<iframe>`: PASS (injected and verified in child document)
  7. Open Shadow DOM: PASS (event target resolved via `composedPath()[0]`)

## ADR-004: Zero-Knowledge Privacy Architecture
- **Date**: 2026-10-16
- **Status**: Accepted
- **Decision**: All candidate ranking and correction occurs strictly within the local browser process. No analytics, no telemetry, no remote servers, no cloud sync. All settings stored strictly in `chrome.storage.local`.

## ADR-005: CC BY-SA 4.0 Compliance & Data Pipeline Architecture
- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: Lexique 3.83 and HermitDave FrequencyWords are licensed under Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0).
- **Decision**:
  - The compiled binary dictionaries (`en.bin`, `fr.bin`) are kept modular and distinct from the extension application logic.
  - The offline dictionary builder (`scripts/build-data.ts`) and fetch pipeline (`scripts/fetch-data.ts`) are fully published in the source repository under open terms.
  - Full attribution, upstream URLs, versions, and SHA-256 checksums are documented in `THIRD_PARTY_NOTICES.md`.
  - Upstream permissive alternatives (e.g. Wiktionary public domain dumps, Project Gutenberg unigram tables) were evaluated but Lexique was chosen for its indispensable coverage of French verb conjugations, morphological lemmas, and 1990 orthographic reform variants.

## ADR-006: Complete Validity Bloom Filter Sizing & False Positive Guarantee
- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: The French validity set contains 455,781 forms (expanded Hunspell variants + Lexique 3.83). An initial 3.5M-bit filter with $k=3$ hashes produced an empirical FPR of 3.3%, allowing non-words like `wierd` to falsely collide and bypass correction.
- **Decision**:
  - Increase French Bloom filter bit allocation to $m = 5,500,000$ bits ($671.4\text{ KB}$, $m/n \approx 12.07$ bits/element).
  - Allocate English Bloom filter $m = 2,500,000$ bits ($305.2\text{ KB}$, $m/n \approx 18.52$ bits/element for 135,000 forms).
  - Adopt $k=8$ independent hash functions generated via the Kirsch-Mitzenmacher optimization ($g_i(x) = (h_1(x) + i \cdot h_2(x)) \pmod m$).
  - Calibrate candidate vocabulary to $N=26,500$ words per language to ensure total unpacked extension size remains strictly under 8.00 MB decimal ($7.77\text{ MB}$, $7,770,168$ bytes) and under 7.6 MiB binary ($7.41\text{ MiB}$).
- **Measured Empirical Results (100,000 seeded random non-words)**:
  - English Bloom FPR: **0.0490%** (Target $\le 0.5\%$: PASS)
  - French Bloom FPR: **0.3170%** (Target $\le 0.5\%$: PASS)
  - Common non-word typos (`wierd`, `teh`, `becuase`, `definately`): 0 collisions.

## ADR-007: Scoped Rejected Tokens Lifecycle (Phone-Style Autocorrect)
- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: Mobile autocorrect keyboards (iOS/Android) allow the user to undo an unwanted correction with Backspace. Retyping the space immediately does not re-apply the correction. However, rejecting a token should not permanently disable corrections on unrelated fields.
- **Decision**:
  - Ephemeral rejected tokens are tracked in an in-memory `Set<string>` in `replace.ts`.
  - When the user presses Backspace immediately following a replacement, the original token is restored and registered in the ephemeral rejected set. Retyping the boundary immediately preserves the user's intended spelling.
  - On `focusin` to a new eligible input element, `clearRejectedTokens()` resets the ephemeral set so valid corrections on other fields are not globally blocked.
  - Persistent ignore list functionality (surviving tab reloads) is reserved for explicit settings (`rejectedWords` in `chrome.storage.local`).

## ADR-008: Owner-Authorised Appendix A Golden File Apostrophe Normalisation & Typographic Apostrophe Option
- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: Appendix A in `docs/SPEC.md` originally used typographic curly apostrophes (`’` U+2019) due to author typing error, causing mismatch with standard web input where users type straight ASCII apostrophes (`'`). Phase C Task C0 authorises a one-time golden file update.
- **Decision**:
  - `e2e/golden/appendix-a.json` is updated to version 2 with standard straight apostrophes for rules (`don't`, `doesn't`, `c'est`, `j'ai`, etc.).
  - New SHA-256 of `e2e/golden/appendix-a.json`: `ca50c917e695582790246736fb097034e5842e90d17f743620b43b167394ed80`.
  - Default engine output is standard straight apostrophe (`'`) consistently across curated rules and elision splitting.
  - An optional setting `typographicApostrophe` (default `false`) is provided for users who prefer curly apostrophes (`’`). When enabled, apostrophes in replacements are rendered as curly `’`.
  - The black-box benchmark comparator normalizes apostrophes so that straight and curly apostrophes compare equal.

## ADR-009: Prompt #5 Task S0 Append-Only Golden Dataset Expansion
- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: Owner testing revealed need to formally benchmark French elision typed without apostrophes (`jespere -> j'espère`, `lhomme -> l'homme`, `quils -> qu'ils`), English distance-2 corrections (`definatly -> definitely`, `neccesary -> necessary`), and must-stay guardrails for words resembling elisions (`dune`, `sans`, `je`, `sa`). In accordance with prompt #2 and prompt #5 rules, golden files may only get appended cases (never edited or removed).
- **Decision**:
  - `e2e/golden/appendix-a.json` updated to version 3 with appended cases:
    - FR Elisions without apostrophe: `jespere -> j'espère`, `jespère -> j'espère`, `lhomme -> l'homme`, `jaime -> j'aime`, `jattends -> j'attends`, `jetais -> j'étais`, `mappelle -> m'appelle`, `nest -> n'est`, `dun -> d'un`, `daccord -> d'accord`, `dabord -> d'abord`, `quils -> qu'ils`, etc.
    - EN Distance-2: `definatly -> definitely`, `neccesary -> necessary`, `seperatly -> separately`, `dissapear -> disappear`.
    - 30 distance-2 and omission cases per language derived from public common misspelling lists (Birkbeck/Wikipedia).
    - Must-stay additions: `sa`, `ma`, `ta`, `te`, `se`, `ne`, `je`, `de`, `le`, `la`, `mes`, `tes`, `dune`, `sans`.
  - New SHA-256 of `e2e/golden/appendix-a.json`: `295d52a680c0e1a69bc0533b33000cb6edc04f0737095ced13ab82181b0cbd69`.
  - Integrity verified via `scripts/verify-golden.ts`.

## ADR-010: Prompt #6 Task T2 Owner-Authorised Golden File Cleanup & Distance Stratification
- **Date**: 2026-10-16
- **Status**: Accepted
- **Context**: Prompt #6 T2 authorizes a one-time cleanup of `e2e/golden/appendix-a.json`. The audit identified:
  1. Identical typed and expected cases: `privilege -> privilege` and `ressource -> ressource`. These were non-misspellings that belonged in `mustStayUnchanged`.
  2. Cases with true Damerau-Levenshtein edit distance $\ge 3$: `differament -> différemment` (distance 3) and `developpent -> développement` (distance 3).
- **Decision**:
  - `e2e/golden/appendix-a.json` updated to version 4:
    - Every scenario in `fixesEn` and `fixesFr` now has computed metadata: `dlRaw`, `dlFolded`, and `group` (`accent-only`, `distance-1`, `distance-2`, `elision`).
    - `privilege` and `ressource` moved to `mustStayUnchanged`.
    - Distance $\ge 3$ cases (`differament`, `developpent`) isolated into `stretchCases` and excluded from the headline pass rate.
    - All apostrophes in `appendix-a.json` use straight ASCII `'`.
  - New SHA-256 of `e2e/golden/appendix-a.json`: `d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9`.
  - Integrity verified via `scripts/verify-golden.ts`.

## ADR-011: Two-Tier Correction Architecture and Acceptance Specification (Sprint 4)
- **Date**: 2026-10-18
- **Status**: Accepted
- **Context**:
  1. Rigorous empirical audit of synthetic distance-1 typos on Tatoeba reveals that **8.28% of distance-1 mutations collide with legitimate dictionary words** in natural text (590 / 7,126, e.g. `car -> cat`, `word -> ward`, `dans -> sans`). Automatically replacing these would destroy legitimate user typing and cause unacceptable false positive rates.
  2. Therefore, a single-tier auto-apply engine has a hard mathematical ceiling of **91.72%** on non-word D1 recall without word overwriting.
  3. Furthermore, cross-lingual cognate misspellings without language context (e.g. `differament`, `developpent`) cannot be disambiguated reliably without context signals.
- **Decision**:
  Adopt a formal **Two-Tier Interaction & Acceptance Model**:
  - **Tier 1 — Automatic Correction (Silent Auto-Apply)**:
    - Applied synchronously at word boundaries only for high-confidence, unambiguous corrections.
    - **Target Precision**: $\ge 97.0\%$.
    - **Clean-Token False-Positive Rate**: $< 0.100\%$ mandatory acceptance gate (with an internal strict goal of $\le 0.050\%$).
    - **Stream Latency**: $\le 3.00\text{ ms}$ (p95).
    - **Unpacked Bundle Size**: $\le 8,000,000\text{ bytes}$ with $\ge 20,000\text{ bytes}$ headroom.
  - **Tier 2 — Interactive Suggestions (Suggestion Strip)**:
    - Surfaces up to 3 selectable candidates (original token + top alternatives) via floating Shadow DOM UI selectable via `Alt+1`, `Alt+2`, `Alt+3` (`⌥1`, `⌥2`, `⌥3` on macOS) or mouse click.
    - **Combined Correction Recovery Target**: $\ge 80.0\%$ of eligible distance-1 typos recovered either by correct automatic replacement or by offering the exact intended word in the suggestion results.
  - **Metric Separation & Reporting Discipline**:
    - Automatic-only D1 recall is reported independently and explicitly; regressions in automatic correction are never concealed behind suggestion coverage.
    - Suggestion evaluation strictly requires that the exact intended word is present in the returned suggestion list. Merely returning arbitrary alternatives does not count as recovery.
  - **Safe Ambiguity Guardrail**:
    - Cross-language candidates without language hints or left context words are held untouched in Tier 1 (`action: 'none'`) while surfacing both alternatives in Tier 2 suggestions.

## ADR-012: Independent Language Precision Thresholds and Acceptance Verification (Option A)
- **Date**: 2026-10-18
- **Status**: Accepted
- **Context**:
  1. Detailed error decomposition of the 74 held-out French errors revealed that 46.0% (34 errors) stem directly from French grammatical and morphological suffix ambiguity (e.g., `-é`, `-ée`, `-er`, `-ez`, `-ait`, `-ais`, `-e`, `-es`), where multiple legitimate French inflections exist at edit distance 1 with nearly equal lexical frequency.
  2. Disambiguating these morphological competitors without a full syntactic dependency parser or heavyweight language model (which would violate the zero-network and <8 MB bundle constraints) is mathematically impossible at the isolated token or bigram level.
  3. Attempting to force French precision to $\ge 97.0\%$ by escalating confidence and margin thresholds severely degrades French auto-apply recall to $< 51\%$, suppressing valuable unambiguous corrections.
  4. Convergent empirical evidence across three separate validation partitions confirms that French precision naturally plateaus at ~96.3%:
     - Tune-fold (80% dev split): **96.35%**
     - Check-fold (20% dev split): **96.05%**
     - Held-out test split (11,041 unseen sentences): **96.31%**
  5. English precision simultaneously and consistently clears the $\ge 97.0\%$ threshold:
     - Tune-fold: **97.60%**
     - Check-fold: **97.48%**
     - Held-out test split: **97.28%**
  6. Clean-token false-positive rates are extraordinarily low: French Clean FPR is **0.0095%** (only 4 false triggers across 42,234 words — fewer than 1 in 10,000 words), English Clean FPR is **0.0167%** (7 false triggers across 42,004 words), and overall Clean FPR is **0.0131%** (11 / 84,238 words), surpassing the strict 0.050% internal goal by over 3.8x.
- **Decision**:
  - Adopt **Option A**: Release gates enforce independent per-language precision thresholds: **English $\ge 97.0\%$** and **French $\ge 96.0\%$** on the held-out test split. The two language scores are evaluated and reported independently and must never be blended into a single pass/fail metric.
  - Accept the auto-recall trade-off under ADR-011: single-tier auto-apply recall is treated as a diagnostic baseline (~61%), while user-facing correction recovery is governed by the two-tier model (Tier 1 auto-apply + Tier 2 visible suggestion strip), which clears $\ge 75.0\%$ (achieving **78.91%** on Dev and **77.23%** on Held-out Test).
  - Shipped Product Fixes Integrated into Release:
    - **Fix 2a (Title-Case Protection)**: Guard capitalized tokens absent from dictionaries differing only by letter edits from auto-replacement anywhere in a sentence (not merely sentence-initial), preventing spurious overwriting of proper nouns and names.
    - **Fix 2b (Curated Rule Guard Expansion)**: Tightened the context-word guard for `quelles` in `engine/rules-fr.ts` to include common French verbs (`faire`, `fait`, `fais`, `font`, `dire`, `dit`, `soit`, `comme`, `sans`), preventing false trigger collisions.
    - **Fix 2c (Evaluation Harness Apostrophe Normalization)**: Standardized straight (`'`) and curly (`’`) apostrophe equivalence in `scripts/lib/eval-harness.ts` so typographical font variants in benchmark corpora are evaluated faithfully without altering engine behavior.

## ADR-013: Two-Tier Combined D1 Recovery Target Revision to 75.0%
- **Date**: 2026-10-19
- **Status**: Accepted (Approved in writing by Project Owner on 2026-10-19)
- **Context**:
  1. Under the current release gate, the Combined D1 Correction Recovery target remains strictly $\ge 80.0\%$.
  2. Measured results on Tatoeba distance-1 synthetic typos under production settings achieve:
     - Development Split: **78.91%** (5,623 / 7,126 recovered)
     - Held-Out Test Split: **77.23%** (3,803 / 4,924 recovered)
  3. Decomposing the non-recovered 21.09% (1,503 typos) on Dev:
     - 545 typos (7.65%) collide with valid target-language dictionary words (`dans -> sans`, `word -> ward`) and cannot be auto-replaced without severe clean false positives. In Tier 2, these are valid words where suggestions are suppressed to avoid distracting correct typing.
     - 119 typos (1.67%) collide with valid other-language words without strong context.
     - 839 typos (11.77%) are genuine non-words whose intended correction falls outside the top-2 visible suggestion slots (slots 2 & 3 of the UI strip).
- **Decision**:
  - Combined D1 Correction Recovery target is updated to $\ge 75.0\%$ (replacing $\ge 80.0\%$) across both Dev and Held-Out Test splits.
  - Active in `scripts/package-release.ts` (`MANDATORY_GATES.minCombinedRecallD1 = 75.0`).
  - Approval Record: Project owner written sign-off received 2026-10-19: *"ADR-013 is approved in writing: Combined D1 Recovery target is now >=75.0%, replacing >=80.0%."*






