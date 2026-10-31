import fs from 'node:fs';
import { createEngine } from '../engine/engine';
import {
  loadCorpora,
  evaluateCorpus,
  createMulberry32,
  DEFAULT_SEED,
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

  const { dev } = loadCorpora('.');
  const rng = createMulberry32(NESTED_SPLIT_SEED);
  const shuffledDev = shuffle(dev, rng);
  const splitIdx = Math.floor(shuffledDev.length * 0.80);
  const checkFold = shuffledDev.slice(splitIdx);

  console.log(`Check-fold sentences: ${checkFold.length}\n`);

  interface Config {
    name: string;
    allowlist: boolean;
    thresholds: Record<string, number>;
  }

  // Configurations to test:
  // 1. Allowlist-removal alone (No allowlist, Original thresholds: minMargin=1.3, shortMargin=2.1, no conf gate)
  // 2. Threshold-retune alone (With allowlist, Retuned thresholds: minMargin=1.3, shortMargin=2.1, conf gate active)
  // 3. Both (Current state: No allowlist, Retuned thresholds)
  // 4. Reference Baseline (With allowlist, Original thresholds)
  // 5. Pre-calibration Baseline (With allowlist, minMargin=0: No margin gating)

  const configs: Config[] = [
    {
      name: 'Ref: With Allowlist + Original Thresholds (margin>=1.3, short>=2.1, no conf-gate)',
      allowlist: true,
      thresholds: { minMargin: 1.3, shortMargin: 2.1, useConfidenceGate: 0 },
    },
    {
      name: 'Ablation 1: Allowlist Removal Alone (No allowlist, Original Thresholds)',
      allowlist: false,
      thresholds: { minMargin: 1.3, shortMargin: 2.1, useConfidenceGate: 0 },
    },
    {
      name: 'Ablation 2: Threshold Retune Alone (With allowlist, Retuned Thresholds: conf-gate active)',
      allowlist: true,
      thresholds: { minMargin: 1.3, shortMargin: 2.1, useConfidenceGate: 1 },
    },
    {
      name: 'Ablation 3: Both (Current: No allowlist, Retuned Thresholds)',
      allowlist: false,
      thresholds: { minMargin: 1.3, shortMargin: 2.1, useConfidenceGate: 1 },
    },
    {
      name: 'Pre-Calibration: With Allowlist + No Margin Gating (Sprint 4 Baseline)',
      allowlist: true,
      thresholds: { minMargin: 0.0, shortMargin: 0.0, useConfidenceGate: 0 },
    },
  ];

  for (const cfg of configs) {
    if (cfg.allowlist) {
      for (const w of ORIGINAL_ALLOWLIST) decideModule.COMMON_ALLOWLIST.add(w);
    } else {
      decideModule.COMMON_ALLOWLIST.clear();
    }

    const engine = createEngine(
      { en: enBuf, fr: frBuf, ngram: ngBuf },
      { thresholdOverrides: cfg.thresholds }
    );

    const res = evaluateCorpus(checkFold, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED });

    console.log(`=== ${cfg.name} ===`);
    console.log(`  Applied Precision: ${res.overall.appliedPrecision.toFixed(2)}% (EN: ${res.en.appliedPrecision.toFixed(2)}%, FR: ${res.fr.appliedPrecision.toFixed(2)}%)`);
    console.log(`  Auto Recall D1:    ${res.overall.recallD1.toFixed(2)}% (${res.overall.d1Recovered}/${res.overall.d1Injected})`);
    console.log(`  Combined D1 Rec:   ${res.overall.combinedRecallD1.toFixed(2)}% (${res.overall.d1CombinedRecovered}/${res.overall.d1Injected})`);
    console.log(`  Clean FPR:         ${res.overall.cleanFpr.toFixed(4)}% (${res.overall.cleanFp}/${res.overall.cleanTokens})\n`);
  }
}

main().catch(console.error);
