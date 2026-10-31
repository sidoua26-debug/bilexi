/**
 * scripts/bench-context-comparison.ts
 * Rigorous comparison of 3 models on the untouched Pristine Held-Out Test Set (10,000 sentences):
 * 1. Current Baseline Engine (No Context)
 * 2. Context-Aware Engine (Bigram Re-ranking)
 * 3. Context-Aware Engine with Confidence-Aware Gate
 */

import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine';
import { fold } from '../engine/normalize';

const SEED = 20261016;

function createMulberry32(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const QWERTY_NEIGHBORS: Record<string, string[]> = {
  a: ['q', 'w', 's', 'z'], b: ['v', 'g', 'h', 'n'], c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'], e: ['w', 's', 'd', 'r'], f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'], h: ['g', 'y', 'u', 'j', 'n', 'b'], i: ['u', 'j', 'k', 'o'],
  j: ['h', 'u', 'i', 'k', 'm', 'n'], k: ['j', 'i', 'o', 'l', 'm'], l: ['k', 'o', 'p'],
  m: ['n', 'j', 'k'], n: ['b', 'h', 'j', 'm'], o: ['i', 'k', 'l', 'p'], p: ['o', 'l'],
  q: ['w', 'a'], r: ['e', 'd', 'f', 't'], s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'f', 'g', 'y'], u: ['y', 'h', 'j', 'i'], v: ['c', 'f', 'g', 'b'],
  w: ['q', 'a', 's', 'e'], x: ['z', 's', 'd', 'c'], y: ['t', 'g', 'h', 'u'], z: ['a', 's', 'x'],
};

const AZERTY_NEIGHBORS: Record<string, string[]> = {
  a: ['z', 'q'], b: ['v', 'g', 'h', 'n'], c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'], e: ['z', 's', 'd', 'r'], f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'], h: ['g', 'y', 'u', 'j', 'n', 'b'], i: ['u', 'j', 'k', 'o'],
  j: ['h', 'u', 'i', 'k', 'n'], k: ['j', 'i', 'o', 'l'], l: ['k', 'o', 'p', 'm'],
  m: ['l', 'p'], n: ['b', 'h', 'j'], o: ['i', 'k', 'l', 'p'], p: ['o', 'l', 'm'],
  q: ['a', 'z', 's', 'w'], r: ['e', 'd', 'f', 't'], s: ['q', 'z', 'e', 'd', 'x', 'w'],
  t: ['r', 'f', 'g', 'y'], u: ['y', 'h', 'j', 'i'], v: ['c', 'f', 'g', 'b'],
  w: ['q', 's', 'x'], x: ['w', 's', 'd', 'c'], y: ['t', 'g', 'h', 'u'], z: ['a', 'q', 's', 'e'],
};

interface TypoResult {
  noisy: string;
  type: 'substitution' | 'transposition' | 'omission' | 'duplication' | 'accent-drop' | 'distance-2';
  distance: 1 | 2;
}

