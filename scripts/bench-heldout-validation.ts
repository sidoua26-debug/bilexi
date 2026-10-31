/**
 * scripts/bench-heldout-validation.ts
 * Evaluates improved engine on the independent held-out validation corpus (10,000 sentences).
 */

import fs from 'node:fs';
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

function createTypoInjector(seed: number) {
  const rng = createMulberry32(seed);
  return function injectTypo(word: string, isFr: boolean): TypoResult | null {
    if (word.length < 3) return null;
    const neighbors = isFr ? AZERTY_NEIGHBORS : QWERTY_NEIGHBORS;
    const rand = rng();

    if (isFr && rand < 0.10) {
      const folded = fold(word);
      if (folded !== word) {
        return { noisy: folded, type: 'accent-drop', distance: 1 };
      }
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

    return null;
  };
}

async function main() {
  const enBuffer = fs.readFileSync('public/dict/en.bin');
  const frBuffer = fs.readFileSync('public/dict/fr.bin');
  const ngramBuffer = fs.readFileSync('public/dict/ngram.bin');

  const heldoutRaw = JSON.parse(fs.readFileSync('data/raw/heldout-val-sentences.json', 'utf-8'));
  const corpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];

  for (const [id, text] of Object.entries(heldoutRaw.en as Record<string, string>)) {
    corpus.push({ id, text, lang: 'en' });
  }
  for (const [id, text] of Object.entries(heldoutRaw.fr as Record<string, string>)) {
    corpus.push({ id, text, lang: 'fr' });
  }

  console.log(`Loaded ${corpus.length} held-out validation sentences.`);

  const engine = createEngine({
    en: enBuffer.buffer.slice(enBuffer.byteOffset, enBuffer.byteOffset + enBuffer.byteLength),
    fr: frBuffer.buffer.slice(frBuffer.byteOffset, frBuffer.byteOffset + frBuffer.byteLength),
    ngram: ngramBuffer.buffer.slice(ngramBuffer.byteOffset, ngramBuffer.byteOffset + ngramBuffer.byteLength),
  });

  const rngNoise = createMulberry32(SEED);
  const injectTypo = createTypoInjector(SEED);

  let cleanTokens = 0, cleanFp = 0;
  let cleanTokensEn = 0, cleanFpEn = 0;
  let cleanTokensFr = 0, cleanFpFr = 0;

  let replacements = 0, repEn = 0, repFr = 0;
  let truePositives = 0, tpEn = 0, tpFr = 0;
  let d1Injected = 0, d1InjectedEn = 0, d1InjectedFr = 0;
  let d1Recovered = 0, d1RecoveredEn = 0, d1RecoveredFr = 0;
  const latencies: number[] = [];

  // 1. Clean pass
  for (const item of corpus) {
    const isFr = item.lang === 'fr';
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const rawToken of rawTokens) {
      if (rawToken.length < 2) continue;
      cleanTokens++;
      if (isFr) cleanTokensFr++; else cleanTokensEn++;

      const t0 = performance.now();
      const decision = engine.analyze({
        token: rawToken,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });
      latencies.push(performance.now() - t0);

      if (decision.action === 'replace' && decision.replacement.toLowerCase() !== rawToken.toLowerCase()) {
        cleanFp++;
        if (isFr) cleanFpFr++; else cleanFpEn++;
      }

      leftContext.push(rawToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  // 2. Noisy pass
  for (const item of corpus) {
    const isFr = item.lang === 'fr';
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const token of rawTokens) {
      if (token.length < 3) continue;

      const inject = rngNoise() < 0.083;
      let tokenToEval = token;
      let typoMeta: TypoResult | null = null;

      if (inject) {
        typoMeta = injectTypo(token, isFr);
        if (typoMeta && typoMeta.distance === 1) {
          d1Injected++;
          if (isFr) d1InjectedFr++; else d1InjectedEn++;
          tokenToEval = typoMeta.noisy;
        }
      }

      const t0 = performance.now();
      const decision = engine.analyze({
        token: tokenToEval,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });
      latencies.push(performance.now() - t0);

      if (decision.action === 'replace') {
        replacements++;
        if (isFr) repFr++; else repEn++;
        if (typoMeta && decision.replacement.toLowerCase() === token.toLowerCase()) {
          truePositives++;
          if (isFr) tpFr++; else tpEn++;
          if (typoMeta.distance === 1) {
            d1Recovered++;
            if (isFr) d1RecoveredFr++; else d1RecoveredEn++;
          }
        }
      }

      leftContext.push(tokenToEval);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  const results = {
    precisionOverall: (truePositives / (replacements || 1)) * 100,
    precisionEn: (tpEn / (repEn || 1)) * 100,
    precisionFr: (tpFr / (repFr || 1)) * 100,
    recallD1Overall: (d1Recovered / (d1Injected || 1)) * 100,
    recallD1En: (d1RecoveredEn / (d1InjectedEn || 1)) * 100,
    recallD1Fr: (d1RecoveredFr / (d1InjectedFr || 1)) * 100,
    cleanFprOverall: (cleanFp / (cleanTokens || 1)) * 100,
    cleanFprEn: (cleanFpEn / (cleanTokensEn || 1)) * 100,
    cleanFprFr: (cleanFpFr / (cleanTokensFr || 1)) * 100,
    truePositives,
    tpEn,
    tpFr,
    replacements,
    repEn,
    repFr,
    d1Recovered,
    d1RecoveredEn,
    d1RecoveredFr,
    d1Injected,
    d1InjectedEn,
    d1InjectedFr,
    cleanFp,
    cleanFpEn,
    cleanFpFr,
    cleanTokens,
    cleanTokensEn,
    cleanTokensFr,
    p50Ms: p50,
    p95Ms: p95,
  };

  console.log('Held-out Validation Results (10,000 sentences):', JSON.stringify(results, null, 2));
}

main().catch(console.error);
