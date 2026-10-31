import fs from 'node:fs';
import { createEngine } from '../engine/engine';
import { loadCorpora, evaluateCorpus, DEFAULT_SEED } from './lib/eval-harness';

async function main() {
  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const { dev } = loadCorpora('.');
  const engine = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });

  console.log('Evaluating Dev split with updated eval-harness and engine:');
  const res = evaluateCorpus(dev, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED });

  const o = res.overall;
  console.log('\n--- HEADLINE METRICS ---');
  console.log(`Applied Precision: ${o.appliedPrecision.toFixed(2)}% (TP=${o.truePositives}, Replacements=${o.replacements})`);
  console.log(`Distance-1 Auto Recall: ${o.recallD1.toFixed(2)}% (${o.d1Recovered}/${o.d1Injected})`);
  console.log(`Clean-Token FPR: ${o.cleanFpr.toFixed(4)}% (${o.cleanFp}/${o.cleanTokens})`);
  console.log(`Stream Latency p95: ${res.latencies.p95.toFixed(3)} ms`);

  console.log('\n--- TWO-TIER METRICS (WP 2) ---');
  console.log(`Auto Recall D1: ${o.recallD1.toFixed(2)}%`);
  console.log(`Visible Suggestion Recall D1 (Slots 2 & 3): ${o.visibleRecallD1.toFixed(2)}%`);
  console.log(`Combined Visible Recall D1 (Auto + Visible): ${o.combinedRecallD1.toFixed(2)}%`);
  console.log(`Candidate Suggestion Recall D1 (All 3 Suggs): ${o.candidateRecallD1.toFixed(2)}%`);
  console.log(`Combined Candidate Recall D1 (Auto + All 3 Suggs): ${o.candidateCombinedRecallD1.toFixed(2)}%`);

  console.log('\n--- MUTUALLY EXCLUSIVE D1 TYPO CATEGORIES (WP 1) ---');
  console.log(`Total Injected D1: ${o.d1Injected}`);
  console.log(`  1. Target Word: Injected=${o.d1TargetWordInjected}, AutoRecovered=${o.d1TargetWordAutoRecovered} (${o.d1TargetWordAutoRecall.toFixed(2)}%), CombinedRecovered=${o.d1TargetWordCombinedRecovered} (${o.d1TargetWordCombinedRecall.toFixed(2)}%)`);
  console.log(`  2. Other-Only Word: Injected=${o.d1OtherWordInjected}, AutoRecovered=${o.d1OtherWordAutoRecovered} (${o.d1OtherWordAutoRecall.toFixed(2)}%), CombinedRecovered=${o.d1OtherWordCombinedRecovered} (${o.d1OtherWordCombinedRecall.toFixed(2)}%)`);
  console.log(`  3. Genuine Non-Word: Injected=${o.d1NonWordInjected}, AutoRecovered=${o.d1NonWordAutoRecovered} (${o.d1NonWordAutoRecall.toFixed(2)}%), CombinedRecovered=${o.d1NonWordCombinedRecovered} (${o.d1NonWordCombinedRecall.toFixed(2)}%)`);
  console.log(`Sum of Categories: ${o.d1TargetWordInjected + o.d1OtherWordInjected + o.d1NonWordInjected} === ${o.d1Injected}`);
}

main().catch(console.error);
