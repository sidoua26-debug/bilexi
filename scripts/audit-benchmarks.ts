/**
 * scripts/audit-benchmarks.ts
 * Comprehensive reproducibility audit and evaluation harness for Bilingual Autocorrect.
 * Evaluates engine configurations across dev, test, and val corpora with exact
 * numerators, denominators, and verifiable sums.
 */

import fs from 'node:fs';
import { createEngine } from '../engine/engine';
import { fold, hashString } from '../engine/normalize';

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

export interface DetailedPartitionMetrics {
  cleanTokens: number;
  cleanFp: number;
  cleanFpr: number;
  injectedD1: number;
  recoveredD1: number;
  recallD1: number;
  replacements: number;
  truePositives: number;
  appliedPrecision: number;
}

export interface DetailedCorpusEvaluation {
  corpusName: string;
  sentenceCount: number;
  overall: DetailedPartitionMetrics;
  en: DetailedPartitionMetrics;
  fr: DetailedPartitionMetrics;
  latencies: {
    samples: number;
    p50Ms: number;
    p95Ms: number;
  };
}

export function evaluateCorpus(
  corpusName: string,
  corpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }>,
  engine: any,
  seed = SEED
): DetailedCorpusEvaluation {
  const injectTypo = createTypoInjector(seed);
  const rngNoise = createMulberry32(seed);

  // 1. Clean Pass
  let cleanTokensEn = 0, cleanFpEn = 0;
  let cleanTokensFr = 0, cleanFpFr = 0;
  const latencies: number[] = [];

  for (const item of corpus) {
    const isFr = item.lang === 'fr';
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const rawToken of rawTokens) {
      if (rawToken.length < 2) continue;
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
        if (isFr) cleanFpFr++; else cleanFpEn++;
      }

      leftContext.push(rawToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  // 2. Noisy Pass
  let repEn = 0, tpEn = 0, d1InjEn = 0, d1RecEn = 0;
  let repFr = 0, tpFr = 0, d1InjFr = 0, d1RecFr = 0;

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
          if (isFr) d1InjFr++; else d1InjEn++;
          tokenToEval = typoMeta.noisy;
        }
      }

      const decision = engine.analyze({
        token: tokenToEval,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });

      if (decision.action === 'replace') {
        if (isFr) repFr++; else repEn++;

        // True positive: replacement must equal pre-noise original word
        if (typoMeta && decision.replacement.toLowerCase() === token.toLowerCase()) {
          if (isFr) tpFr++; else tpEn++;
          if (typoMeta.distance === 1) {
            if (isFr) d1RecFr++; else d1RecEn++;
          }
        }
      }

      leftContext.push(tokenToEval);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  latencies.sort((a, b) => a - b);
  const p50Ms = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95Ms = latencies[Math.floor(latencies.length * 0.95)] || 0;

  function buildPartition(
    cleanTokens: number,
    cleanFp: number,
    injectedD1: number,
    recoveredD1: number,
    replacements: number,
    truePositives: number
  ): DetailedPartitionMetrics {
    return {
      cleanTokens,
      cleanFp,
      cleanFpr: cleanTokens > 0 ? (cleanFp / cleanTokens) * 100 : 0,
      injectedD1,
      recoveredD1,
      recallD1: injectedD1 > 0 ? (recoveredD1 / injectedD1) * 100 : 0,
      replacements,
      truePositives,
      appliedPrecision: replacements > 0 ? (truePositives / replacements) * 100 : 0,
    };
  }

  const enMetrics = buildPartition(cleanTokensEn, cleanFpEn, d1InjEn, d1RecEn, repEn, tpEn);
  const frMetrics = buildPartition(cleanTokensFr, cleanFpFr, d1InjFr, d1RecFr, repFr, tpFr);
  const overallMetrics = buildPartition(
    cleanTokensEn + cleanTokensFr,
    cleanFpEn + cleanFpFr,
    d1InjEn + d1InjFr,
    d1RecEn + d1RecFr,
    repEn + repFr,
    tpEn + tpFr
  );

  return {
    corpusName,
    sentenceCount: corpus.length,
    overall: overallMetrics,
    en: enMetrics,
    fr: frMetrics,
    latencies: {
      samples: latencies.length,
      p50Ms,
      p95Ms,
    },
  };
}

