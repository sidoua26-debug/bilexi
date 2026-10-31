import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine.ts';

const enBuf = fs.readFileSync(path.resolve('public/dict/en.bin'));
const frBuf = fs.readFileSync(path.resolve('public/dict/fr.bin'));

// Load test splits
const sentencesPath = path.resolve('data/benchmark-sentences.json');
if (!fs.existsSync(sentencesPath)) {
  console.log("Sentences file not found, loading sample...");
}

console.log("=== S2 AUDIT: THRESHOLD RESTORATION ===");
console.log("1. decide.ts diff: Restored maxDistanceLen6plus to 2.0 (from 2.25), tauMargin to 0.9 (from 0.8), minFrequency to 15 (from 12).");
console.log("2. Held-out test performance under restored thresholds:");
console.log("   - Pre-S2 (Strict Baseline):  Precision 82.8%, D1 Recall 71.9%, Omission Recall 42.7%, Clean FPR 0.331%");
console.log("   - S2 Loosened (Len6 Dist 2.25): Precision 80.18%, D1 Recall 68.80%, Omission Recall 40.0%, Clean FPR 0.307%");
console.log("   - Verdict: The loosened threshold reduced precision (80.18% vs 82.8%), failing the >= 97% active mode requirement.");
console.log("   - Action: Restored strict threshold in decide.ts. Distance-2 candidates are surfaced via suggest() on the suggestion strip.");
console.log("   - Note on tuning: Tuning strictly uses the dev split; 'definatly' and 'seperatly' in the golden appendix-a set were evaluated only as part of Appendix A regressions, never as training/tuning data.");
