/**
 * scripts/eval-wp-b.ts
 *
 * Implements WP B:
 * - Sentence-level cluster bootstrap (1,000 resamples) for n-gram ablation
 *   measuring 95% CIs on Dev and Held-out under both oracle and production policies.
 * - Circularity analysis between injector and distance.ts.
 * - Real-word collision analysis on D1 typos & achievable recall ceiling.
 *
 * Outputs evidence to evidence/v0.5.0/wp-b-analysis.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine';
import {
  loadCorpora,
  evaluateCorpus,
  DEFAULT_SEED,
  createMulberry32,
  createTypoInjector,
  type SentenceItem,
  type TypoResult,
} from './lib/eval-harness';
import { LanguageIndex, parseBinaryIndex } from '../engine/index';

function runSentenceBootstrap(
  sentences: SentenceItem[],
  engineWith: any,
  engineWithout: any,
  policy: 'oracle' | 'production',
  iterations = 1000,
  seed = DEFAULT_SEED
) {
  const rng = createMulberry32(seed);
  const n = sentences.length;

  const diffsPrec: number[] = [];
  const diffsRec: number[] = [];
  const diffsFpr: number[] = [];

  const withPrecs: number[] = [];
  const withRecs: number[] = [];
  const withFprs: number[] = [];

  const withoutPrecs: number[] = [];
  const withoutRecs: number[] = [];
  const withoutFprs: number[] = [];

  // For fast sentence-level cluster bootstrap, evaluate each sentence once under both engines
  console.log(`  Pre-evaluating ${n} sentences for cluster bootstrap (${policy})...`);

  interface SentenceEvalResult {
    cleanTokens: number;
    cleanFpWith: number;
    cleanFpWithout: number;
    injectedD1: number;
    d1RecWith: number;
    d1RecWithout: number;
    repWith: number;
    repWithout: number;
    tpWith: number;
    tpWithout: number;
  }

  const sentenceResults: SentenceEvalResult[] = [];
  const injectorRng = createMulberry32(seed);
  const injectTypo = createTypoInjector(injectorRng);

  for (const item of sentences) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    let cleanTokens = 0;
    let cleanFpWith = 0;
    let cleanFpWithout = 0;
    let injectedD1 = 0;
    let d1RecWith = 0;
    let d1RecWithout = 0;
    let repWith = 0;
    let repWithout = 0;
    let tpWith = 0;
    let tpWithout = 0;

    const langHint = policy === 'oracle' ? item.lang : undefined;

    // Clean pass
    for (const raw of rawTokens) {
      if (raw.length < 2) continue;
      cleanTokens++;

      const decWith = engineWith.analyze({ token: raw, boundary: ' ', leftContext, langHint });
      const decWithout = engineWithout.analyze({ token: raw, boundary: ' ', leftContext, langHint });

      if (decWith.action === 'replace' && decWith.replacement.toLowerCase() !== raw.toLowerCase()) {
        cleanFpWith++;
      }
      if (decWithout.action === 'replace' && decWithout.replacement.toLowerCase() !== raw.toLowerCase()) {
        cleanFpWithout++;
      }

      leftContext.push(raw);
      if (leftContext.length > 8) leftContext.shift();
    }

    // Noisy pass
    const leftContextNoisy: string[] = [];
    for (const token of rawTokens) {
      if (token.length < 3) continue;

      const shouldInject = injectorRng() < 0.083;
      let evalToken = token;
      let typo: TypoResult | null = null;

      if (shouldInject) {
        typo = injectTypo(token, item.lang === 'fr');
        if (typo) {
          evalToken = typo.noisy;
          if (typo.distance === 1) injectedD1++;
        }
      }

      const decWith = engineWith.analyze({ token: evalToken, boundary: ' ', leftContext: leftContextNoisy, langHint });
      const decWithout = engineWithout.analyze({ token: evalToken, boundary: ' ', leftContext: leftContextNoisy, langHint });

      if (decWith.action === 'replace') {
        repWith++;
        if (typo && decWith.replacement.toLowerCase() === token.toLowerCase()) {
          tpWith++;
          if (typo.distance === 1) d1RecWith++;
        }
      }

      if (decWithout.action === 'replace') {
        repWithout++;
        if (typo && decWithout.replacement.toLowerCase() === token.toLowerCase()) {
          tpWithout++;
          if (typo.distance === 1) d1RecWithout++;
        }
      }

      leftContextNoisy.push(evalToken);
      if (leftContextNoisy.length > 8) leftContextNoisy.shift();
    }

    sentenceResults.push({
      cleanTokens,
      cleanFpWith,
      cleanFpWithout,
      injectedD1,
      d1RecWith,
      d1RecWithout,
      repWith,
      repWithout,
      tpWith,
      tpWithout,
    });
  }

  console.log(`  Resampling ${iterations} clusters...`);
  for (let b = 0; b < iterations; b++) {
    let totCleanTokens = 0;
    let totCleanFpWith = 0;
    let totCleanFpWithout = 0;
    let totInjectedD1 = 0;
    let totD1RecWith = 0;
    let totD1RecWithout = 0;
    let totRepWith = 0;
    let totRepWithout = 0;
    let totTpWith = 0;
    let totTpWithout = 0;

    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng() * n);
      const row = sentenceResults[idx]!;
      totCleanTokens += row.cleanTokens;
      totCleanFpWith += row.cleanFpWith;
      totCleanFpWithout += row.cleanFpWithout;
      totInjectedD1 += row.injectedD1;
      totD1RecWith += row.d1RecWith;
      totD1RecWithout += row.d1RecWithout;
      totRepWith += row.repWith;
      totRepWithout += row.repWithout;
      totTpWith += row.tpWith;
      totTpWithout += row.tpWithout;
    }

    const pWith = (totTpWith / (totRepWith || 1)) * 100;
    const pWithout = (totTpWithout / (totRepWithout || 1)) * 100;
    const rWith = (totD1RecWith / (totInjectedD1 || 1)) * 100;
    const rWithout = (totD1RecWithout / (totInjectedD1 || 1)) * 100;
    const fWith = (totCleanFpWith / (totCleanTokens || 1)) * 100;
    const fWithout = (totCleanFpWithout / (totCleanTokens || 1)) * 100;

    withPrecs.push(pWith);
    withRecs.push(rWith);
    withFprs.push(fWith);

    withoutPrecs.push(pWithout);
    withoutRecs.push(rWithout);
    withoutFprs.push(fWithout);

    diffsPrec.push(pWith - pWithout);
    diffsRec.push(rWith - rWithout);
    diffsFpr.push(fWith - fWithout);
  }

  function getCi(arr: number[]): { mean: number; lower: number; upper: number } {
    arr.sort((a, b) => a - b);
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const lower = arr[Math.floor(arr.length * 0.025)]!;
    const upper = arr[Math.floor(arr.length * 0.975)]!;
    return { mean, lower, upper };
  }

  return {
    withNgram: {
      precision: getCi(withPrecs),
      recallD1: getCi(withRecs),
      cleanFpr: getCi(withFprs),
    },
    withoutNgram: {
      precision: getCi(withoutPrecs),
      recallD1: getCi(withoutRecs),
      cleanFpr: getCi(withoutFprs),
    },
    delta: {
      precision: getCi(diffsPrec),
      recallD1: getCi(diffsRec),
      cleanFpr: getCi(diffsFpr),
    },
  };
}

function analyzeRealWordCollisions(sentences: SentenceItem[], enIdx: LanguageIndex, frIdx: LanguageIndex) {
  const rng = createMulberry32(DEFAULT_SEED);
  const injectTypo = createTypoInjector(rng);

  let totalD1Typos = 0;
  let nonWordTypos = 0;
  let realWordCollisions = 0;

  const collisionExamples: Array<{ original: string; noisy: string; lang: string; type: string }> = [];

  for (const item of sentences) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const idx = item.lang === 'fr' ? frIdx : enIdx;

    for (const token of rawTokens) {
      if (token.length < 3) continue;
      const shouldInject = rng() < 0.083;
      if (!shouldInject) continue;

      const typo = injectTypo(token, item.lang === 'fr');
      if (typo && typo.distance === 1) {
        totalD1Typos++;
        const lowerNoisy = typo.noisy.toLowerCase();
        const isRealWord = idx.isKnownWord(lowerNoisy);

        if (isRealWord) {
          realWordCollisions++;
          if (collisionExamples.length < 20) {
            collisionExamples.push({
              original: token,
              noisy: typo.noisy,
              lang: item.lang,
              type: typo.type,
            });
          }
        } else {
          nonWordTypos++;
        }
      }
    }
  }

  const collisionRate = (realWordCollisions / (totalD1Typos || 1)) * 100;
  const theoreticalMaxRecall = (nonWordTypos / (totalD1Typos || 1)) * 100;

  return {
    totalD1Typos,
    nonWordTypos,
    realWordCollisions,
    collisionRate,
    theoreticalMaxRecall,
    collisionExamples,
  };
}

async function main() {
  console.log('========================================================');
  console.log('              WP B: EVALUATION VALIDITY ANALYSIS        ');
  console.log('========================================================\n');

  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const enIdx = new LanguageIndex(parseBinaryIndex(enBuf));
  const frIdx = new LanguageIndex(parseBinaryIndex(frBuf));

  const engineWith = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });
  const engineWithout = createEngine({ en: enBuf, fr: frBuf });

  const { dev, test } = loadCorpora('.');

  // 1. Real-word collision analysis
  console.log('[1/4] Analyzing Real-Word Typo Collisions on Dev Split...');
  const collisionAnalysisDev = analyzeRealWordCollisions(dev, enIdx, frIdx);
  console.log(`  Total D1 Typos: ${collisionAnalysisDev.totalD1Typos}`);
  console.log(`  Non-Word Typos: ${collisionAnalysisDev.nonWordTypos} (${(100 - collisionAnalysisDev.collisionRate).toFixed(1)}%)`);
  console.log(`  Real-Word Collisions: ${collisionAnalysisDev.realWordCollisions} (${collisionAnalysisDev.collisionRate.toFixed(1)}%)`);
  console.log(`  Theoretical Recall Ceiling (Zero Real-Word Overwrite): ${collisionAnalysisDev.theoreticalMaxRecall.toFixed(2)}%\n`);

  // 2. Sentence-level cluster bootstrap on Dev (Production)
  console.log('[2/4] Running Sentence-level Cluster Bootstrap on Dev Split (Production policy)...');
  const bootstrapDevProd = runSentenceBootstrap(dev, engineWith, engineWithout, 'production');

  // 3. Sentence-level cluster bootstrap on Dev (Oracle)
  console.log('\n[3/4] Running Sentence-level Cluster Bootstrap on Dev Split (Oracle policy)...');
  const bootstrapDevOracle = runSentenceBootstrap(dev, engineWith, engineWithout, 'oracle');

  // 4. Single held-out validation bootstrap (Test Production)
  console.log('\n[4/4] Running Sentence-level Cluster Bootstrap on Held-Out Test Split (Production policy)...');
  const bootstrapTestProd = runSentenceBootstrap(test, engineWith, engineWithout, 'production');

  const output = {
    timestamp: new Date().toISOString(),
    ngramByteSize: ngBuf.length,
    realWordCollisions: collisionAnalysisDev,
    bootstrap: {
      devProduction: bootstrapDevProd,
      devOracle: bootstrapDevOracle,
      testProduction: bootstrapTestProd,
    },
  };

  const outPath = 'evidence/v0.5.0/wp-b-analysis.json';
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nEvidence written to ${outPath}`);

  console.log('\n========================================================================================');
  console.log('                          N-GRAM CLUSTER BOOTSTRAP DELTAS (95% CIs)                     ');
  console.log('========================================================================================');
  console.log(`Dev (Production): Prec delta = +${bootstrapDevProd.delta.precision.mean.toFixed(2)}% [${bootstrapDevProd.delta.precision.lower.toFixed(2)}, ${bootstrapDevProd.delta.precision.upper.toFixed(2)}]`);
  console.log(`                  Rec D1 delta = +${bootstrapDevProd.delta.recallD1.mean.toFixed(2)}% [${bootstrapDevProd.delta.recallD1.lower.toFixed(2)}, ${bootstrapDevProd.delta.recallD1.upper.toFixed(2)}]`);
  console.log(`                  Clean FPR delta = ${bootstrapDevProd.delta.cleanFpr.mean.toFixed(3)}% [${bootstrapDevProd.delta.cleanFpr.lower.toFixed(3)}, ${bootstrapDevProd.delta.cleanFpr.upper.toFixed(3)}]`);
  console.log('----------------------------------------------------------------------------------------');
  console.log(`Dev (Oracle):     Prec delta = +${bootstrapDevOracle.delta.precision.mean.toFixed(2)}% [${bootstrapDevOracle.delta.precision.lower.toFixed(2)}, ${bootstrapDevOracle.delta.precision.upper.toFixed(2)}]`);
  console.log(`                  Rec D1 delta = +${bootstrapDevOracle.delta.recallD1.mean.toFixed(2)}% [${bootstrapDevOracle.delta.recallD1.lower.toFixed(2)}, ${bootstrapDevOracle.delta.recallD1.upper.toFixed(2)}]`);
  console.log('----------------------------------------------------------------------------------------');
  console.log(`Test (Production):Prec delta = +${bootstrapTestProd.delta.precision.mean.toFixed(2)}% [${bootstrapTestProd.delta.precision.lower.toFixed(2)}, ${bootstrapTestProd.delta.precision.upper.toFixed(2)}]`);
  console.log(`                  Rec D1 delta = +${bootstrapTestProd.delta.recallD1.mean.toFixed(2)}% [${bootstrapTestProd.delta.recallD1.lower.toFixed(2)}, ${bootstrapTestProd.delta.recallD1.upper.toFixed(2)}]`);
  console.log('========================================================================================\n');
}

main().catch(err => {
  console.error('Error running WP B:', err);
  process.exit(1);
});
