# Chrome Web Store Listing & Asset Catalog

This document specifies the complete store listing copy, visual asset catalog, permissions justifications, and privacy disclosures for Chrome Web Store submission of **Bilexi**.

---

## 1. Store Listing Metadata

- **Extension Name**: `Bilexi - Offline Bilingual Autocorrect (EN/FR)`
- **Short Name**: `Bilexi`
- **Version**: `0.5.0`
- **Primary Category**: `Productivity / Workflow`
- **Supported Languages**: `English (United States)`, `French`
- **Pricing**: `Free / Open Source`

### Short Summary (132 characters max)
> Instant offline bilingual autocorrect for English and French. Fixes typos, apostrophes, and accents seamlessly as you type.

### Detailed Description
```markdown
Bilexi brings the effortless typing experience of modern smartphone keyboards to your desktop browser text fields — 100% offline with zero cloud telemetry.

Seamlessly switch between English and French without changing keyboard layouts or toggling dictionary settings. The extension automatically detects your context, restores French accents (e.g., ecole → école, deja → déjà), repairs French elisions and contractions (dont → don't, cest → c'est), and fixes common distance-1 keyboard slips in real time.

KEY FEATURES:
• 🔒 100% Offline & Private: All dictionary lookups and language models run entirely inside your browser. Zero keystrokes, URLs, or personal data ever leave your machine.
• ⚡ Ultra-Low Latency: High-performance binary dictionaries and n-gram contextual models execute in < 0.2 ms per keystroke, guaranteeing zero input lag.
• ⌨️ Interactive Suggestion Strip: Press Alt+2 or Alt+3 (or click) to pick alternative corrections for ambiguous words without interrupting your flow.
• ↩️ Instant Backspace Undo: Press Backspace immediately after an auto-correction to revert to your exact verbatim keystrokes.
• 🏷️ Non-Intrusive Floating Undo Chip: Clean, accessible floating indicator shows you what changed and lets you undo with a click.
• 🛡️ Strict Privacy Policy Guards: Automatically ignores password fields, credit cards, one-time passwords, sensitive autocomplete forms, code editors (Monaco/Ace), terminal elements, and spellcheck="false" fields.
• 📚 Personal Dictionary & Text Expansion: Add custom terms, ignore technical jargon, or configure custom expansion shortcuts in the Options page.
• 🌐 Per-Site Toggle: Quickly disable or re-enable autocorrect on specific websites directly from the extension popup.
```

---

## 2. Promotional & Visual Asset Catalog

All visual store assets are generated and maintained under `docs/screens/` and `public/icons/`:

### Icons
| Asset Path | Resolution | CWS Requirement | Purpose |
| :--- | :--- | :--- | :--- |
| `public/icons/icon-16.png` | 16 × 16 px | Mandatory | Browser extension favicon & context menus |
| `public/icons/icon-32.png` | 32 × 32 px | Recommended | Windows high-DPI display icon |
| `public/icons/icon-48.png` | 48 × 48 px | Mandatory | Chrome Extensions management page (`chrome://extensions`) |
| `public/icons/icon-128.png` | 128 × 128 px | Mandatory | Chrome Web Store listing & installation prompt |

### Promotional Banners
| Asset Path | Resolution | CWS Requirement | Description |
| :--- | :--- | :--- | :--- |
| `docs/screens/promo-small-440x280.png` | 440 × 280 px | Mandatory | Small promo tile displayed in search results and category grids |
| `docs/screens/promo-marquee-1400x560.png` | 1400 × 560 px | Optional (Featured) | High-resolution marquee banner for Chrome Web Store editorial showcase |

### Feature Marketing Screenshots (1280 × 800 px, 16:10)
| Asset Path | Resolution | Sequence | Marketing Focus |
| :--- | :--- | :--- | :--- |
| `docs/screens/store-screenshot-01.png` | 1280 × 800 px | Slide 1 (Hero) | **Core Promise**: Effortless real-time bilingual autocorrect, accent restoration & elision repair with floating undo chip. |
| `docs/screens/store-screenshot-02.png` | 1280 × 800 px | Slide 2 | **Interactive Suggestion Strip**: Two-tier word ranking with `Alt+2`/`Alt+3` selection and zero focus desync. |
| `docs/screens/store-screenshot-03.png` | 1280 × 800 px | Slide 3 | **Privacy & Performance**: 100% offline sandbox, zero network calls, sub-0.2ms latency, strict password protection. |
| `docs/screens/store-screenshot-04.png` | 1280 × 800 px | Slide 4 | **Personal Vocabulary**: Custom dictionary protection, sensitive jargon avoidance, and instant text expansion shortcuts. |
| `docs/screens/store-screenshot-05.png` | 1280 × 800 px | Slide 5 | **Universal Compatibility**: Works across Google Docs, Slack, Notion, Gmail, textareas, inputs & single-click site exclusion. |

---

## 3. Permissions Justification (For CWS Reviewers)

| Permission | Technical Need | Single Purpose User Benefit |
| :--- | :--- | :--- |
| `storage` | Required to call `chrome.storage.local`. | Saves user preferences (sensitivity mode, custom dictionary words, text expansion rules, disabled sites) locally on device without network transmission. |
| `activeTab` | Required to read the active tab domain when opening the extension popup. | Enables the user to click "Disable on this site" for the current website without granting persistent, broad access to browser history. |
| Host Permissions (`http://*/*`, `https://*/*`) | Required for content script injection into document text fields. | Listens for text input events and applies inline autocorrect replacements in input elements, textareas, and contenteditable DOM fields. |

---

## 4. Privacy & Data Use Disclosure

- **Does this extension collect or transmit user data?** `No.`
- **Does this extension use remote code or external APIs?** `No. Zero eval, zero external scripts, zero remote CDNs.`
- **Single Purpose Declaration**:
  > The sole purpose of this extension is to provide local, offline bilingual autocorrect and spelling suggestions for English and French text entered into web browser input fields.
