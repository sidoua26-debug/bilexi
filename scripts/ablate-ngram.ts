import fs from 'node:fs';
import path from 'node:path';
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
  type: string;
  distance: 1 | 2;
}

function createTypoInjector(rng: () => number) {
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

    const pos = Math.floor(rng() * word.length);
    const ch = word[pos]!.toLowerCase();

    if (rand < 0.35) {
      const nList = neighbors[ch];
      if (nList && nList.length > 0) {
        const rep = nList[Math.floor(rng() * nList.length)]!;
        return {
          noisy: word.slice(0, pos) + rep + word.slice(pos + 1),
          type: 'substitution',
          distance: 1,
        };
      }
    } else if (rand < 0.55 && pos < word.length - 1) {
      return {
        noisy: word.slice(0, pos) + word[pos + 1] + word[pos] + word.slice(pos + 2),
        type: 'transposition',
        distance: 1,
      };
    } else if (rand < 0.75 && word.length > 3) {
      return {
        noisy: word.slice(0, pos) + word.slice(pos + 1),
        type: 'omission',
        distance: 1,
      };
    } else if (rand < 0.90) {
      return {
        noisy: word.slice(0, pos) + ch + word.slice(pos),
        type: 'duplication',
        distance: 1,
      };
    }

    return null;
  };
}

interface ItemResult {
  isTypo: boolean;
  isCorrect: boolean;
  wasReplaced: boolean;
  cleanFp: boolean;
}

