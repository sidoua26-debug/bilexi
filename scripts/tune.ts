/**
 * scripts/tune.ts
 * Platt Confidence Calibration and Threshold Grid Search on Dev Set
 * Usage: pnpm exec tsx scripts/tune.ts
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
  type: string;
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

interface DevSample {
  token: string;
  isTypo: boolean;
  correctWord: string;
  leftContext: string[];
  lang: 'en' | 'fr';
}

function prepareDevSamples(devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }>): DevSample[] {
  const injectTypo = createTypoInjector(SEED);
  const typoRng = createMulberry32(SEED + 999);
  const samples: DevSample[] = [];

  for (const item of devCorpus) {
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

      samples.push({
        token: evaluatedToken,
        isTypo,
        correctWord: token,
        leftContext: [...leftContext],
        lang: item.lang,
      });

      leftContext.push(evaluatedToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  return samples;
}

interface EvaluationResult {
  precision: number;
  recallD1: number;
  cleanFpr: number;
  truePositives: number;
  falsePositives: number;
  cleanFp: number;
  scores: Array<{ score: number; isCorrect: boolean }>;
}

function evaluateDev(
  engine: ReturnType<typeof createEngine>,
  samples: DevSample[]
): EvaluationResult {
  let truePositives = 0;
  let falsePositives = 0;
  let cleanFp = 0;
  let cleanCount = 0;
  let d1Injected = 0;
  let d1Recovered = 0;

  const scores: Array<{ score: number; isCorrect: boolean }> = [];

  for (const s of samples) {
    if (s.isTypo) d1Injected++;
    else cleanCount++;

    const decision = engine.analyze({
      token: s.token,
      boundary: ' ',
      leftContext: s.leftContext,
      langHint: s.lang,
    });

    if (decision.action === 'replace') {
      const isCorrect = decision.replacement.toLowerCase() === s.correctWord.toLowerCase();
      // Extract logit/score from decision score, or fallback to confidence logit
      const rawScore = decision.score ?? (Math.log(decision.confidence / (1 - decision.confidence + 1e-9)) * 2);

      scores.push({ score: rawScore, isCorrect });

      if (isCorrect) {
        truePositives++;
        if (s.isTypo) d1Recovered++;
      } else {
        falsePositives++;
        if (!s.isTypo) cleanFp++;
      }
    }
  }

  const precision = (truePositives / (truePositives + falsePositives || 1)) * 100;
  const recallD1 = (d1Recovered / (d1Injected || 1)) * 100;
  const cleanFpr = (cleanFp / (cleanCount || 1)) * 100;

  return {
    precision,
    recallD1,
    cleanFpr,
    truePositives,
    falsePositives,
    cleanFp,
    scores,
  };
}

/**
 * Fit Platt Scaling: P(y=1 | x) = 1 / (1 + exp(-(A * x + B)))
 * using Logistic Regression gradient descent
 */
function fitPlattScaling(data: Array<{ score: number; isCorrect: boolean }>): { A: number; B: number; brierBefore: number; brierAfter: number; eceBefore: number; eceAfter: number } {
  let A = 0.5;
  let B = 0.0;
  const lr = 0.01;
  const epochs = 1000;

  // Clip scores to avoid numerical overflow
  const samples = data.map(d => ({
    x: Math.max(-20, Math.min(20, d.score)),
    y: d.isCorrect ? 1 : 0,
  }));

  for (let epoch = 0; epoch < epochs; epoch++) {
    let gradA = 0;
    let gradB = 0;
    for (const s of samples) {
      const z = A * s.x + B;
      const p = 1 / (1 + Math.exp(-z));
      const err = p - s.y;
      gradA += err * s.x;
      gradB += err;
    }
    A -= (lr * gradA) / samples.length;
    B -= (lr * gradB) / samples.length;
  }

  // Calculate Brier score and ECE (Expected Calibration Error)
  function metrics(aParam: number, bParam: number) {
    let brier = 0;
    const numBins = 10;
    const binCounts = new Array(numBins).fill(0);
    const binTrue = new Array(numBins).fill(0);
    const binPred = new Array(numBins).fill(0);

    for (const s of samples) {
      const p = 1 / (1 + Math.exp(-(aParam * s.x + bParam)));
      brier += (p - s.y) * (p - s.y);

      const bin = Math.min(numBins - 1, Math.floor(p * numBins));
      binCounts[bin]++;
      binTrue[bin] += s.y;
      binPred[bin] += p;
    }

    let ece = 0;
    for (let i = 0; i < numBins; i++) {
      if (binCounts[i] > 0) {
        const avgPred = binPred[i] / binCounts[i];
        const avgTrue = binTrue[i] / binCounts[i];
        ece += (binCounts[i] / samples.length) * Math.abs(avgPred - avgTrue);
      }
    }

    return { brier: brier / samples.length, ece };
  }

  const before = metrics(0.5, 0.0);
  const after = metrics(A, B);

  return {
    A,
    B,
    brierBefore: before.brier,
    brierAfter: after.brier,
    eceBefore: before.ece,
    eceAfter: after.ece,
  };
}

