import fs from 'node:fs';
import { createEngine } from '../engine/engine';
import {
  loadCorpora,
  evaluateCorpus,
  createMulberry32,
  DEFAULT_SEED,
  type SplitMetrics,
} from './lib/eval-harness';
import * as decideModule from '../engine/decide';

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

const ORIGINAL_ALLOWLIST = new Set([
  'npm', 'github', 'ios', 'android', 'lol', 'btw', 'slt', 'mdr', 'stp',
  'html', 'css', 'javascript', 'typescript', 'api', 'json', 'url', 'http',
  'https', 'wifi', 'app', 'email', 'id', 'ip', 'mac', 'linux', 'windows',
  'macbook', 'iphone', 'ipad', 'google', 'microsoft', 'apple', 'amazon',
  'slack', 'notion', 'reddit', 'twitter', 'linkedin', 'facebook', 'youtube',
  'netflix', 'spotify', 'zoom', 'docker', 'react', 'vue', 'vite', 'node',
  'pnpm', 'vitest', 'playwright', 'eslint', 'git', 'cli', 'gui', 'ui', 'ux',
  '3rd', '2nd', '1st', 'co-operate', 'colour', 'color', 'paris', 'québec', 'sncf', 'nasa'
]);

async function main() {
  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const { dev, test } = loadCorpora('.');
  const rng = createMulberry32(NESTED_SPLIT_SEED);
  const shuffledDev = shuffle(dev, rng);
  const splitIdx = Math.floor(shuffledDev.length * 0.80);
  const checkFold = shuffledDev.slice(splitIdx);

  console.log(`Check-fold: ${checkFold.length} sentences.\n`);

  // We want to test on Check-Fold:
  // 1. Current state: No allowlist, Retuned thresholds
  const engineCurrent = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });
  const resCurrent = evaluateCorpus(checkFold, engineCurrent, { langHintPolicy: 'production', seed: DEFAULT_SEED });

  console.log('--- 1. Current State (No Allowlist, Retuned Thresholds) ---');
  console.log(`  Precision: ${resCurrent.overall.appliedPrecision.toFixed(2)}% (EN: ${resCurrent.en.appliedPrecision.toFixed(2)}%, FR: ${resCurrent.fr.appliedPrecision.toFixed(2)}%)`);
  console.log(`  Auto Recall D1: ${resCurrent.overall.recallD1.toFixed(2)}% (${resCurrent.overall.d1Recovered}/${resCurrent.overall.d1Injected})`);
  console.log(`  Combined D1 Recovery: ${resCurrent.overall.combinedRecallD1.toFixed(2)}% (${resCurrent.overall.d1CombinedRecovered}/${resCurrent.overall.d1Injected})`);
  console.log(`  Clean FPR: ${resCurrent.overall.cleanFpr.toFixed(4)}% (${resCurrent.overall.cleanFp}/${resCurrent.overall.cleanTokens})`);

  // Let us see what happens if COMMON_ALLOWLIST is restored into decideModule.COMMON_ALLOWLIST
  // Note: COMMON_ALLOWLIST is exported const Set, we can populate it!
  for (const w of ORIGINAL_ALLOWLIST) {
    decideModule.COMMON_ALLOWLIST.add(w);
  }
  const engineWithAllowlist = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });
  const resWithAllowlist = evaluateCorpus(checkFold, engineWithAllowlist, { langHintPolicy: 'production', seed: DEFAULT_SEED });

  console.log('\n--- 2. Allowlist Restored + Retuned Thresholds ---');
  console.log(`  Precision: ${resWithAllowlist.overall.appliedPrecision.toFixed(2)}% (EN: ${resWithAllowlist.en.appliedPrecision.toFixed(2)}%, FR: ${resWithAllowlist.fr.appliedPrecision.toFixed(2)}%)`);
  console.log(`  Auto Recall D1: ${resWithAllowlist.overall.recallD1.toFixed(2)}% (${resWithAllowlist.overall.d1Recovered}/${resWithAllowlist.overall.d1Injected})`);
  console.log(`  Combined D1 Recovery: ${resWithAllowlist.overall.combinedRecallD1.toFixed(2)}% (${resWithAllowlist.overall.d1CombinedRecovered}/${resWithAllowlist.overall.d1Injected})`);
  console.log(`  Clean FPR: ${resWithAllowlist.overall.cleanFpr.toFixed(4)}% (${resWithAllowlist.overall.cleanFp}/${resWithAllowlist.overall.cleanTokens})`);

  // Clean up allowlist
  decideModule.COMMON_ALLOWLIST.clear();
}

main().catch(console.error);
