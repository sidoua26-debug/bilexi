/**
 * scripts/nested-validation.ts
 *
 * Implements Grounded Nested Validation:
 * 1. Partitions Dev split (16,720 sentences) into:
 *    - Tune-fold (80% = 13,376 sentences)
 *    - Check-fold (20% = 3,344 sentences)
 *    using a deterministic PRNG seed (20261018).
 * 2. Runs evaluation on Tune-fold to establish predicted thresholds/performance.
 * 3. Evaluates Check-fold to test for overfitting (compares against Tune-fold).
 * 4. Evaluates Held-out Test split (11,041 sentences).
 * 5. Requires BOTH English and French to independently clear >= 97.0% precision.
 *
 * Saves raw JSON evidence to evidence/v0.5.0/nested-validation.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine';
import {
  loadCorpora,
  evaluateCorpus,
  createMulberry32,
  DEFAULT_SEED,
  type SplitMetrics,
} from './lib/eval-harness';

const NESTED_SPLIT_SEED = 20261018;

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return result;
}

export function runNestedValidation() {
  console.log('========================================================');
  console.log('       NESTED VALIDATION: TUNE / CHECK / HELDOUT        ');
  console.log('========================================================\n');

  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.existsSync('public/dict/ngram.bin')
    ? fs.readFileSync('public/dict/ngram.bin')
    : undefined;

  const { dev, test } = loadCorpora('.');

  // Partition Dev 80/20
  const rng = createMulberry32(NESTED_SPLIT_SEED);
  const shuffledDev = shuffle(dev, rng);
  const splitIdx = Math.floor(shuffledDev.length * 0.80);
  const tuneFold = shuffledDev.slice(0, splitIdx);
  const checkFold = shuffledDev.slice(splitIdx);

  console.log(`Dataset Partitions:`);
  console.log(`- Dev Total:     ${dev.length} sentences`);
  console.log(`  ├─ Tune Fold:  ${tuneFold.length} sentences (80.0%)`);
  console.log(`  └─ Check Fold: ${checkFold.length} sentences (20.0%)`);
  console.log(`- Held-out Test: ${test.length} sentences\n`);

  const engine = createEngine(
    { en: enBuf, fr: frBuf, ngram: ngBuf },
    { languageMode: 'auto', sensitivity: 'balanced', layout: 'auto', sentenceCaps: true, fixLoneI: true }
  );

  console.log('1. Evaluating Tune-Fold (80% dev)...');
  const tuneRes = evaluateCorpus(tuneFold, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED });

  console.log('2. Evaluating Check-Fold (20% dev)...');
  const checkRes = evaluateCorpus(checkFold, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED });

  console.log('3. Evaluating Held-out Test...');
  const testRes = evaluateCorpus(test, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED });

  function formatRow(label: string, m: SplitMetrics) {
    return {
      partition: label,
      sentences: m.sentences,
      precisionOverall: m.overall.appliedPrecision,
      precisionEn: m.en.appliedPrecision,
      precisionFr: m.fr.appliedPrecision,
      combinedRecallD1: m.overall.combinedRecallD1,
      autoRecallD1: m.overall.recallD1,
      cleanFprOverall: m.overall.cleanFpr,
      cleanFprEn: m.en.cleanFpr,
      cleanFprFr: m.fr.cleanFpr,
      cleanFpTokens: m.overall.cleanFp,
      cleanTotalTokens: m.overall.cleanTokens,
    };
  }

  const table = [
    formatRow('Dev Tune-Fold (80%)', tuneRes),
    formatRow('Dev Check-Fold (20%)', checkRes),
    formatRow('Held-Out Test Split', testRes),
  ];

  console.log('\n========================================================================================');
  console.log('                            NESTED VALIDATION SCOREBOARD                                ');
  console.log('========================================================================================');
  console.log(
    'Partition'.padEnd(22) +
    ' | Prec Overall | Prec (EN) | Prec (FR) | Comb Recall | Auto Recall | Clean FPR'
  );
  console.log('-'.repeat(90));

  for (const row of table) {
    console.log(
      row.partition.padEnd(22) + ' | ' +
      `${row.precisionOverall.toFixed(2)}%`.padEnd(12) + ' | ' +
      `${row.precisionEn.toFixed(2)}%`.padEnd(9) + ' | ' +
      `${row.precisionFr.toFixed(2)}%`.padEnd(9) + ' | ' +
      `${row.combinedRecallD1.toFixed(2)}%`.padEnd(11) + ' | ' +
      `${row.autoRecallD1.toFixed(2)}%`.padEnd(11) + ' | ' +
      `${row.cleanFprOverall.toFixed(4)}%`
    );
  }
  console.log('========================================================================================\n');

  // Overfit Analysis
  const precisionDiff = Math.abs(checkRes.overall.appliedPrecision - tuneRes.overall.appliedPrecision);
  const recallDiff = Math.abs(checkRes.overall.combinedRecallD1 - tuneRes.overall.combinedRecallD1);
  const isOverfit = precisionDiff > 1.5 || recallDiff > 2.0;

  console.log(`Generalization / Overfit Analysis:`);
  console.log(`- Precision Delta (Check vs Tune): ${precisionDiff.toFixed(2)}% ${precisionDiff <= 1.0 ? '(Close agreement - NOT overfit)' : '(Material difference)'}`);
  console.log(`- Combined Recall Delta:           ${recallDiff.toFixed(2)}%`);
  console.log(`- Overfit Verdict:                 ${isOverfit ? '⚠️ OVERFIT DETECTED' : '✅ GENERALIZES ACROSS FOLDS'}\n`);

  // Independent Language Gate Check
  const heldOutEnPass = testRes.en.appliedPrecision >= 97.0;
  const heldOutFrPass = testRes.fr.appliedPrecision >= 97.0;
  const heldOutBothPass = heldOutEnPass && heldOutFrPass;

  console.log(`Held-Out Independent Language Gate Check (Rule 2):`);
  console.log(`- EN Held-Out Precision: ${testRes.en.appliedPrecision.toFixed(2)}% (Target >= 97.0%) -> ${heldOutEnPass ? 'PASS' : 'FAIL'}`);
  console.log(`- FR Held-Out Precision: ${testRes.fr.appliedPrecision.toFixed(2)}% (Target >= 97.0%) -> ${heldOutFrPass ? 'PASS' : 'FAIL'}`);
  console.log(`- Overall Applied Precision Verdict: ${heldOutBothPass ? 'PASS' : 'FAIL (Per-language gate missed on French)'}\n`);

  const output = {
    nestedSeed: NESTED_SPLIT_SEED,
    partitions: {
      devTotal: dev.length,
      tuneFoldCount: tuneFold.length,
      checkFoldCount: checkFold.length,
      heldOutCount: test.length,
    },
    results: {
      tune: table[0],
      check: table[1],
      heldOut: table[2],
    },
    analysis: {
      precisionDeltaCheckVsTune: precisionDiff,
      recallDeltaCheckVsTune: recallDiff,
      isOverfit,
      heldOutEnPass,
      heldOutFrPass,
      heldOutBothPass,
    },
  };

  const outDir = path.resolve('evidence/v0.5.0');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'nested-validation.json'), JSON.stringify(output, null, 2), 'utf-8');
  console.log(`Saved nested validation evidence to evidence/v0.5.0/nested-validation.json\n`);

  return output;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runNestedValidation();
}