function evaluateOnCorpus(
  engine: ReturnType<typeof createEngine>,
  corpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }>
): ItemResult[] {
  const rng = createMulberry32(SEED);
  const injectTypo = createTypoInjector(rng);
  const typoRng = createMulberry32(SEED + 999);
  const results: ItemResult[] = [];

  for (const item of corpus) {
    const rawWords = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const token of rawWords) {
      if (token.length < 2) continue;

      const isTypoSlot = typoRng() < 0.25;
      let evaluatedToken = token;
      let isTypo = false;

      if (isTypoSlot) {
        const typo = injectTypo(token, item.lang === 'fr');
        if (typo && typo.distance === 1) {
          evaluatedToken = typo.noisy;
          isTypo = true;
        }
      }

      const decision = engine.analyze({
        token: evaluatedToken,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });

      const wasReplaced = decision.action === 'replace';
      const isCorrect = wasReplaced && decision.replacement.toLowerCase() === token.toLowerCase();
      const cleanFp = wasReplaced && !isTypo;

      results.push({ isTypo, isCorrect, wasReplaced, cleanFp });

      leftContext.push(evaluatedToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  return results;
}

function computeMetrics(items: ItemResult[]) {
  let tp = 0;
  let fp = 0;
  let d1Injected = 0;
  let d1Recovered = 0;
  let cleanTokens = 0;
  let cleanFp = 0;

  for (const it of items) {
    if (it.isTypo) {
      d1Injected++;
      if (it.isCorrect) d1Recovered++;
    } else {
      cleanTokens++;
      if (it.cleanFp) cleanFp++;
    }
    if (it.wasReplaced) {
      if (it.isCorrect) tp++;
      else fp++;
    }
  }

  const precision = (tp / (tp + fp || 1)) * 100;
  const recallD1 = (d1Recovered / (d1Injected || 1)) * 100;
  const cleanFpr = (cleanFp / (cleanTokens || 1)) * 100;

  return { precision, recallD1, cleanFpr, tp, fp, d1Injected, d1Recovered, cleanTokens, cleanFp };
}

function bootstrapCI(
  itemsA: ItemResult[],
  itemsB: ItemResult[],
  replicates = 1000
): {
  precDiff: [number, number];
  recDiff: [number, number];
  fprDiff: [number, number];
} {
  const n = itemsA.length;
  const diffPrec: number[] = [];
  const diffRec: number[] = [];
  const diffFpr: number[] = [];

  const bRng = createMulberry32(42);

  for (let r = 0; r < replicates; r++) {
    const sampleA: ItemResult[] = [];
    const sampleB: ItemResult[] = [];

    for (let i = 0; i < n; i++) {
      const idx = Math.floor(bRng() * n);
      sampleA.push(itemsA[idx]!);
      sampleB.push(itemsB[idx]!);
    }

    const mA = computeMetrics(sampleA);
    const mB = computeMetrics(sampleB);

    diffPrec.push(mB.precision - mA.precision);
    diffRec.push(mB.recallD1 - mA.recallD1);
    diffFpr.push(mB.cleanFpr - mA.cleanFpr);
  }

  diffPrec.sort((a, b) => a - b);
  diffRec.sort((a, b) => a - b);
  diffFpr.sort((a, b) => a - b);

  const lowIdx = Math.floor(replicates * 0.025);
  const highIdx = Math.floor(replicates * 0.975);

  return {
    precDiff: [diffPrec[lowIdx]!, diffPrec[highIdx]!],
    recDiff: [diffRec[lowIdx]!, diffRec[highIdx]!],
    fprDiff: [diffFpr[lowIdx]!, diffFpr[highIdx]!],
  };
}

async function main() {
  console.log('=== N-GRAM MODEL ABLATION WITH 95% BOOTSTRAP CONFIDENCE INTERVALS ===\n');

  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const tatoebaRaw = JSON.parse(fs.readFileSync('data/raw/tatoeba-sentences.json', 'utf-8'));
  const devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];
  const testCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];

  for (const [id, text] of Object.entries(tatoebaRaw.en as Record<string, string>)) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'en' });
    else testCorpus.push({ id, text, lang: 'en' });
  }
  for (const [id, text] of Object.entries(tatoebaRaw.fr as Record<string, string>)) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'fr' });
    else testCorpus.push({ id, text, lang: 'fr' });
  }

  console.log(`Dev Split: ${devCorpus.length} sentences | Held-out Split: ${testCorpus.length} sentences\n`);

  // 1. Dev Split Evaluation
  console.log('Evaluating Dev Split WITHOUT ngram.bin...');
  const engDevWithout = createEngine({ en: enBuf, fr: frBuf });
  const devResWithout = evaluateOnCorpus(engDevWithout, devCorpus);
  const devMetricsWithout = computeMetrics(devResWithout);

  console.log('Evaluating Dev Split WITH ngram.bin...');
  const engDevWith = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });
  const devResWith = evaluateOnCorpus(engDevWith, devCorpus);
  const devMetricsWith = computeMetrics(devResWith);

  console.log('Computing Bootstrap 95% CI on Dev (1000 resamples)...');
  const devCI = bootstrapCI(devResWithout, devResWith, 1000);

  // 2. Held-out Split Evaluation
  console.log('\nEvaluating Held-out Split WITHOUT ngram.bin...');
  const engTestWithout = createEngine({ en: enBuf, fr: frBuf });
  const testResWithout = evaluateOnCorpus(engTestWithout, testCorpus);
  const testMetricsWithout = computeMetrics(testResWithout);

  console.log('Evaluating Held-out Split WITH ngram.bin...');
  const engTestWith = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });
  const testResWith = evaluateOnCorpus(engTestWith, testCorpus);
  const testMetricsWith = computeMetrics(testResWith);

  console.log('Computing Bootstrap 95% CI on Held-out (1000 resamples)...');
  const testCI = bootstrapCI(testResWithout, testResWith, 1000);

  console.log('\n========================================================================================');
  console.log('                                  ABLATION RESULTS TABLE                                ');
  console.log('========================================================================================');
  console.log('Metric               | Split    | Without n-gram | With n-gram  | Delta (95% Bootstrap CI)');
  console.log('---------------------+----------+----------------+--------------+-------------------------');

  const printRow = (name: string, split: string, withoutV: number, withV: number, ci: [number, number], unit = '%') => {
    const diff = withV - withoutV;
    const sign = diff >= 0 ? '+' : '';
    console.log(
      `${name.padEnd(20)} | ${split.padEnd(8)} | ` +
      `${withoutV.toFixed(2)}${unit}`.padEnd(14) + ' | ' +
      `${withV.toFixed(2)}${unit}`.padEnd(12) + ' | ' +
      `${sign}${diff.toFixed(2)}${unit} [${ci[0].toFixed(2)}, ${ci[1].toFixed(2)}]`
    );
  };

  printRow('Applied Precision', 'Dev', devMetricsWithout.precision, devMetricsWith.precision, devCI.precDiff);
  printRow('Applied Precision', 'Test', testMetricsWithout.precision, testMetricsWith.precision, testCI.precDiff);
  printRow('Distance-1 Recall', 'Dev', devMetricsWithout.recallD1, devMetricsWith.recallD1, devCI.recDiff);
  printRow('Distance-1 Recall', 'Test', testMetricsWithout.recallD1, testMetricsWith.recallD1, testCI.recDiff);
  printRow('Clean Token FPR', 'Dev', devMetricsWithout.cleanFpr, devMetricsWith.cleanFpr, devCI.fprDiff);
  printRow('Clean Token FPR', 'Test', testMetricsWithout.cleanFpr, testMetricsWith.cleanFpr, testCI.fprDiff);

  console.log('========================================================================================\n');
}

main().catch(console.error);
