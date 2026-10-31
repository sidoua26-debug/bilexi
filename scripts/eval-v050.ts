/**
 * scripts/eval-v050.ts
 *
 * Runs the unified eval-harness on current v0.5.0 engine.
 * Tests:
 * 1. Oracle langHint, with ngram.bin
 * 2. Oracle langHint, without ngram.bin (what bench-engine was running!)
 * 3. Production langHint (none), with ngram.bin
 * 4. Production langHint (none), without ngram.bin
 *
 * Saves raw evidence to evidence/v0.5.0/benchmark.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine';
import { loadCorpora, evaluateCorpus, DEFAULT_SEED } from './lib/eval-harness';

async function main() {
  console.log('========================================================');
  console.log('       EVALUATING v0.5.0 ON UNIFIED EVAL-HARNESS        ');
  console.log('========================================================\n');

  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.existsSync('public/dict/ngram.bin') ? fs.readFileSync('public/dict/ngram.bin') : undefined;

  const { dev, test, sanity } = loadCorpora('.');
  console.log(`Corpora: Dev=${dev.length} sents, Test=${test.length} sents\n`);

  // Engine A: With N-Gram (Full Production Engine)
  const engineWithNgram = createEngine(
    { en: enBuf, fr: frBuf, ngram: ngBuf },
    {
      languageMode: 'auto',
      sensitivity: 'balanced',
      layout: 'auto',
      sentenceCaps: true,
      fixLoneI: true,
    }
  );

  // Engine B: Without N-Gram (What bench-engine previously loaded!)
  const engineWithoutNgram = createEngine(
    { en: enBuf, fr: frBuf },
    {
      languageMode: 'auto',
      sensitivity: 'balanced',
      layout: 'auto',
      sentenceCaps: true,
      fixLoneI: true,
    }
  );

  console.log('--- 1. With N-Gram: Dev Split (Oracle) ---');
  const devWithNgramOracle = evaluateCorpus(dev, engineWithNgram, { langHintPolicy: 'oracle', seed: DEFAULT_SEED, collectDetails: true });

  console.log('--- 2. With N-Gram: Dev Split (Production / None) ---');
  const devWithNgramProd = evaluateCorpus(dev, engineWithNgram, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

  console.log('--- 3. Without N-Gram: Dev Split (Oracle) ---');
  const devNoNgramOracle = evaluateCorpus(dev, engineWithoutNgram, { langHintPolicy: 'oracle', seed: DEFAULT_SEED, collectDetails: true });

  console.log('--- 4. Without N-Gram: Dev Split (Production / None) ---');
  const devNoNgramProd = evaluateCorpus(dev, engineWithoutNgram, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

  console.log('--- 5. With N-Gram: Test Split (Oracle) ---');
  const testWithNgramOracle = evaluateCorpus(test, engineWithNgram, { langHintPolicy: 'oracle', seed: DEFAULT_SEED, collectDetails: true });

  console.log('--- 6. With N-Gram: Test Split (Production / None) ---');
  const testWithNgramProd = evaluateCorpus(test, engineWithNgram, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

  console.log('--- 7. Without N-Gram: Test Split (Oracle) ---');
  const testNoNgramOracle = evaluateCorpus(test, engineWithoutNgram, { langHintPolicy: 'oracle', seed: DEFAULT_SEED, collectDetails: true });

  console.log('--- 8. Without N-Gram: Test Split (Production / None) ---');
  const testNoNgramProd = evaluateCorpus(test, engineWithoutNgram, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

  function extractSplitMetrics(m: any) {
    return {
      appliedPrecision: m.overall.appliedPrecision,
      recallD1: m.overall.recallD1,
      cleanFp: m.overall.cleanFp,
      cleanTokens: m.overall.cleanTokens,
      cleanFpr: m.overall.cleanFpr,
      p95Latency: m.latencies.p95,
      visibleRecallD1: m.overall.visibleRecallD1,
      candidateRecallD1: m.overall.candidateRecallD1,
      combinedRecallD1: m.overall.combinedRecallD1,
      candidateCombinedRecallD1: m.overall.candidateCombinedRecallD1,
      d1TargetWordInjected: m.overall.d1TargetWordInjected,
      d1TargetWordAutoRecovered: m.overall.d1TargetWordAutoRecovered,
      d1TargetWordCombinedRecovered: m.overall.d1TargetWordCombinedRecovered,
      d1TargetWordAutoRecall: m.overall.d1TargetWordAutoRecall,
      d1TargetWordCombinedRecall: m.overall.d1TargetWordCombinedRecall,
      d1OtherWordInjected: m.overall.d1OtherWordInjected,
      d1OtherWordAutoRecovered: m.overall.d1OtherWordAutoRecovered,
      d1OtherWordCombinedRecovered: m.overall.d1OtherWordCombinedRecovered,
      d1OtherWordAutoRecall: m.overall.d1OtherWordAutoRecall,
      d1OtherWordCombinedRecall: m.overall.d1OtherWordCombinedRecall,
      d1NonWordInjected: m.overall.d1NonWordInjected,
      d1NonWordAutoRecovered: m.overall.d1NonWordAutoRecovered,
      d1NonWordCombinedRecovered: m.overall.d1NonWordCombinedRecovered,
      d1NonWordAutoRecall: m.overall.d1NonWordAutoRecall,
      d1NonWordCombinedRecall: m.overall.d1NonWordCombinedRecall,
      d1RealWordInjected: m.overall.d1RealWordInjected,
      d1RealWordAutoRecovered: m.overall.d1RealWordAutoRecovered,
      d1RealWordCombinedRecovered: m.overall.d1RealWordCombinedRecovered,
      d1RealWordAutoRecall: m.overall.d1RealWordAutoRecall,
      d1RealWordCombinedRecall: m.overall.d1RealWordCombinedRecall,
      en: {
        precision: m.en.appliedPrecision,
        recallD1: m.en.recallD1,
        cleanFp: m.en.cleanFp,
        cleanTokens: m.en.cleanTokens,
        cleanFpr: m.en.cleanFpr,
        combinedRecallD1: m.en.combinedRecallD1,
        visibleRecallD1: m.en.visibleRecallD1,
        candidateRecallD1: m.en.candidateRecallD1,
      },
      fr: {
        precision: m.fr.appliedPrecision,
        recallD1: m.fr.recallD1,
        cleanFp: m.fr.cleanFp,
        cleanTokens: m.fr.cleanTokens,
        cleanFpr: m.fr.cleanFpr,
        combinedRecallD1: m.fr.combinedRecallD1,
        visibleRecallD1: m.fr.visibleRecallD1,
        candidateRecallD1: m.fr.candidateRecallD1,
      },
      cleanFpTokens: m.cleanFpDetails,
    };
  }

  const output = {
    version: '0.5.0',
    timestamp: new Date().toISOString(),
    withNgram: {
      devOracle: extractSplitMetrics(devWithNgramOracle),
      devProduction: extractSplitMetrics(devWithNgramProd),
      testOracle: extractSplitMetrics(testWithNgramOracle),
      testProduction: extractSplitMetrics(testWithNgramProd),
    },
    withoutNgram: {
      devOracle: extractSplitMetrics(devNoNgramOracle),
      devProduction: extractSplitMetrics(devNoNgramProd),
      testOracle: extractSplitMetrics(testNoNgramOracle),
      testProduction: extractSplitMetrics(testNoNgramProd),
    },
  };

  const outPath = 'evidence/v0.5.0/benchmark.json';
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\nEvidence written to ${outPath}`);

  console.log('\n========================================================================================');
  console.log('                          v0.5.0 BENCHMARK COMPARISON TABLE                             ');
  console.log('========================================================================================');
  console.log('Condition                     | Precision | D1 Recall | Clean FP (Count / Total) | Clean FPR');
  console.log('------------------------------+-----------+-----------+--------------------------+----------');
  console.log(`Dev WITH Ngram (Oracle)       | ${output.withNgram.devOracle.appliedPrecision.toFixed(2)}%    | ${output.withNgram.devOracle.recallD1.toFixed(2)}%    | ${output.withNgram.devOracle.cleanFp} / ${output.withNgram.devOracle.cleanTokens}          | ${output.withNgram.devOracle.cleanFpr.toFixed(3)}%`);
  console.log(`Dev WITH Ngram (Production)   | ${output.withNgram.devProduction.appliedPrecision.toFixed(2)}%    | ${output.withNgram.devProduction.recallD1.toFixed(2)}%    | ${output.withNgram.devProduction.cleanFp} / ${output.withNgram.devProduction.cleanTokens}          | ${output.withNgram.devProduction.cleanFpr.toFixed(3)}%`);
  console.log(`Dev NO Ngram (Oracle)         | ${output.withoutNgram.devOracle.appliedPrecision.toFixed(2)}%    | ${output.withoutNgram.devOracle.recallD1.toFixed(2)}%    | ${output.withoutNgram.devOracle.cleanFp} / ${output.withoutNgram.devOracle.cleanTokens}          | ${output.withoutNgram.devOracle.cleanFpr.toFixed(3)}%`);
  console.log(`Dev NO Ngram (Production)     | ${output.withoutNgram.devProduction.appliedPrecision.toFixed(2)}%    | ${output.withoutNgram.devProduction.recallD1.toFixed(2)}%    | ${output.withoutNgram.devProduction.cleanFp} / ${output.withoutNgram.devProduction.cleanTokens}          | ${output.withoutNgram.devProduction.cleanFpr.toFixed(3)}%`);
  console.log('------------------------------+-----------+-----------+--------------------------+----------');
  console.log(`Test WITH Ngram (Oracle)      | ${output.withNgram.testOracle.appliedPrecision.toFixed(2)}%    | ${output.withNgram.testOracle.recallD1.toFixed(2)}%    | ${output.withNgram.testOracle.cleanFp} / ${output.withNgram.testOracle.cleanTokens}           | ${output.withNgram.testOracle.cleanFpr.toFixed(3)}%`);
  console.log(`Test WITH Ngram (Production)  | ${output.withNgram.testProduction.appliedPrecision.toFixed(2)}%    | ${output.withNgram.testProduction.recallD1.toFixed(2)}%    | ${output.withNgram.testProduction.cleanFp} / ${output.withNgram.testProduction.cleanTokens}           | ${output.withNgram.testProduction.cleanFpr.toFixed(3)}%`);
  console.log(`Test NO Ngram (Oracle)        | ${output.withoutNgram.testOracle.appliedPrecision.toFixed(2)}%    | ${output.withoutNgram.testOracle.recallD1.toFixed(2)}%    | ${output.withoutNgram.testOracle.cleanFp} / ${output.withoutNgram.testOracle.cleanTokens}           | ${output.withoutNgram.testOracle.cleanFpr.toFixed(3)}%`);
  console.log(`Test NO Ngram (Production)    | ${output.withoutNgram.testProduction.appliedPrecision.toFixed(2)}%    | ${output.withoutNgram.testProduction.recallD1.toFixed(2)}%    | ${output.withoutNgram.testProduction.cleanFp} / ${output.withoutNgram.testProduction.cleanTokens}           | ${output.withoutNgram.testProduction.cleanFpr.toFixed(3)}%`);
  console.log('========================================================================================\n');
}

main().catch(err => {
  console.error('Error evaluating v0.5.0:', err);
  process.exit(1);
});
