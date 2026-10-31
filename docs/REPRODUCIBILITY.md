# Bilexi — Reproducibility Manifest

This document records the exact environment, checksums, random seeds, and execution commands required to independently reproduce all reported benchmarks, evaluations, and packaging outputs for Bilexi v0.5.0.

---

## 1. Source Control State

- **Base Commit SHA**: `b04a59bfc1aec8e3b131c161ee9fa2e449d5e8dd`
- **Node / Runtime**: Node.js v20+ / pnpm v9+
- **Platform**: Linux x86_64
- **Working Tree Status**: Modified (`git status --short`)

### Tracked Modified Files
```text
 M .agents/workflows/verify.md
 M AGENTS.md
 M docs/BENCHMARK-BLACKBOX.md
 M docs/BENCHMARKS.md
 M docs/DECISIONS.md
 M docs/THIRD_PARTY_NOTICES.md
 M e2e/fixtures/spike-fixtures.html
 M e2e/specs/dom-editing.spec.ts
 M engine/__tests__/engine.test.ts
 M engine/case.ts
 M engine/decide.ts
 M engine/distance.ts
 M engine/engine.ts
 M engine/index.ts
 M engine/language.ts
 M engine/rules-en.ts
 M engine/rules-fr.ts
 M engine/tokenize.ts
 M engine/types.ts
 M entrypoints/background.ts
 M entrypoints/content/chip.ts
 M entrypoints/content/index.ts
 M entrypoints/content/policy.ts
 M entrypoints/content/replace.ts
 M entrypoints/content/settings.ts
 M entrypoints/popup/main.tsx
 M package.json
 M public/dict/en.bin
 M public/dict/fr.bin
 M public/dict/dictionary-manifest.json
 M scripts/bench-blackbox.ts
 M scripts/bench-engine.ts
 M scripts/build-data.ts
 M tsconfig.json
 M wxt.config.ts
```

---

## 2. Artifact and Asset SHA-256 Checksums

### Evaluation Scripts
| Script Path | SHA-256 Checksum | Purpose |
| :--- | :--- | :--- |
| `scripts/lib/eval-harness.ts` | `7266c34072864a6c4bd7d5843890a95555313f4ee517b0db8281757b3243fbe5` | Unified evaluation harness & category classification |
| `scripts/eval-v050.ts` | `756699737483ccdbd76c725f55eb0879d1b55677dbc6b78b15f0377414fa3548` | Benchmark generator (8 split/ngram/hint conditions) |
| `scripts/eval-tiered-actions.ts` | `3657a3231bc1589a894ba0d99ab750ff03a45d75606a03c7620021200b30b24e` | Two-tier recovery & typo category classification |
| `scripts/report.ts` | `fad6dee19cea74ea719bd8fc951bdd8f0adf09dd3a8732b04a6f331cde752e97` | Ground Rule 1 Markdown audit report generator |
| `scripts/package-release.ts` | `08b1559f15b15e828d89d10008a9e61d5315843160a169a0f0f13c7558eda16b` | Quality-gated packaging pipeline |

### Corpora & Golden Fixtures
| File Path | SHA-256 Checksum | Description |
| :--- | :--- | :--- |
| `data/raw/tatoeba-sentences.json` | `f3faefb808fb50024cf8ffe19a758e4839f247f12cb7c8c0e80d56e7b0fd04a2` | Tatoeba bilingual sentence corpus |
| `e2e/golden/appendix-a.json` | `d4d1835a3eea814b705d3885578081353d6131033de552b7ad08883f253a8dc9` | Frozen Appendix A golden scenario test suite |

### Binary Dictionaries
| File Path | Size (Bytes) | SHA-256 Checksum |
| :--- | :--- | :--- |
| `public/dict/en.bin` | 3,501,380 | `4b66c1c41fa4d5695cb8427e8dae7f79ddfb25a49eb35ea3a442a0fff6d0308f` |
| `public/dict/fr.bin` | 4,083,684 | `c76f48907b11a53b8fa075172c0884760cece2f4a7b4920156eede1b1bf190e3` |
| `public/dict/ngram.bin` | 80,016 | `3cf6c174bdee73cf0fc9701ac5c48ea5d2931bb58f0afd1cbfa516693d8fa041` |
| `public/dict/dictionary-manifest.json` | 1,339 | `518e47d7885a92c5f55b9382195598688deb962e7804f212648e1a8c136338bc` |

---

## 3. Random Seeds & Partition Parameters

- **Synthetic Typo Seed (`DEFAULT_SEED`)**: `20261016` (PRNG: Mulberry32 deterministic generator)
- **Typo Error Distribution**:
  - Distance 1: Substitution (50%), Deletion (20%), Insertion (20%), Transposition (10%)
- **Data Split Partitions**:
  - Development Split: 16,720 sentences (127,035 clean tokens, 7,126 D1 typos)
  - Held-out Test Split: 11,041 sentences (84,238 clean tokens, 4,737 D1 typos)

---

## 4. Exact Reproduction Commands

All commands should be executed from the repository root:

### 1. Build Extension Assets & Bundle
```bash
pnpm exec wxt build
```
Verify unpacked bundle size:
```bash
node -e "
const fs = require('fs'), path = require('path');
function sz(d){ let t=0; for (const e of fs.readdirSync(d,{withFileTypes:true})){ const f=path.join(d,e.name); t+=e.isDirectory()?sz(f):fs.statSync(f).size; } return t; }
console.log('Unpacked bytes:', sz('.output/chrome-mv3'));
"
```

### 2. Run Test Suites
```bash
# Typecheck
pnpm exec tsc --noEmit

# Unit tests
pnpm exec vitest run

# Golden scenario regression check
pnpm exec tsx scripts/verify-golden.ts

# Black-box Appendix A runner
pnpm exec tsx scripts/bench-blackbox.ts

# Playwright E2E browser tests (including WP2 suggestion recovery)
pnpm exec playwright test
```

### 3. Generate Benchmark & Tiered Evidence
```bash
# Generate benchmark across all 8 split/hint conditions
pnpm exec tsx scripts/eval-v050.ts

# Generate two-tier action and typo category classification
pnpm exec tsx scripts/eval-tiered-actions.ts
```

### 4. Generate Audit Report
```bash
pnpm exec tsx scripts/report.ts --write
```

### 5. Execute Full Quality-Gated Packaging Pipeline
```bash
pnpm exec tsx scripts/package-release.ts
```
