import fs from 'node:fs';
import { createEngine } from '../engine/engine';
import {
  loadCorpora,
  evaluateCorpus,
  createMulberry32,
  DEFAULT_SEED,
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

  console.log(`Evaluating with Morphological Suffix Ambiguity Mechanism...\n`);

  // We can test different margin thresholds for French morphological competitors: margin < 2.0, < 2.5, < 3.0
  for (const frMorphMargin of [2.0, 2.5, 3.0]) {
    console.log(`================================================================`);
    console.log(`TESTING frMorphMargin = ${frMorphMargin}`);
    console.log(`================================================================`);

    const engine = createEngine(
      { en: enBuf, fr: frBuf, ngram: ngBuf },
      {
        thresholdOverrides: {
          frMorphMargin,
        }
      }
    );

    console.log('1. Tune-Fold (80% dev):');
    const tuneRes = evaluateCorpus(tuneFold, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED });
    console.log(`   Overall Prec: ${tuneRes.overall.appliedPrecision.toFixed(2)}% | EN: ${tuneRes.en.appliedPrecision.toFixed(2)}% | FR: ${tuneRes.fr.appliedPrecision.toFixed(2)}%`);
    console.log(`   Auto Recall D1: ${tuneRes.overall.recallD1.toFixed(2)}% (FR Auto: ${tuneRes.fr.recallD1.toFixed(2)}%)`);
    console.log(`   Combined D1:    ${tuneRes.overall.combinedRecallD1.toFixed(2)}% (FR Comb: ${tuneRes.fr.combinedRecallD1.toFixed(2)}%)\n`);

    console.log('2. Check-Fold (20% dev):');
    const checkRes = evaluateCorpus(checkFold, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED });
    console.log(`   Overall Prec: ${checkRes.overall.appliedPrecision.toFixed(2)}% | EN: ${checkRes.en.appliedPrecision.toFixed(2)}% | FR: ${checkRes.fr.appliedPrecision.toFixed(2)}%`);
    console.log(`   Auto Recall D1: ${checkRes.overall.recallD1.toFixed(2)}% (FR Auto: ${checkRes.fr.recallD1.toFixed(2)}%)`);
    console.log(`   Combined D1:    ${checkRes.overall.combinedRecallD1.toFixed(2)}% (FR Comb: ${checkRes.fr.combinedRecallD1.toFixed(2)}%)\n`);

    console.log('3. Held-Out Test Split:');
    const testRes = evaluateCorpus(test, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED });
    console.log(`   Overall Prec: ${testRes.overall.appliedPrecision.toFixed(2)}% | EN: ${testRes.en.appliedPrecision.toFixed(2)}% | FR: ${testRes.fr.appliedPrecision.toFixed(2)}%`);
    console.log(`   Auto Recall D1: ${testRes.overall.recallD1.toFixed(2)}% (FR Auto: ${testRes.fr.recallD1.toFixed(2)}%)`);
    console.log(`   Combined D1:    ${testRes.overall.combinedRecallD1.toFixed(2)}% (FR Comb: ${testRes.fr.combinedRecallD1.toFixed(2)}%)\n`);
  }
}

main().catch(console.error);