async function main() {
  console.log('=== Tuning & Platt Confidence Calibration on Dev Set ===\n');

  const enBuffer = fs.readFileSync('public/dict/en.bin');
  const frBuffer = fs.readFileSync('public/dict/fr.bin');
  const ngramBuffer = fs.readFileSync('public/dict/ngram.bin');

  const tatoebaRaw = JSON.parse(fs.readFileSync('data/raw/tatoeba-sentences.json', 'utf-8'));
  const devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];

  for (const [id, text] of Object.entries(tatoebaRaw.en as Record<string, string>)) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'en' });
  }
  for (const [id, text] of Object.entries(tatoebaRaw.fr as Record<string, string>)) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'fr' });
  }

  console.log(`Loaded ${devCorpus.length} dev sentences.`);
  const samples = prepareDevSamples(devCorpus);
  console.log(`Generated ${samples.length} dev evaluation tokens.\n`);

  const engine = createEngine({
    en: enBuffer.buffer.slice(enBuffer.byteOffset, enBuffer.byteOffset + enBuffer.byteLength),
    fr: frBuffer.buffer.slice(frBuffer.byteOffset, frBuffer.byteOffset + frBuffer.byteLength),
    ngram: ngramBuffer.buffer.slice(ngramBuffer.byteOffset, ngramBuffer.byteOffset + ngramBuffer.byteLength),
  });

  console.log('Evaluating baseline sensitivity on Dev Set...');
  const baseline = evaluateDev(engine, samples);
  console.log(`Baseline Dev Precision: ${baseline.precision.toFixed(2)}%`);
  console.log(`Baseline Dev D=1 Recall: ${baseline.recallD1.toFixed(2)}%`);
  console.log(`Baseline Dev Clean FPR: ${baseline.cleanFpr.toFixed(3)}%\n`);

  console.log('Fitting Platt Confidence Scaling...');
  const calib = fitPlattScaling(baseline.scores);
  console.log(`Fitted Platt Parameters: A = ${calib.A.toFixed(4)}, B = ${calib.B.toFixed(4)}`);
  console.log(`Brier Score: ${calib.brierBefore.toFixed(4)} -> ${calib.brierAfter.toFixed(4)}`);
  console.log(`Expected Calibration Error (ECE): ${(calib.eceBefore * 100).toFixed(2)}% -> ${(calib.eceAfter * 100).toFixed(2)}%\n`);

  console.log('--- Threshold Search on Dev Set ---');
  const candidates = [
    { tauMargin: 0.9, minFrequency: 15 },
    { tauMargin: 1.0, minFrequency: 15 },
    { tauMargin: 1.1, minFrequency: 15 },
    { tauMargin: 1.1, minFrequency: 20 },
    { tauMargin: 1.2, minFrequency: 20 },
  ];

  for (const c of candidates) {
    engine.updateSettings({
      thresholdOverrides: c,
    });
    const res = evaluateDev(engine, samples);
    console.log(
      `tauMargin=${c.tauMargin.toFixed(1)}, minFreq=${c.minFrequency}: ` +
      `Precision=${res.precision.toFixed(2)}%, Recall=${res.recallD1.toFixed(2)}%, CleanFPR=${res.cleanFpr.toFixed(3)}%`
    );
  }

  // Reset to default
  engine.updateSettings({ thresholdOverrides: undefined });
  console.log('\nTuning complete. Platt calibration parameters and dev results logged.');
}

main().catch(console.error);
