ROLE
You are a senior browser-extension and NLP engineer. Build a production-grade, 100% offline, bilingual (English + French) autocorrect extension that behaves like a phone keyboard’s autocorrect, for Chrome and Edge (Manifest V3). Work in Plan mode. Prove every browser-behaviour claim with a running test, not from memory.
1. GOAL
Working name: bilingual-autocorrect. As the user types in any text field on any website, it fixes typos on word boundaries (space, punctuation, Enter), restores French accents, handles English contractions and French elisions, lets the user undo instantly with Backspace, and learns from rejections. Everything runs inside the browser. Chrome + Edge now; keep the code portable to Firefox later (do not build it now).
2. HARD CONSTRAINTS
1. Zero network: no fetch/XHR/WebSocket to remote hosts, no CDN, no telemetry, no remote fonts, no eval/new Function, no WebAssembly (pure TypeScript avoids wasm-unsafe-eval and WASM/CSP edge cases). Typed text is never logged or persisted.
2. Do no harm: a missed correction is cheap, a wrong correction is expensive. Defaults are conservative.
3. Synchronous correction path: no await between reading the text and replacing it (fast typists would otherwise get corrupted text).
4. Permissions: storage and activeTab only (activeTab lets the popup read the current site for the per-site switch without the tabs permission). Content script on http/https, all frames. No tabs, webRequest, scripting, unlimitedStorage, identity. Use chrome.storage.local only (about 10 MB quota); not storage.sync, which goes through the browser vendor’s sync service. Justify every permission in docs/STORE-LISTING.md.
5. Never touch: input types password, email, url, number, tel, date; fields with spellcheck=false; autocomplete tokens username, email, tel, one-time-code, new-password, current-password, name, address-, cc-; code editors (Monaco, CodeMirror, Ace), pre/code; readonly, disabled or contenteditable=false; Google Docs/Sheets/Slides and other canvas editors (detect and disable).
6. Publishable on Chrome Web Store and Edge Add-ons from day one: single purpose, no remote code, privacy policy, honest data disclosures.
3. HOW TO WORK
1. First actions: save this brief verbatim as docs/SPEC.md. Create AGENTS.md (max 6,000 chars: commands, architecture boundaries, never-list, definition of done); .agents/rules/ files (each max 12,000 chars: architecture, testing, privacy-and-store-policy); .agents/workflows/verify.md (/verify = lint + typecheck + unit + build + e2e); .agents/skills/extension-e2e/SKILL.md and .agents/skills/dictionary-build/SKILL.md.
2. Produce Task List + Implementation Plan artifacts and wait for my approval before M1.
3. Verify WXT, Playwright and Chrome API usage against current docs (Context7 MCP or web) instead of memory. Pin exact dependency versions that are at least 14 days old.
4. Test before claiming. Never mark a task done without pasted command output. If a test fails, fix the cause; never weaken the test. Say plainly what you could not verify.
5. Record every decision that has numbers in docs/DECISIONS.md (short ADRs).
6. Strict TypeScript, no any. The engine package has zero DOM and zero extension-API imports (lint-enforced).
4. ROADMAP (execute M0 now; M1–M2 after my approval)
• M0 Spike + plan (one session). Validate the stack. Benchmark 2–3 index structures on the real dictionaries (memory, cold load, p95 lookup). Prove the DOM editing approach in Chromium on 7 fixtures. Output the plan, then STOP.
• M1 Data pipeline, engine, unit tests, engine benchmark. Report numbers; continue to M2 if targets are met.
• M2 MVP: content-script autocorrect for input/textarea/contenteditable (+ iframes, open shadow DOM), Backspace undo, undo chip, popup (global switch, this-site switch, language mode, sensitivity), E2E suite, black-box benchmark harness. STOP with a walkthrough.
• M3 (later prompt): personal dictionary + learning, options page, text shortcuts, suggestion strip, rich-editor adapters (ProseMirror/Tiptap, Lexical, Quill, Slate), optional French typography.
• M4 (later): hardening, accessibility, UI localisation (en/fr), store assets, privacy policy, Chrome + Edge zips, release checklist. Design the interfaces and settings schema for M3/M4 now; do not build them.
5. STACK (decided; deviate only with measured evidence in DECISIONS.md)
• WXT 0.20.x (Vite, MV3, wxt zip, wxt submit, Chrome/Edge/Firefox builds). Not Plasmo (maintenance mode), not CRXJS (Vite-8 build breakage).
• TypeScript strict, pnpm, current Node LTS, Vitest, Playwright, ESLint, Prettier.
• Content script: vanilla TypeScript. In-page UI: WXT createShadowRootUi + @floating-ui/dom. Popup/options: React via @wxt-dev/module-react (or Preact), CSS variables, no UI kit.
• Engine: own TypeScript implementation of the SymSpell symmetric-delete index (Wolf Garbe’s algorithm, MIT) plus keyboard-aware weighted Damerau-Levenshtein rescoring. Spike baselines: mnemonist’s SymSpell (MIT); a trie with bounded edit distance if memory fails.
• Rejected, restate why in DECISIONS.md: spellchecker-wasm / Rust-WASM SymSpell (WASM CSP issues, English-centric, no custom costs); nspell/Hunspell at runtime (slow load, French suggestions too slow); LanguageTool (Java/server) and Harper (English only); Chrome Proofreader API (origin trial, Gemini Nano download, Chrome only); any cloud API.
• Build time only: nspell or Spylls as a Hunspell oracle. Never ship Hunspell.
6. REPOSITORY
AGENTS.md  wxt.config.ts  vitest.config.ts  playwright.config.ts
.agents/{rules,workflows,skills}/
docs/{SPEC,DECISIONS,TEST-PLAN,PRIVACY,STORE-LISTING,THIRD_PARTY_NOTICES}.md
engine/      pure TS: normalize, tokenize, keyboard, distance, index, language, rank, decide, rules-en, rules-fr, case (+ tests)
scripts/     build-data.ts, bench-engine.ts, bench-blackbox.ts
public/dict/ en.bin, fr.bin, manifest.json (counts, hashes, licences)
entrypoints/ background.ts, content/{index,focus,policy,trigger,read,replace,undo,chip,settings}.ts, popup/, options/
e2e/         fixtures/*.html, specs/*.spec.ts
7. ENGINE DESIGN (pure, deterministic, synchronous)
1. Normalise: NFC, lowercase for matching, keep the original for case restoration. fold(): NFD minus marks, œ→oe, æ→ae, ß→ss, ’→'.
2. Tokenise: word characters are letters, marks, digits plus inner ' ’ -. Hyphenated words are checked part by part. French elision prefixes (l' d' j' n' m' t' s' c' qu' jusqu' lorsqu' puisqu') are split off; only the remainder is corrected.
3. No-op rules: length under 3 (except the curated map), digits, _ @ # /, ://, internal capitals (iPhone), ALL CAPS up to 5 letters, Capitalised mid-sentence words (likely proper nouns) unless confidence is very high, personal dictionary, rejected list, and a curated allowlist of tech/brand/slang terms in both languages (npm, github, ios, lol, btw, slt, mdr, stp...).
4. A word is known if valid in ANY enabled language (protects bilingual typing). Known words are never corrected.
5. Candidates: delete index, max distance 2, prefix length 7, stored as typed arrays with hashed deletes verified by the true distance. Precomputed at build time; at runtime only typed-array views are created (no per-tab index building). French accent restoration: candidates whose fold() equals fold(typed) cost 0.2 (ecole→école, oeuvre→œuvre).
6. Score = log P(candidate) + language prior − edit costs. Costs: adjacent-key substitution 0.5 (adjacency generated from QWERTY and AZERTY row strings; layout setting auto/qwerty/azerty), transposition 0.6, insertion/deletion 1.0, other substitution 1.2, doubled/undoubled letter 0.6, accent-only 0.2, first-letter mismatch +1.0. Unknown typed forms get a frequency floor.
7. Autocorrect only if: typed word unknown in all enabled languages; distance ≤1 for 3–4 letters, ≤2 for 5+; margin over the runner-up ≥ τ; candidate frequency ≥ F_min. Modes Cautious / Balanced / Bold set τ and F_min. Otherwise do nothing.
8. Curated high-precision rules (data files, not code). EN: dont→don’t, doesnt, didnt, isnt, arent, wasnt, werent, hasnt, havent, hadnt, shouldnt, couldnt, wouldnt, im→I’m, ive→I’ve, youre, theyre, thats, whats; lone i→I. FR: jai→j’ai, cest→c’est, nest, sil→s’il, quil→qu’il, aujourdhui→aujourd’hui, lecole→l’école (split + accent).
9. Language: modes Auto / EN / FR / EN+FR. Auto = prior from the lang attribute (element, then document) and navigator.language, plus a rolling log-likelihood of the last ~8 words under EN vs FR unigram models; French-only characters are strong evidence. Candidates from both languages are weighted by the posterior; never translate. Do not use franc/CLD-style detectors (built for long text); short fragments need this two-class model.
10. Case: preserve lower / Capitalised / UPPER. Sentence-initial capitalisation and lone i→I are separate toggles (lone i→I on; sentence caps on for textarea/contenteditable, off for single-line inputs; skip after abbreviations such as e.g., i.e., etc., Mr., Dr., M., Mme).
11. API: createEngine(data, settings) → analyze({token, leftContext (≤8 words), boundary, fieldKind, layoutHint, langHint}) → {action: none|replace, replacement, original, confidence, alternatives (≤3), reason}.
8. DATA PIPELINE (scripts/build-data.ts → public/dict/*.bin)
• Sources (verify each licence and version; write THIRD_PARTY_NOTICES.md): English Hunspell dictionary-en (MIT AND BSD), union en-US + en-GB so both spellings are valid; French Hunspell dictionary-fr (MPL-2.0), all variants so 1990-reform spellings stay valid; Lexique 3.83 forms + frequencies (CC BY-SA); hermitdave FrequencyWords en/fr (CC-BY-SA-4.0); SymSpell en-82k list (MIT).
• Gotcha: Hunspell’s unmunch is reported to fail on the French .aff. Do not rely on it. Build the validity vocabulary as: Lexique forms ∪ corpus tokens that a Hunspell implementation (oracle) accepts ∪ curated allowlist.
• Two structures per language: (a) validity set of all known forms (Bloom filter or compact trie; zero false negatives); (b) candidate vocabulary of the top ~60–80k forms with the delete index and quantised log-frequencies.
• Clean frequency data first: lowercase, dedupe, drop tokens the oracle rejects below a frequency threshold (subtitle corpora contain names and typos).
• Budget: both languages ≤ 15 MB unpacked. Loaded with fetch(chrome.runtime.getURL(...)) into typed-array views; files declared in web_accessible_resources with use_dynamic_url: true (Chrome 130+, reduces extension fingerprinting).
• Share-alike data (CC BY-SA): keep data files separate, attribute them in About and NOTICES, publish the builder. If that is a problem, say so in DECISIONS.md and propose permissive alternatives.
9. CONTENT-SCRIPT LOGIC (where most attempts fail)
1. Injection: http/https, all_frames, match_about_blank, document_idle. Delegated capture-phase listeners on window (focusin, beforeinput, input, keydown, compositionstart/end, selectionchange); resolve targets with event.composedPath()[0] so open shadow DOM works. No per-element listeners; no document-wide MutationObserver.
2. Lazy engine: initialise on the first focus in an eligible field (idle callback). Until ready, do nothing; never queue.
3. Trigger: after the browser inserts a boundary character (input event, inputType insertText, data is a space, NBSP, a quotation mark, or one of . , ; ! ? ) ] } » …), read the token before it. Colon and slash are not boundaries. Enter / Shift+Enter: a capture-phase keydown runs the correction first, then the event continues (chat apps and forms submit on keydown). Skip: isComposing and dead-key composition, paste/drop, undo/redo input types, non-collapsed selection, caret not at the end of the token.
4. Read: input/textarea via value + selectionStart; contenteditable via a Range walking text nodes inside the nearest block (a word can span inline nodes).
5. Replace (critical): select [word + boundary], then document.execCommand('insertText', false, replacement + boundary). It is one atomic, undoable edit and fires native beforeinput/input, so React, Draft.js, Lexical, ProseMirror, Slate and Quill update their models and Ctrl+Z works. Assert the caret ends after the boundary. Fallback if execCommand fails on an input: setRangeText + dispatch InputEvent('input', {inputType:'insertReplacementText'}) using the native value setter (React). Never assign .value, .innerHTML or .textContent.
6. Undo: keep lastCorrection {element, start, original, corrected, boundary, version}. Backspace (capture phase) right after a correction, field unchanged, caret at the end: preventDefault, restore the original word and remove the boundary (the state before the boundary was typed), and mark the token rejected so retyping the boundary does not re-correct it; a second rejection adds it to the ignore list. The chip’s Undo does the same. Any other key, click or selection change clears the undo state.
7. Lifecycle: use the WXT content-script context; remove listeners on invalidation (extension reload/update); idempotent init; every browser API call in try/catch; one namespaced console prefix; any failure degrades to ‘do nothing’ and never breaks the page. Settings update live via storage.onChanged.
8. Out of scope v1: Google Docs/Sheets/Slides, canvas editors, IME languages, mobile browsers, grammar, LLMs, cloud sync, analytics.
10. UX AND VISUAL DESIGN
• Principle: invisible when right, instantly reversible when wrong.
• Undo chip: small pill near the field (below-left; caret-anchored in M3) reading ‘teh → the · Undo’. 12–13 px system font, follows light/dark via prefers-color-scheme, 120 ms fade (respect reduced motion), auto-hides after 2.5 s, never takes focus, only the Undo button is clickable. Shadow DOM, maximum z-index. Optional aria-live announcement (off by default).
• Popup (320 px): master switch; ‘This site’ switch; language control (Auto · EN · FR · EN+FR); sensitivity (Cautious · Balanced · Bold); status line ‘Engine ready · EN+FR’ or an explicit error state; links to Options and Privacy.
• Options (M3) tabs: General · Languages and keyboard (QWERTY/AZERTY, US/GB) · My words · Shortcuts · Sites · About and licences.
• Style: system font stack, CSS variables, WCAG AA, fully keyboard-operable. UI strings through _locales (en, fr). Placeholder SVG icon → PNG 16/32/48/128 by script.
• Settings schema (typed, versioned, with migrations): {version, enabled, languageMode, sensitivity, layout, enVariant, sentenceCaps, fixLoneI, disabledOrigins[], personalWords[], rejected[], shortcuts[], stats{corrections, reverts}}. Stats are counters only.
11. VERIFICATION
• Unit (Vitest): tokenizer, fold, elision, case, keyboard costs, index vs brute-force oracle (property tests), decision thresholds, language detection, rules.
• Engine benchmark (pnpm bench:engine): seeded synthetic noise on clean sentences (Tatoeba and public-domain Gutenberg, EN + FR; verify licences): adjacent-key substitutions, transpositions, omissions, duplications, accent drops; reject injected typos that form valid words. Report applied-correction precision, recall by edit distance, false-positive rate on clean text, p50/p95 latency, memory, cold load. Targets (report actuals, never overfit to the golden set): false positives ≤ 0.3% of clean tokens; applied-correction precision ≥ 97%; recall on non-word distance-1 typos ≥ 80%; p95 lookup ≤ 3 ms; cold init EN+FR ≤ 400 ms; ≤ 60 MB per tab.
• E2E (Playwright with its bundled Chromium: chromium.launchPersistentContext, channel chromium, --disable-extensions-except and --load-extension; branded Chrome/Edge ignore side-loading flags). Local fixtures: input, textarea, contenteditable, plaintext-only, React-controlled input, iframe, open shadow DOM (M3: ProseMirror/Tiptap, Quill, Lexical, Slate). Assert with real keystrokes (keyboard.type, delays 0–30 ms): final text, caret position, Backspace undo, Ctrl+Z, no lost or reordered characters under rapid typing, ineligible fields untouched, global and per-site switches, still works after the page loads and the context goes offline (context.setOffline(true)), zero non-local requests, engine-ready signal, popup renders.
• Static checks: built bundle has no remote URLs or eval; manifest permission snapshot; size budget.
• Black-box benchmark: pnpm bench:blackbox --ext <path-to-any-unpacked-MV3-extension> loads it in Playwright Chromium, types the Appendix A scenarios into a textarea and a contenteditable, and prints a Markdown scorecard (pass/fail per case, per category, latency). I will run it on this build and on my previous extension.
• docs/TEST-PLAN.md: manual checklist for real Chrome and Edge stable (Load unpacked): Gmail compose, Outlook web, WhatsApp Web, Slack, X, LinkedIn, Reddit, GitHub comments, Notion. Mark each verified or not verified, honestly.
12. PRIVACY AND STORE POLICY (build in now, finalise in M4)
• Single purpose: ‘Autocorrect typos in English and French as you type, entirely on your device.’
• Content scripts on all sites count as broad host access and make Chrome review slower: write the permission justification now (needed to correct text in any field the user types in; processed locally; never transmitted).
• docs/PRIVACY.md in EN and FR: no collection, no transmission, local storage only, plus the Chrome Web Store Limited Use statement. Disclosures must match the code.
• No remote code. The WXT dev server is dev-only; audit the production build.
• Edge accepts the same zip; the first submission is manual in Partner Center, later ones can use wxt submit.
13. REPORTING
At M0, M1 and M2 deliver a Walkthrough artifact: what changed, pasted command output, benchmark table, E2E results, known limitations, exact steps to load unpacked in Chrome and Edge, and a ‘not verified’ list. Never claim a feature without a passing test.
APPENDIX A. GOLDEN SCENARIOS (also the black-box benchmark input)
• Fix (typed → expected, each followed by a space). EN: teh→the, recieve→receive, definately→definitely, seperate→separate, occured→occurred, wierd→weird, thier→their, becuase→because, untill→until, freind→friend, beleive→believe, adress→address, accomodate→accommodate, goverment→government, tommorow→tomorrow (distance 2), tje→the, Teh→The.
• EN rules: dont→don’t, doesnt→doesn’t, im→I’m, ive→I’ve, thats→that’s, i→I.
• FR: ecole→école, tres→très, deja→déjà, apres→après, etudiant→étudiant, francais→français, developpement→développement, necessaire→nécessaire, oeuvre→œuvre, coeur→cœur, bonjuor→bonjour, beaucuop→beaucoup, cest→c’est, jai→j’ai, aujourdhui→aujourd’hui, lecole→l’école, quil→qu’il, sil→s’il.
• Mixed: ‘I went to l'ecole hier’ → ‘I went to l'école hier’.
• Must stay unchanged: iPhone, NASA, GitHub, npm, lol, mdr, slt, stp, https://exmaple.com/teh, john@exmaple.com, #teh, @teh, 3rd, co-operate, colour, color, c’est, l’école, peut-être, aujourd’hui, fatigue, Paris, Québec, SNCF; words valid in either language (pain, on, a, ou).
• Behaviour: ‘teh ’ becomes ‘the ’ with the caret after the space; Backspace then gives ‘teh’ and typing the space again does not re-correct; Ctrl+Z undoes natively; Enter in a chat-style input corrects before submit; 20 words typed at 0 ms delay lose no characters.
• Ineligible (must stay untouched): password field, email field, spellcheck=false field, pre/Monaco, docs.google.com.