function createTypoInjector(rng: () => number) {
  return function injectTypo(word: string, isFr: boolean): TypoResult | null {
    if (word.length < 3) return null;
    const neighbors = isFr ? AZERTY_NEIGHBORS : QWERTY_NEIGHBORS;
    const rand = rng();

    if (isFr && rand < 0.10) {
      const folded = fold(word);
      if (folded !== word) return { noisy: folded, type: 'accent-drop', distance: 1 };
    }

    if (rand < 0.35 && word.length >= 4) {
      const idx = 1 + Math.floor(rng() * (word.length - 2));
      const chars = word.split('');
      const temp = chars[idx]!;
      chars[idx] = chars[idx + 1]!;
      chars[idx + 1] = temp;
      const noisy = chars.join('');
      if (noisy !== word) return { noisy, type: 'transposition', distance: 1 };
    }

    if (rand < 0.65) {
      const idx = 1 + Math.floor(rng() * (word.length - 1));
      const char = word[idx]!.toLowerCase();
      const list = neighbors[char];
      if (list && list.length > 0) {
        const sub = list[Math.floor(rng() * list.length)]!;
        const noisy = word.slice(0, idx) + sub + word.slice(idx + 1);
        return { noisy, type: 'substitution', distance: 1 };
      }
    }

    if (rand < 0.85 && word.length >= 4) {
      const idx = 1 + Math.floor(rng() * (word.length - 1));
      const noisy = word.slice(0, idx) + word.slice(idx + 1);
      return { noisy, type: 'omission', distance: 1 };
    }

    if (rand < 0.95 && word.length >= 4) {
      const idx = 1 + Math.floor(rng() * (word.length - 1));
      const char = word[idx]!;
      const noisy = word.slice(0, idx) + char + word.slice(idx);
      return { noisy, type: 'duplication', distance: 1 };
    }

    if (word.length >= 5) {
      const idx1 = 1;
      const idx2 = word.length - 2;
      const char1 = word[idx1]!.toLowerCase();
      const list1 = neighbors[char1] || ['e', 's', 'a'];
      const sub1 = list1[Math.floor(rng() * list1.length)]!;
      const intermediate = word.slice(0, idx1) + sub1 + word.slice(idx1 + 1);
      const noisy = intermediate.slice(0, idx2) + intermediate.slice(idx2 + 1);
      return { noisy, type: 'distance-2', distance: 2 };
    }

    return null;
  };
}

