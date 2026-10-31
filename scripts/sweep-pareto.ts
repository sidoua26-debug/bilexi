/**
 * scripts/sweep-pareto.ts
 * Controlled experiment over thresholds, candidate generation, and score margins.
 * Evaluates exclusively on the Dev Split (16,720 sentences).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine';
import { fold, hashString } from '../engine/normalize';
import { getThresholds } from '../engine/decide';

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

interface RunResult {
  config: string;
  tauMargin: number;
  minFrequency: number;
  datasetSize: { sentences: number; cleanTokens: number; totalEvaluated: number };
  precisionOverall: number;
  precisionEn: number;
  precisionFr: number;
  recallD1Overall: number;
  recallD1En: number;
  recallD1Fr: number;
  cleanFprOverall: number;
  cleanFprEn: number;
  cleanFprFr: number;
  replacementRate: number;
  counts: {
    cleanFp: number;
    replacements: number;
    truePositives: number;
    d1Injected: number;
    d1Recovered: number;
  };
  directGoldenPass: number;
  directGoldenTotal: number;
  mustStayPass: number;
  mustStayTotal: number;
  avgLatencyMs: number;
}

function verifyGoldenInEngine(engine: any, golden: any): { directGoldenPass: number; directGoldenTotal: number; mustStayPass: number; mustStayTotal: number } {
  let bbTotal = 0;
  let bbPassed = 0;

  function normApos(s: string) { return s.replace(/’/g, "'"); }

  // 1. Fixes EN
  for (const entry of golden.fixesEn) {
    bbTotal++;
    const typed = Array.isArray(entry) ? entry[0] : entry.typed;
    const expected = Array.isArray(entry) ? entry[1] : entry.expected;
    const d = engine.analyze({ token: typed, boundary: ' ', leftContext: [], langHint: 'en' });
    if (normApos(d.replacement.toLowerCase()) === normApos(expected.toLowerCase())) bbPassed++;
  }
  // 2. Rules EN
  for (const [typed, expected] of golden.rulesEn) {
    bbTotal++;
    const d = engine.analyze({ token: typed, boundary: ' ', leftContext: [], langHint: 'en' });
    if (normApos(d.replacement.toLowerCase()) === normApos(expected.toLowerCase())) bbPassed++;
  }
  // 3. Fixes FR
  for (const entry of golden.fixesFr) {
    bbTotal++;
    const typed = Array.isArray(entry) ? entry[0] : entry.typed;
    const expected = Array.isArray(entry) ? entry[1] : entry.expected;
    const d = engine.analyze({ token: typed, boundary: ' ', leftContext: [], langHint: 'fr' });
    if (normApos(d.replacement.toLowerCase()) === normApos(expected.toLowerCase())) bbPassed++;
  }
  // 4. Stretch Cases
  if (golden.stretchCases) {
    for (const [typed, expected] of golden.stretchCases) {
      bbTotal++;
      const d = engine.analyze({ token: typed, boundary: ' ', leftContext: [], langHint: 'en' });
      if (normApos(d.replacement.toLowerCase()) === normApos(expected.toLowerCase())) bbPassed++;
    }
  }

  // 5. Must Stay
  let msTotal = 0;
  let msPassed = 0;
  for (const token of golden.mustStayUnchanged) {
    msTotal++;
    bbTotal++;
    const d = engine.analyze({ token, boundary: ' ', leftContext: [] });
    if (d.action === 'none' || normApos(d.replacement.toLowerCase()) === normApos(token.toLowerCase())) {
      msPassed++;
      bbPassed++;
    }
  }

  return { directGoldenPass: bbPassed, directGoldenTotal: bbTotal, mustStayPass: msPassed, mustStayTotal: msTotal };
}

export function evaluateOnDev(engine: any, devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }>, golden: any, configName: string, tau: number, minF: number): RunResult {
  const rng = createMulberry32(SEED);
  const injectTypo = createTypoInjector(rng);

  let cleanTokens = 0, cleanTokensEn = 0, cleanTokensFr = 0;
  let cleanFp = 0, cleanFpEn = 0, cleanFpFr = 0;

  // Clean pass
  for (const item of devCorpus) {
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
  const latencies: number[] = [];

  for (const item of devCorpus) {
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

  const cleanFprOverall = (cleanFp / (cleanTokens || 1)) * 100;
  const cleanFprEn = (cleanFpEn / (cleanTokensEn || 1)) * 100;
  const cleanFprFr = (cleanFpFr / (cleanTokensFr || 1)) * 100;

  const precisionOverall = (tpOverall / (replacements || 1)) * 100;
  const precisionEn = (tpEn / (repEn || 1)) * 100;
  const precisionFr = (tpFr / (repFr || 1)) * 100;

  const recallD1Overall = (d1RecoveredOverall / (d1InjectedOverall || 1)) * 100;
  const recallD1En = (d1RecoveredEn / (d1InjectedEn || 1)) * 100;
  const recallD1Fr = (d1RecoveredFr / (d1InjectedFr || 1)) * 100;

  const replacementRate = (replacements / (totalEvaluated || 1)) * 100;
  const avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);

  const { directGoldenPass, directGoldenTotal, mustStayPass, mustStayTotal } = verifyGoldenInEngine(engine, golden);

  return {
    config: configName,
    tauMargin: tau,
    minFrequency: minF,
    datasetSize: { sentences: devCorpus.length, cleanTokens, totalEvaluated },
    precisionOverall, precisionEn, precisionFr,
    recallD1Overall, recallD1En, recallD1Fr,
    cleanFprOverall, cleanFprEn, cleanFprFr,
    replacementRate,
    counts: {
      cleanFp,
      replacements,
      truePositives: tpOverall,
      d1Injected: d1InjectedOverall,
      d1Recovered: d1RecoveredOverall,
    },
    directGoldenPass,
    directGoldenTotal,
    mustStayPass,
    mustStayTotal,
    avgLatencyMs,
  };
}

async function main() {
  const enBinPath = path.resolve('public/dict/en.bin');
  const frBinPath = path.resolve('public/dict/fr.bin');
  const ngBinPath = path.resolve('public/dict/ngram.bin');
  const enBuf = fs.readFileSync(enBinPath);
  const frBuf = fs.readFileSync(frBinPath);
  const ngBuf = fs.existsSync(ngBinPath) ? fs.readFileSync(ngBinPath) : undefined;

  const tatoebaRaw = JSON.parse(fs.readFileSync('data/raw/tatoeba-sentences.json', 'utf-8'));
  const goldenRaw = JSON.parse(fs.readFileSync('e2e/golden/appendix-a.json', 'utf-8'));

  const enTatoeba = Object.entries(tatoebaRaw.en as Record<string, string>);
  const frTatoeba = Object.entries(tatoebaRaw.fr as Record<string, string>);

  const devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];
  for (const [id, text] of enTatoeba) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'en' });
  }
  for (const [id, text] of frTatoeba) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'fr' });
  }

  console.log(`[Sweep] Running Pareto evaluation on Dev Split (${devCorpus.length} sentences, seed=${SEED})...`);

  const configs: Array<{ name: string; tau: number; minF: number }> = [
    { name: 'Config 1 (High-Recall / Bold-ish)', tau: 0.70, minF: 10 },
    { name: 'Config 2 (Current Baseline)', tau: 0.90, minF: 15 },
    { name: 'Config 3 (Moderate Margin)', tau: 1.10, minF: 15 },
    { name: 'Config 4 (Moderate Freq)', tau: 1.10, minF: 20 },
    { name: 'Config 5 (Intermediate)', tau: 1.30, minF: 20 },
    { name: 'Config 6 (Strict Precision)', tau: 1.50, minF: 25 },
    { name: 'Config 7 (Cautious)', tau: 1.80, minF: 40 },
    { name: 'Config 8 (High-Threshold Strict)', tau: 2.50, minF: 60 },
  ];

  const results: RunResult[] = [];

  for (const c of configs) {
    console.log(`\nEvaluating ${c.name} [tau=${c.tau}, minF=${c.minF}]...`);
    const engine = createEngine(
      { en: enBuf, fr: frBuf, ngram: ngBuf },
      {
        languageMode: 'auto',
        sensitivity: 'balanced',
        thresholdOverrides: { tauMargin: c.tau, minFrequency: c.minF },
      }
    );
    const res = evaluateOnDev(engine, devCorpus, goldenRaw, c.name, c.tau, c.minF);
    results.push(res);
    console.log(`  -> Precision: ${res.precisionOverall.toFixed(2)}% (EN: ${res.precisionEn.toFixed(2)}%, FR: ${res.precisionFr.toFixed(2)}%)`);
    console.log(`  -> Recall D1: ${res.recallD1Overall.toFixed(2)}% (EN: ${res.recallD1En.toFixed(2)}%, FR: ${res.recallD1Fr.toFixed(2)}%)`);
    console.log(`  -> Clean FPR: ${res.cleanFprOverall.toFixed(3)}% (EN: ${res.cleanFprEn.toFixed(3)}%, FR: ${res.cleanFprFr.toFixed(3)}%)`);
    console.log(`  -> Direct Golden: ${res.directGoldenPass}/${res.directGoldenTotal}, Must-Stay: ${res.mustStayPass}/${res.mustStayTotal}`);
  }

  console.log('\n========================================================================================================');
  console.log('                                  DEV SPLIT PARETO EXPERIMENT TABLE                                      ');
  console.log('========================================================================================================');
  console.log('Config                        | tau  | minF | Precision (All/EN/FR) | Recall D1 (All/EN/FR) | Clean FPR | Golden  | MustStay');
  console.log('------------------------------+------+------+-----------------------+-----------------------+-----------+---------+---------');
  for (const r of results) {
    const prec = `${r.precisionOverall.toFixed(1)} / ${r.precisionEn.toFixed(1)} / ${r.precisionFr.toFixed(1)}%`;
    const rec = `${r.recallD1Overall.toFixed(1)} / ${r.recallD1En.toFixed(1)} / ${r.recallD1Fr.toFixed(1)}%`;
    const fpr = `${r.cleanFprOverall.toFixed(3)}%`;
    const gold = `${r.directGoldenPass}/${r.directGoldenTotal}`;
    const ms = `${r.mustStayPass}/${r.mustStayTotal}`;
    console.log(
      `${r.config.padEnd(29)} | ${r.tauMargin.toFixed(2).padStart(4)} | ${String(r.minFrequency).padStart(4)} | ` +
      `${prec.padEnd(21)} | ${rec.padEnd(21)} | ${fpr.padEnd(9)} | ${gold.padEnd(7)} | ${ms}`
    );
  }
  console.log('========================================================================================================\n');

  fs.writeFileSync('docs/PARETO-EXPERIMENT.json', JSON.stringify(results, null, 2));
}

main().catch(console.error);
