/**
 * scripts/reproduce-baseline.ts
 *
 * Runs the unified eval-harness on the b04a59b baseline code and dictionaries.
 * Saves raw evidence to evidence/b04a59b/baseline-benchmark.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createEngine as createBaselineEngine } from '../baseline-b04a59b/engine/engine';
import { loadCorpora, evaluateCorpus, DEFAULT_SEED } from './lib/eval-harness';

async function main() {
  console.log('========================================================');
  console.log('   EVALUATING BASELINE COMMIT b04a59b ON EVAL-HARNESS   ');
  console.log('========================================================\n');

  const enBuf = fs.readFileSync('baseline-b04a59b/public/dict/en.bin');
  const frBuf = fs.readFileSync('baseline-b04a59b/public/dict/fr.bin');

  const engine = createBaselineEngine(
    { en: enBuf, fr: frBuf },
    {
      languageMode: 'auto',
      sensitivity: 'balanced',
      layout: 'auto',
      sentenceCaps: true,
      fixLoneI: true,
    }
  );

  const { dev, test, sanity } = loadCorpora('.');
  console.log(`Corpora loaded: Dev=${dev.length} sentences, Test=${test.length} sentences\n`);

  console.log('[1/4] Evaluating Dev with ORACLE langHint...');
  const devOracle = evaluateCorpus(dev, engine, { langHintPolicy: 'oracle', seed: DEFAULT_SEED, collectDetails: true });

  console.log('[2/4] Evaluating Dev with PRODUCTION (none) langHint...');
  const devProd = evaluateCorpus(dev, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

  console.log('[3/4] Evaluating Test with ORACLE langHint...');
  const testOracle = evaluateCorpus(test, engine, { langHintPolicy: 'oracle', seed: DEFAULT_SEED, collectDetails: true });

  console.log('[4/4] Evaluating Test with PRODUCTION (none) langHint...');
  const testProd = evaluateCorpus(test, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

  const output = {
    commit: 'b04a59b',
    timestamp: new Date().toISOString(),
    devOracle: {
      appliedPrecision: devOracle.overall.appliedPrecision,
      recallD1: devOracle.overall.recallD1,
      cleanFp: devOracle.overall.cleanFp,
      cleanTokens: devOracle.overall.cleanTokens,
      cleanFpr: devOracle.overall.cleanFpr,
      p95Latency: devOracle.latencies.p95,
      en: {
        precision: devOracle.en.appliedPrecision,
        recallD1: devOracle.en.recallD1,
        cleanFp: devOracle.en.cleanFp,
        cleanTokens: devOracle.en.cleanTokens,
        cleanFpr: devOracle.en.cleanFpr,
      },
      fr: {
        precision: devOracle.fr.appliedPrecision,
        recallD1: devOracle.fr.recallD1,
        cleanFp: devOracle.fr.cleanFp,
        cleanTokens: devOracle.fr.cleanTokens,
        cleanFpr: devOracle.fr.cleanFpr,
      },
      cleanFpTokens: devOracle.cleanFpDetails.map(d => ({ token: d.token, replacement: d.replacement, lang: d.lang, id: d.sentenceId, reason: d.reason })),
    },
    devProd: {
      appliedPrecision: devProd.overall.appliedPrecision,
      recallD1: devProd.overall.recallD1,
      cleanFp: devProd.overall.cleanFp,
      cleanTokens: devProd.overall.cleanTokens,
      cleanFpr: devProd.overall.cleanFpr,
      p95Latency: devProd.latencies.p95,
      en: {
        precision: devProd.en.appliedPrecision,
        recallD1: devProd.en.recallD1,
        cleanFp: devProd.en.cleanFp,
        cleanTokens: devProd.en.cleanTokens,
        cleanFpr: devProd.en.cleanFpr,
      },
      fr: {
        precision: devProd.fr.appliedPrecision,
        recallD1: devProd.fr.recallD1,
        cleanFp: devProd.fr.cleanFp,
        cleanTokens: devProd.fr.cleanTokens,
        cleanFpr: devProd.fr.cleanFpr,
      },
      cleanFpTokens: devProd.cleanFpDetails.map(d => ({ token: d.token, replacement: d.replacement, lang: d.lang, id: d.sentenceId, reason: d.reason })),
    },
    testOracle: {
      appliedPrecision: testOracle.overall.appliedPrecision,
      recallD1: testOracle.overall.recallD1,
      cleanFp: testOracle.overall.cleanFp,
      cleanTokens: testOracle.overall.cleanTokens,
      cleanFpr: testOracle.overall.cleanFpr,
      p95Latency: testOracle.latencies.p95,
      en: {
        precision: testOracle.en.appliedPrecision,
        recallD1: testOracle.en.recallD1,
        cleanFp: testOracle.en.cleanFp,
        cleanTokens: testOracle.en.cleanTokens,
        cleanFpr: testOracle.en.cleanFpr,
      },
      fr: {
        precision: testOracle.fr.appliedPrecision,
        recallD1: testOracle.fr.recallD1,
        cleanFp: testOracle.fr.cleanFp,
        cleanTokens: testOracle.fr.cleanTokens,
        cleanFpr: testOracle.fr.cleanFpr,
      },
    },
    testProd: {
      appliedPrecision: testProd.overall.appliedPrecision,
      recallD1: testProd.overall.recallD1,
      cleanFp: testProd.overall.cleanFp,
      cleanTokens: testProd.overall.cleanTokens,
      cleanFpr: testProd.overall.cleanFpr,
      p95Latency: testProd.latencies.p95,
      en: {
        precision: testProd.en.appliedPrecision,
        recallD1: testProd.en.recallD1,
        cleanFp: testProd.en.cleanFp,
        cleanTokens: testProd.en.cleanTokens,
        cleanFpr: testProd.en.cleanFpr,
      },
      fr: {
        precision: testProd.fr.appliedPrecision,
        recallD1: testProd.fr.recallD1,
        cleanFp: testProd.fr.cleanFp,
        cleanTokens: testProd.fr.cleanTokens,
        cleanFpr: testProd.fr.cleanFpr,
      },
    },
  };

  const outPath = 'evidence/b04a59b/baseline-benchmark.json';
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nEvidence written to ${outPath}`);

  console.log('\n========================================================================================');
  console.log('                          BASELINE b04a59b RESULTS SUMMARY                              ');
  console.log('========================================================================================');
  console.log(`Dev ORACLE:     Prec=${output.devOracle.appliedPrecision.toFixed(2)}% | D1 Rec=${output.devOracle.recallD1.toFixed(2)}% | Clean FP=${output.devOracle.cleanFp}/${output.devOracle.cleanTokens} (${output.devOracle.cleanFpr.toFixed(3)}%) | p95=${output.devOracle.p95Latency.toFixed(3)}ms`);
  console.log(`Dev PRODUCTION: Prec=${output.devProd.appliedPrecision.toFixed(2)}% | D1 Rec=${output.devProd.recallD1.toFixed(2)}% | Clean FP=${output.devProd.cleanFp}/${output.devProd.cleanTokens} (${output.devProd.cleanFpr.toFixed(3)}%) | p95=${output.devProd.p95Latency.toFixed(3)}ms`);
  console.log(`Test ORACLE:    Prec=${output.testOracle.appliedPrecision.toFixed(2)}% | D1 Rec=${output.testOracle.recallD1.toFixed(2)}% | Clean FP=${output.testOracle.cleanFp}/${output.testOracle.cleanTokens} (${output.testOracle.cleanFpr.toFixed(3)}%) | p95=${output.testOracle.p95Latency.toFixed(3)}ms`);
  console.log(`Test PRODUCTION:Prec=${output.testProd.appliedPrecision.toFixed(2)}% | D1 Rec=${output.testProd.recallD1.toFixed(2)}% | Clean FP=${output.testProd.cleanFp}/${output.testProd.cleanTokens} (${output.testProd.cleanFpr.toFixed(3)}%) | p95=${output.testProd.p95Latency.toFixed(3)}ms`);
  console.log('========================================================================================\n');
}

main().catch(err => {
  console.error('Error running baseline benchmark:', err);
  process.exit(1);
});