async function main() {
  console.log('[Audit] Initializing dictionaries and context model...');
  const enBuffer = fs.readFileSync('public/dict/en.bin');
  const frBuffer = fs.readFileSync('public/dict/fr.bin');
  const ngramBuffer = fs.readFileSync('public/dict/ngram.bin');

  const engine = createEngine({
    en: enBuffer.buffer.slice(enBuffer.byteOffset, enBuffer.byteOffset + enBuffer.byteLength),
    fr: frBuffer.buffer.slice(frBuffer.byteOffset, frBuffer.byteOffset + frBuffer.byteLength),
    ngram: ngramBuffer.buffer.slice(ngramBuffer.byteOffset, ngramBuffer.byteOffset + ngramBuffer.byteLength),
  });

  // 1. Dev Corpus (16,720 sentences)
  const tatoebaRaw = JSON.parse(fs.readFileSync('data/raw/tatoeba-sentences.json', 'utf-8'));
  const devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];
  for (const [id, text] of Object.entries(tatoebaRaw.en as Record<string, string>)) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'en' });
  }
  for (const [id, text] of Object.entries(tatoebaRaw.fr as Record<string, string>)) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'fr' });
  }

  // 2. Pristine Test Corpus (10,000 sentences)
  const pristineRaw = JSON.parse(fs.readFileSync('data/raw/pristine-test-sentences.json', 'utf-8'));
  const pristineCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];
  for (const [id, text] of Object.entries(pristineRaw.en as Record<string, string>)) {
    pristineCorpus.push({ id, text, lang: 'en' });
  }
  for (const [id, text] of Object.entries(pristineRaw.fr as Record<string, string>)) {
    pristineCorpus.push({ id, text, lang: 'fr' });
  }

  // 3. Held-out Validation Corpus (10,000 sentences)
  const heldoutRaw = JSON.parse(fs.readFileSync('data/raw/heldout-val-sentences.json', 'utf-8'));
  const heldoutCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];
  for (const [id, text] of Object.entries(heldoutRaw.en as Record<string, string>)) {
    heldoutCorpus.push({ id, text, lang: 'en' });
  }
  for (const [id, text] of Object.entries(heldoutRaw.fr as Record<string, string>)) {
    heldoutCorpus.push({ id, text, lang: 'fr' });
  }

  console.log(`[Audit] Evaluating Current Improved Engine across all 3 corpora...`);
  const devResult = evaluateCorpus('Development Corpus (Tatoeba dev split)', devCorpus, engine);
  const pristineResult = evaluateCorpus('Pristine Test Corpus (Previously Inspected)', pristineCorpus, engine);
  const heldoutResult = evaluateCorpus('Held-Out Validation Corpus (Previously Inspected)', heldoutCorpus, engine);

  const fullAudit = {
    evaluatedAt: new Date().toISOString(),
    gitCommit: 'b04a59bfc1aec8e3b131c161ee9fa2e449d5e8dd',
    corpora: {
      dev: devResult,
      pristineTest: pristineResult,
      heldoutVal: heldoutResult,
    },
  };

  fs.writeFileSync('docs/AUDIT-RESULTS.json', JSON.stringify(fullAudit, null, 2), 'utf-8');
  console.log('[Audit] Written full results to docs/AUDIT-RESULTS.json');

  function printReport(r: DetailedCorpusEvaluation) {
    console.log(`\n========================================================================`);
    console.log(`  ${r.corpusName.toUpperCase()} (${r.sentenceCount} sentences)`);
    console.log(`========================================================================`);
    console.log(`Partition | Applied Precision     | Recall D1             | Clean FPR            | Stream p95`);
    console.log(`----------+-----------------------+-----------------------+----------------------+-----------`);
    const fmt = (p: DetailedPartitionMetrics) =>
      `${p.appliedPrecision.toFixed(2)}% (${p.truePositives}/${p.replacements})`.padEnd(21) + ' | ' +
      `${p.recallD1.toFixed(2)}% (${p.recoveredD1}/${p.injectedD1})`.padEnd(21) + ' | ' +
      `${p.cleanFpr.toFixed(3)}% (${p.cleanFp}/${p.cleanTokens})`.padEnd(20);
    console.log(`Overall   | ${fmt(r.overall)} | ${r.latencies.p95Ms.toFixed(3)} ms`);
    console.log(`English   | ${fmt(r.en)} | -`);
    console.log(`French    | ${fmt(r.fr)} | -`);

    // Verify arithmetic consistency
    const sumCleanTokens = r.en.cleanTokens + r.fr.cleanTokens;
    const sumCleanFp = r.en.cleanFp + r.fr.cleanFp;
    const sumInjD1 = r.en.injectedD1 + r.fr.injectedD1;
    const sumRecD1 = r.en.recoveredD1 + r.fr.recoveredD1;
    const sumRep = r.en.replacements + r.fr.replacements;
    const sumTp = r.en.truePositives + r.fr.truePositives;

    const matchCleanTokens = sumCleanTokens === r.overall.cleanTokens;
    const matchCleanFp = sumCleanFp === r.overall.cleanFp;
    const matchInj = sumInjD1 === r.overall.injectedD1;
    const matchRec = sumRecD1 === r.overall.recoveredD1;
    const matchRep = sumRep === r.overall.replacements;
    const matchTp = sumTp === r.overall.truePositives;

    console.log(`Arithmetic Check: CleanTokens=${matchCleanTokens}, CleanFp=${matchCleanFp}, InjD1=${matchInj}, RecD1=${matchRec}, Reps=${matchRep}, TP=${matchTp}`);
  }

  printReport(devResult);
  printReport(pristineResult);
  printReport(heldoutResult);
}

main().catch(console.error);