function evaluate(engine: any, corpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }>, name: string) {
  const rng = createMulberry32(SEED);
  const injectTypo = createTypoInjector(rng);

  let cleanTokens = 0, cleanTokensEn = 0, cleanTokensFr = 0;
  let cleanFp = 0, cleanFpEn = 0, cleanFpFr = 0;

  // Clean pass
  for (const item of corpus) {
    const isFr = item.lang === 'fr';
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const rawToken of rawTokens) {
      if (rawToken.length < 2) continue;
      cleanTokens++;
      if (isFr) cleanTokensFr++; else cleanTokensEn++;

      const decision = engine.analyze({
        token: rawToken,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });

      if (decision.action === 'replace') {
        if (decision.replacement.toLowerCase() !== rawToken.toLowerCase()) {
          cleanFp++;
          if (isFr) cleanFpFr++; else cleanFpEn++;
        }
      }

      leftContext.push(rawToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  // Noisy pass
  let replacements = 0;
  let totalEvaluated = 0;
  let tpOverall = 0, tpEn = 0, tpFr = 0;
  let d1InjectedOverall = 0, d1InjectedEn = 0, d1InjectedFr = 0;
  let d1RecoveredOverall = 0, d1RecoveredEn = 0, d1RecoveredFr = 0;
  let repEn = 0, repFr = 0;
  let realWordCollisions = 0;
  const latencies: number[] = [];

  for (const item of corpus) {
    const isFr = item.lang === 'fr';
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const token of rawTokens) {
      if (token.length < 3) continue;
      totalEvaluated++;

      const inject = rng() < 0.083;
      let tokenToEvaluate = token;
      let typoMeta: TypoResult | null = null;

      if (inject) {
        typoMeta = injectTypo(token, isFr);
        if (typoMeta) {
          tokenToEvaluate = typoMeta.noisy;
          if (typoMeta.distance === 1) {
            d1InjectedOverall++;
            if (isFr) d1InjectedFr++; else d1InjectedEn++;
          }
        }
      }

      const t0 = performance.now();
      const decision = engine.analyze({
        token: tokenToEvaluate,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });
      latencies.push(performance.now() - t0);

      if (decision.action === 'replace') {
        replacements++;
        if (isFr) repFr++; else repEn++;
        const rep = decision.replacement.toLowerCase();
        const expected = token.toLowerCase();

        if (typoMeta && rep === expected) {
          tpOverall++;
          if (isFr) tpFr++; else tpEn++;
          if (typoMeta.distance === 1) {
            d1RecoveredOverall++;
            if (isFr) d1RecoveredFr++; else d1RecoveredEn++;
          }
        }
      }

      leftContext.push(tokenToEvaluate);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  return {
    name,
    precisionOverall: (tpOverall / (replacements || 1)) * 100,
    precisionEn: (tpEn / (repEn || 1)) * 100,
    precisionFr: (tpFr / (repFr || 1)) * 100,
    recallD1Overall: (d1RecoveredOverall / (d1InjectedOverall || 1)) * 100,
    recallD1En: (d1RecoveredEn / (d1InjectedEn || 1)) * 100,
    recallD1Fr: (d1RecoveredFr / (d1InjectedFr || 1)) * 100,
    cleanFprOverall: (cleanFp / (cleanTokens || 1)) * 100,
    cleanFprEn: (cleanFpEn / (cleanTokensEn || 1)) * 100,
    cleanFprFr: (cleanFpFr / (cleanTokensFr || 1)) * 100,
    replacements,
    cleanFp,
    cleanTokens,
    d1InjectedOverall,
    d1RecoveredOverall,
    p95LatencyMs: p95,
  };
}

async function main() {
  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const pristine = JSON.parse(fs.readFileSync('data/raw/pristine-test-sentences.json', 'utf-8'));
  const corpus = [
    ...Object.entries(pristine.en as Record<string, string>).map(([id, text]) => ({ id, text, lang: 'en' as const })),
    ...Object.entries(pristine.fr as Record<string, string>).map(([id, text]) => ({ id, text, lang: 'fr' as const })),
  ];

  console.log(`Evaluating 3 Model Variants on Pristine Held-Out Test Split (${corpus.length} sentences)...`);

  // Variant 1: Baseline (No context)
  console.log('\n[1/3] Running Variant 1: Current Baseline (No Context)...');
  const eng1 = createEngine({ en: enBuf, fr: frBuf });
  const r1 = evaluate(eng1, corpus, '1. Current Baseline (No Context)');

  // Variant 2: Context-Aware (Bigram Re-ranking)
  console.log('\n[2/3] Running Variant 2: Context-Aware Model (Bigram Re-ranking)...');
  const eng2 = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });
  const r2 = evaluate(eng2, corpus, '2. Context-Aware (Bigram Re-ranking)');

  // Variant 3: Context-Aware with Confidence Gate (tau=0.95, minF=18)
  console.log('\n[3/3] Running Variant 3: Context-Aware with Confidence Gate (tau=0.95, minF=18)...');
  const eng3 = createEngine(
    { en: enBuf, fr: frBuf, ngram: ngBuf },
    { thresholdOverrides: { tauMargin: 0.95, minFrequency: 18 } }
  );
  const r3 = evaluate(eng3, corpus, '3. Context-Aware + Confidence Gate');

  const all = [r1, r2, r3];
  console.log('\n========================================================================================================');
  console.log('                          PRISTINE HELD-OUT TEST EVALUATION (10,000 SENTENCES)                           ');
  console.log('========================================================================================================');
  console.log('Model Variant                        | Precision (All/EN/FR) | Recall D1 (All/EN/FR) | Clean FPR | Repls | Latency p95');
  console.log('-------------------------------------+-----------------------+-----------------------+-----------+-------+------------');
  for (const r of all) {
    const prec = `${r.precisionOverall.toFixed(2)} / ${r.precisionEn.toFixed(2)} / ${r.precisionFr.toFixed(2)}%`;
    const rec = `${r.recallD1Overall.toFixed(2)} / ${r.recallD1En.toFixed(2)} / ${r.recallD1Fr.toFixed(2)}%`;
    const fpr = `${r.cleanFprOverall.toFixed(3)}%`;
    const lat = `${r.p95LatencyMs.toFixed(3)} ms`;
    console.log(`${r.name.padEnd(36)} | ${prec.padEnd(21)} | ${rec.padEnd(21)} | ${fpr.padEnd(9)} | ${String(r.replacements).padStart(5)} | ${lat}`);
  }
  console.log('========================================================================================================\n');

  fs.writeFileSync('docs/MODEL-COMPARISON.json', JSON.stringify(all, null, 2));
}

main().catch(console.error);
