# Bilexi — Offline Bilingual Autocorrect (English/French)

Bilexi is an offline, privacy-first browser extension providing real-time bilingual autocorrect, accent restoration, and elision handling for English and French text fields.

---

## Features

- **English & French Autocorrection**: High-accuracy correction targeting non-word typos and transpositions in both languages.
- **French Accent Restoration**: Restores missing or incorrect accents (e.g., `tres` $\to$ `très`, `evenement` $\to$ `événement`).
- **Elision & Apostrophe Repair**: Automatically normalizes and repairs French elisions (e.g., `l'`, `d'`, `j'`) and handles typographic quotes seamlessly.
- **Language Detection & Context Sensitivity**: Uses dual unigram dictionaries and bigram context tables (`ngram.bin`) to resolve cross-lingual ambiguities.
- **Non-Intrusive Floating Suggestions**: An ephemeral suggestion strip and undo chip rendered inside an isolated Shadow DOM.
- **Fast Undo & Rejection Memory**: Restores original text instantly with Backspace or Escape; remembers rejected tokens per element so unwanted corrections are not re-applied.
- **Keyboard Shortcuts**: Select candidate replacements using `Alt+1`, `Alt+2`, `Alt+3` (`⌥1`, `⌥2`, `⌥3` on macOS).

---

## Architecture & Privacy

Bilexi was engineered from inception around an uncompromising zero-network boundary:

- **100% Offline Processing**: All tokenizer routines, morphological rule evaluators, Bloom filters, symmetric deletion tables, and language models execute entirely inside the local browser process.
- **Zero Network Permissions**: The extension does **not** request `<all_urls>` or network access (`connect-src` / `fetch`). Zero analytics, zero telemetric beacons, and zero remote API calls.
- **Local Storage Sandbox**: User preferences, disabled domains, and custom dictionary entries are stored exclusively in `chrome.storage.local`.
- **Sensitive Field Guard**: Bilexi automatically ignores password fields, credit card inputs, one-time passcode fields, terminal emulators, code editors (Monaco, CodeMirror, Ace), and elements explicitly tagged with `spellcheck="false"`.

---

## Bundled Language Assets & Licensing

Bilexi bundles pre-compiled, highly compressed linguistic lookup tables in `public/dict/`:

| Asset | Size | Contents / Description | Upstream Source & License |
| :--- | :--- | :--- | :--- |
| `public/dict/en.bin` | ~3.50 MB | 26,500 English vocabulary forms, delete hash indices, Bloom filter | **SCOWL** (MIT/BSD-style), **FrequencyWords** (CC BY-SA 4.0) |
| `public/dict/fr.bin` | ~4.08 MB | 26,500 French vocabulary forms, delete hash indices, Bloom filter | **Dicollecte** (MPL-2.0), **Lexique 3.83** (CC BY-SA 4.0), **FrequencyWords** (CC BY-SA 4.0) |
| `public/dict/ngram.bin` | 80 KB | 16,000 top bigrams for contextual backoff scoring | Trained on independent open **Tatoeba** sentences (CC BY 2.0 FR) |
| `public/dict/dictionary-manifest.json` | 1.3 KB | Checksums, candidate counts, and format specifications | Project specification metadata |

Comprehensive attribution, source links, and full upstream license texts are documented in:
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)
- [`public/notices.html`](public/notices.html) (packaged inside the extension distribution)

---

## Project Licensing Status

> [!IMPORTANT]
> **No project license has been granted yet.**
> This repository is published for public visibility, source inspectability, and verification. All rights in the original Bilexi source code and architecture are reserved by the author. Public availability on GitHub does not grant permission to re-license, redistribute, commercialize, or incorporate this software into other products without explicit written permission from the project owner. Third-party components and corpora incorporated or referenced herein remain subject to their respective open-source and Creative Commons licenses as detailed in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

---

## Verified Store Release

- **Platform**: Microsoft Edge Add-ons
- **Published Extension Name**: `Bilexi`
- **Published Version**: `0.5.0`
- **Product ID / CRX ID**: `mheomahlcfddgjlemnolopfbhojfpmpb`
- **Store Description**: `100% offline bilingual autocorrect for English and French text fields.`
- **Publisher Account**: `BulkGrab Tools` (Microsoft Partner Center)
- **Website URI**: `https://extensionguy.me/`

---

## Installation (Unpacked Developer Build)

To load Bilexi into Microsoft Edge or Google Chrome from source:

1. Clone this repository:
   ```bash
   git clone https://github.com/sidoua26-debug/bilexi.git
   cd bilexi
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm build
   ```

4. Load into your browser:
   - In Microsoft Edge, navigate to `edge://extensions/`.
   - Enable **Developer mode** using the toggle switch in the left sidebar.
   - Click **Load unpacked**.
   - Select the generated `.output/chrome-mv3` directory.

---

## Development & Testing

### Scripts

- `pnpm dev`: Start the live-reloading development server with WXT.
- `pnpm build`: Compile and bundle production assets into `.output/chrome-mv3`.
- `pnpm test`: Execute Vitest unit and integration test suites.
- `pnpm test:e2e`: Execute Playwright end-to-end browser integration tests.
- `pnpm typecheck`: Run TypeScript compiler checks (`tsc --noEmit`).
- `pnpm lint`: Run ESLint across TypeScript and TSX source files.
- `pnpm bench:engine`: Run the synthetic noise and latency benchmark against frozen evaluation sets.

### Verification Quality Gates

Bilexi enforces strict quality and regression gates before release candidates are packaged:
- **Unit Test Suite**: 118 tests covering engine tokenization, phonetic distances, keyboard adjacency matrices, and DOM extraction policies.
- **Clean-Token False-Positive Rate**: $< 0.050\%$ clean-token false trigger rate on holdout corpora.
- **Engine Latency**: $p95 \le 3\text{ ms}$ processing time per keystroke boundary.
- **Unpacked Bundle Ceiling**: Total unpacked extension size strictly capped at $\le 8.0\text{ MB}$.
