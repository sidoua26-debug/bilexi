import fs from 'node:fs';
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

async function main() {
  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const { dev, test } = loadCorpora('.');
  const rng = createMulberry32(NESTED_SPLIT_SEED);
  const shuffledDev = shuffle(dev, rng);
  const splitIdx = Math.floor(shuffledDev.length * 0.80);
  const tuneFold = shuffledDev.slice(0, splitIdx);
  const checkFold = shuffledDev.slice(splitIdx);

  console.log('========================================================================');
  console.log('  RE-MEASURING FRENCH PRECISION ON TUNE / CHECK / HELDOUT (3 FIXES)     ');
  console.log('========================================================================\n');

  const engine = createEngine(
    { en: enBuf, fr: frBuf, ngram: ngBuf },
    { languageMode: 'auto', sensitivity: 'balanced', layout: 'auto', sentenceCaps: true, fixLoneI: true }
  );

  console.log('1. Evaluating Tune-Fold (80% dev, 13,376 sents)...');
  const tune = evaluateCorpus(tuneFold, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

  console.log('2. Evaluating Check-Fold (20% dev, 3,344 sents)...');
  const check = evaluateCorpus(checkFold, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

  console.log('3. Evaluating Held-Out Test Split (11,041 sents)...');
  const testRes = evaluateCorpus(test, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

  function printBlock(name: string, m: SplitMetrics) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`=== ${name} ===`);
    console.log(`------------------------------------------------------------`);
    console.log(`Overall Applied Precision: ${m.overall.appliedPrecision.toFixed(2)}% (${m.overall.truePositives} / ${m.overall.replacements})`);
    console.log(`  ├─ English Precision:    ${m.en.appliedPrecision.toFixed(2)}% (${m.en.truePositives} / ${m.en.replacements})`);
    console.log(`  └─ French Precision:     ${m.fr.appliedPrecision.toFixed(2)}% (${m.fr.truePositives} / ${m.fr.replacements}) [Bad Replacements: ${m.fr.badReplacements}]`);
    console.log(`D1 Auto Recall:            ${m.overall.recallD1.toFixed(2)}% (EN: ${m.en.recallD1.toFixed(2)}%, FR: ${m.fr.recallD1.toFixed(2)}%)`);
    console.log(`D1 Combined Recovery:      ${m.overall.combinedRecallD1.toFixed(2)}% (EN: ${m.en.combinedRecallD1.toFixed(2)}%, FR: ${m.fr.combinedRecallD1.toFixed(2)}%)`);
    console.log(`Clean-Token FPR:           ${m.overall.cleanFpr.toFixed(4)}% (EN: ${m.en.cleanFpr.toFixed(4)}%, FR: ${m.fr.cleanFpr.toFixed(4)}%)`);
    console.log(`  Clean FP Tokens:         ${m.overall.cleanFp} / ${m.overall.cleanTokens} (FR: ${m.fr.cleanFp} / ${m.fr.cleanTokens})`);
  }

  printBlock('Tune-Fold (80% dev)', tune);
  printBlock('Check-Fold (20% dev)', check);
  printBlock('Held-Out Test Split', testRes);

  // Audit remaining French bad replacements on Held-Out Test
  const remainingFrBad = (testRes.badReplacementDetails || []).filter(d => d.lang === 'fr');
  console.log(`\n\nTotal Remaining French Bad Replacements on Held-Out: ${remainingFrBad.length}`);
  fs.writeFileSync('evidence/v0.5.0/french-heldout-after-fixes.json', JSON.stringify(remainingFrBad, null, 2));
}

main().catch(console.error);
