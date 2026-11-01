# Chrome Web Store Listing & Asset Catalog

This document specifies the complete store listing copy, visual asset catalog, permissions justifications, and privacy disclosures for Chrome Web Store submission of **Bilexi**.

---

## 1. Store Listing Metadata

- **Extension Name**: `Bilexi - Offline Bilingual Autocorrect (EN/FR)`
- **Short Name**: `Bilexi`
- **Version**: `0.5.1`
- **Primary Category**: `Productivity / Workflow`
- **Supported Languages**: `English (United States)`, `French`
- **Pricing**: `Free`

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
| `docs/screens/store-screenshot-05.png` | 1280 × 800 px | Slide 5 | **Universal Compatibility**: Works across web forms, textareas, inputs & single-click site exclusion. |

---

## 3. Permissions Justification (For Store Reviewers)

| Permission / Manifest Entry | Technical Need | User Benefit & Security Scope |
| :--- | :--- | :--- |
| `storage` | Required to call `chrome.storage.local`. | Saves user settings (sensitivity mode, keyboard layout, custom words, disabled site list) locally on device. Does not sync over the cloud (`chrome.storage.sync` is prohibited). |
| `activeTab` | Required to read the active tab URL/domain when the popup is clicked. | Allows the user to toggle "Disable on this site" for the current website without granting continuous, background access to browsing history. |
| `content_scripts.matches` (`http://*/*`, `https://*/*`) | Broad webpage execution scope required for content script injection into editable DOM text fields. | Enables the extension to detect text boundaries and apply corrections inside inputs, textareas, and contenteditable elements across websites. Does not perform outbound network communication. |
| `web_accessible_resources[].matches` (`http://*/*`, `https://*/*`) | Exposes packaged static dictionary data files (`dict/*.bin`, `dict/dictionary-manifest.json`) to matching webpages. | Allows in-page scripts to stream bundled binary dictionaries via internal URLs (`chrome.runtime.getURL`). Matching webpages can request these packaged linguistic lookup tables; this does not expose user preferences, custom words, or processed text, nor does it initiate outbound network calls to developer servers. |

---

## 4. Privacy & Data Use Disclosure

- **Does this extension collect or transmit user data to remote servers?**
  `No. All text processing and dictionary evaluations execute synchronously inside the local browser sandbox. Based on static source and bundle reviews, the extension does not transmit typed content to remote servers.`
- **Does this extension use remote code, cloud APIs, or analytics?**
  `No. Zero eval, zero external scripts, zero remote CDNs, and zero telemetry services.`
- **How does dictionary loading work?**
  `The extension packages pre-compiled linguistic tables directly in the extension archive and streams them via internal browser URLs (chrome.runtime.getURL). It initiates no external network requests.`
- **Why is webpage access required?**
  `Broad webpage match patterns (http://*/* and https://*/*) are required so the content script can listen to typing events and apply autocorrect replacements across web form fields and textareas. Webpage access is used exclusively for local DOM interaction.`
- **Single Purpose Declaration**:
  > The sole purpose of this extension is to provide local, offline bilingual autocorrect and spelling suggestions for English and French text entered into web browser input fields.
