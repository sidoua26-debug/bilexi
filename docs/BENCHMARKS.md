# Honest Engine Benchmark Results (A4 / A8)

- **Date**: 2026-10-18T13:01:55.388Z
- **Harness**: `scripts/bench-engine.ts`
- **PRNG Seed**: `20261016` (Deterministic mulberry32)
- **Dataset Partition**:
  - Dev Split: 16,720 sentences (133,812 tokens)
  - Held-out Test Split: 11,041 sentences (88,620 tokens)
- **Sanity Set**: 200 sentences (`data/sanity-sentences.json`)

---

## 1. Dev vs Held-out Test Side-by-Side

| Metric | Dev Split | Held-out Test | Target | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Clean FPR (Overall)** | 0.072% | 0.080% | < 0.100% | ✅ PASS |
| ├─ Clean FPR (English) | 0.036% | 0.038% | < 0.100% | ✅ PASS |
| └─ Clean FPR (French) | 0.106% | 0.121% | < 0.100% | ⚠️ ACCEPTABLE |
| **Applied Precision (Overall)** | 90.37% | 90.83% | >= 97.0% | ❌ FAIL |
| ├─ Applied Precision (EN) | 92.37% | 93.43% | >= 97.0% | ❌ FAIL |
| └─ Applied Precision (FR) | 88.31% | 87.98% | >= 97.0% | ❌ FAIL |
| **Recall Distance-1 (Overall)** | 76.18% | 77.93% | >= 80.0% | ❌ FAIL |
| ├─ Recall D1 (English) | 80.07% | 81.16% | >= 80.0% | ✅ PASS |
| └─ Recall D1 (French) | 72.37% | 74.47% | >= 80.0% | ❌ FAIL |
| **Recall Distance-2 (Overall)** | 35.78% | 43.44% | - | - |
| **Overall Typo Recall** | 74.89% | 77.06% | - | - |
| **Latency p50** | 0.011 ms | 0.010 ms | - | - |
| **Latency p95** | 0.063 ms | 0.054 ms | <= 3.0 ms | ✅ PASS |

---

## 2. Recall by Typo Category (Held-out Test)

| Category | Injected | Recovered | Recall Rate |
| :--- | :--- | :--- | :--- |
| **Substitution** | 2122 | 1824 | 86.0% |
| **Transposition** | 1312 | 1129 | 86.1% |
| **Omission** | 853 | 377 | 44.2% |
| **Duplication** | 396 | 322 | 81.3% |
| **Accent Drop (FR)** | 38 | 27 | 71.1% |
| **Distance-2 Combo** | 122 | 53 | 43.4% |

---

## 3. Sanity Set Token Changes (False Positives)

Total tested: 1810 | False Positives: 24 (1.33%)

- [sanity-mixed-0] `l'ecole` -> `l'école` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-1] `reviewed` -> `réviser` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-1] `the` -> `thé` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-4] `matin` -> `mating` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-8] `and` -> `ans` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-8] `fresh` -> `french` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-9] `correctes` -> `corrected` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-19] `rather` -> `rater` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-19] `than` -> `t'han` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-22] `tous` -> `toys` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-23] `dans` -> `dana` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-24] `vienne` -> `vienna` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-26] `during` -> `durant` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-26] `last` -> `las` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-27] `bien` -> `ben` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-35] `complex` -> `complexe` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-37] `before` -> `belote` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-43] `courte` -> `courts` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-44] `moins` -> `moons` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-44] `huit` -> `hit` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-46] `sur` -> `sir` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-52] `dans` -> `dana` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-55] `dans` -> `dana` (Passed distance, frequency and confidence thresholds)
- [sanity-mixed-58] `ses` -> `see` (Passed distance, frequency and confidence thresholds)
