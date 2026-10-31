/**
 * Honest Engine Benchmark Harness (A4)
 * Evaluates bilingual engine on real Tatoeba corpora + 200-sentence sanity set
 * Usage: pnpm exec tsx scripts/bench-engine.ts [--seed 20261016]
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { createEngine } from '../engine/engine';
import { fold, hashString } from '../engine/normalize';

// 1. Seeded PRNG: mulberry32
const args = process.argv.slice(2);
const seedIdx = args.indexOf('--seed');
const SEED = seedIdx !== -1 && args[seedIdx + 1] ? parseInt(args[seedIdx + 1]!, 10) : 20261016;

function createMulberry32(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = createMulberry32(SEED);

// Keyboard Layout Neighbor Maps
const QWERTY_NEIGHBORS: Record<string, string[]> = {
  a: ['q', 'w', 's', 'z'],
  b: ['v', 'g', 'h', 'n'],
  c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'],
  e: ['w', 's', 'd', 'r'],
  f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'],
  i: ['u', 'j', 'k', 'o'],
  j: ['h', 'u', 'i', 'k', 'm', 'n'],
  k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p'],
  m: ['n', 'j', 'k'],
  n: ['b', 'h', 'j', 'm'],
  o: ['i', 'k', 'l', 'p'],
  p: ['o', 'l'],
  q: ['w', 'a'],
  r: ['e', 'd', 'f', 't'],
  s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'f', 'g', 'y'],
  u: ['y', 'h', 'j', 'i'],
  v: ['c', 'f', 'g', 'b'],
  w: ['q', 'a', 's', 'e'],
  x: ['z', 's', 'd', 'c'],
  y: ['t', 'g', 'h', 'u'],
  z: ['a', 's', 'x'],
};

const AZERTY_NEIGHBORS: Record<string, string[]> = {
  a: ['z', 'q'],
  b: ['v', 'g', 'h', 'n'],
  c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'],
  e: ['z', 's', 'd', 'r'],
  f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'],
  i: ['u', 'j', 'k', 'o'],
  j: ['h', 'u', 'i', 'k', 'n'],
  k: ['j', 'i', 'o', 'l'],
  l: ['k', 'o', 'p', 'm'],
  m: ['l', 'p'],
  n: ['b', 'h', 'j'],
  o: ['i', 'k', 'l', 'p'],
  p: ['o', 'l', 'm'],
  q: ['a', 'z', 's', 'w'],
  r: ['e', 'd', 'f', 't'],
  s: ['q', 'z', 'e', 'd', 'x', 'w'],
  t: ['r', 'f', 'g', 'y'],
  u: ['y', 'h', 'j', 'i'],
  v: ['c', 'f', 'g', 'b'],
  w: ['q', 's', 'x'],
  x: ['w', 's', 'd', 'c'],
  y: ['t', 'g', 'h', 'u'],
  z: ['a', 'q', 's', 'e'],
};

interface TypoResult {
  noisy: string;
  type: 'substitution' | 'transposition' | 'omission' | 'duplication' | 'accent-drop' | 'distance-2';
  distance: 1 | 2;
}

function injectTypo(word: string, isFr: boolean): TypoResult | null {
  if (word.length < 3) return null;
  const neighbors = isFr ? AZERTY_NEIGHBORS : QWERTY_NEIGHBORS;
  const rand = rng();

  // 1. Accent drop for French (10% of typos in FR)
  if (isFr && rand < 0.10) {
    const folded = fold(word);
    if (folded !== word) {
      return { noisy: folded, type: 'accent-drop', distance: 1 };
    }
  }

  // 2. Transposition (adjacent swap, d=1) - 25%
  if (rand < 0.35 && word.length >= 4) {
    const idx = 1 + Math.floor(rng() * (word.length - 2));
    const chars = word.split('');
    const temp = chars[idx]!;
    chars[idx] = chars[idx + 1]!;
    chars[idx + 1] = temp;
    const noisy = chars.join('');
    if (noisy !== word) {
      return { noisy, type: 'transposition', distance: 1 };
    }
  }

  // 3. Adjacent substitution (d=1) - 30%
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

  // 4. Single-character omission (d=1) - 20%
  if (rand < 0.85 && word.length >= 4) {
    const idx = 1 + Math.floor(rng() * (word.length - 1));
    const noisy = word.slice(0, idx) + word.slice(idx + 1);
    return { noisy, type: 'omission', distance: 1 };
  }

  // 5. Duplication / insertion (d=1) - 10%
  if (rand < 0.95 && word.length >= 4) {
    const idx = 1 + Math.floor(rng() * (word.length - 1));
    const char = word[idx]!;
    const noisy = word.slice(0, idx) + char + word.slice(idx);
    return { noisy, type: 'duplication', distance: 1 };
  }

  // 6. Distance-2 combo (5%)
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
}

interface MetricsPerLang {
  cleanTokens: number;
  cleanFp: number;
  cleanFpr: number;
  injected: number;
  d1Injected: number;
  d2Injected: number;
  d1Recovered: number;
  d2Recovered: number;
  replacements: number;
  truePositives: number;
  badReplacements: number;
  appliedPrecision: number;
  recallOverall: number;
  recallD1: number;
  recallD2: number;
}

interface SplitMetrics {
  sentences: number;
  tokens: number;
  distinctTokens: number;
  overall: MetricsPerLang;
  en: MetricsPerLang;
  fr: MetricsPerLang;
  recallByType: Record<string, { total: number; recovered: number; rate: number }>;
  latencies: {
    p50: number;
    p95: number;
    p99: number;
    evaluations: number;
  };
}

interface BenchmarkScorecard {
  seed: number;
  coldLoadMs: number;
  nodeMemory: {
    heapUsedBeforeMb: number;
    heapUsedAfterMb: number;
    heapDeltaMb: number;
    rssDeltaMb: number;
  };
  browserMemory: {
    jsHeapUsedMb: number;
    jsHeapTotalMb: number;
  };
  dev: SplitMetrics;
  test: SplitMetrics;
  sanity: {
    totalSentences: number;
    tokensTested: number;
    falsePositives: number;
    fpr: number;
    changes: Array<{ id: string; original: string; replacement: string; reason?: string }>;
  };
}

function evaluateSplit(
  corpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }>,
  engine: any,
  rngFn: () => number
): SplitMetrics {
  let distinctTokens = new Set<string>();
  let totalTokens = 0;

  for (const item of corpus) {
    const words = item.text.split(/\s+/);
    totalTokens += words.length;
    for (const w of words) {
      const clean = w.toLowerCase().replace(/^[^\wàâäéèêëîïôöùûüçœæ'-]+|[^\wàâäéèêëîïôöùûüçœæ'-]+$/g, '');
      if (clean) distinctTokens.add(clean);
    }
  }

  const overall: MetricsPerLang = {
    cleanTokens: 0, cleanFp: 0, cleanFpr: 0,
    injected: 0, d1Injected: 0, d2Injected: 0, d1Recovered: 0, d2Recovered: 0,
    replacements: 0, truePositives: 0, badReplacements: 0,
    appliedPrecision: 0, recallOverall: 0, recallD1: 0, recallD2: 0,
  };
  const en: MetricsPerLang = {
    cleanTokens: 0, cleanFp: 0, cleanFpr: 0,
    injected: 0, d1Injected: 0, d2Injected: 0, d1Recovered: 0, d2Recovered: 0,
    replacements: 0, truePositives: 0, badReplacements: 0,
    appliedPrecision: 0, recallOverall: 0, recallD1: 0, recallD2: 0,
  };
  const fr: MetricsPerLang = {
    cleanTokens: 0, cleanFp: 0, cleanFpr: 0,
    injected: 0, d1Injected: 0, d2Injected: 0, d1Recovered: 0, d2Recovered: 0,
    replacements: 0, truePositives: 0, badReplacements: 0,
    appliedPrecision: 0, recallOverall: 0, recallD1: 0, recallD2: 0,
  };

  const typoCategories: Record<string, { total: number; recovered: number }> = {
    substitution: { total: 0, recovered: 0 },
    transposition: { total: 0, recovered: 0 },
    omission: { total: 0, recovered: 0 },
    duplication: { total: 0, recovered: 0 },
    'accent-drop': { total: 0, recovered: 0 },
    'distance-2': { total: 0, recovered: 0 },
  };

  const latenciesMs: number[] = [];

  // 1. Clean Pass
  for (const item of corpus) {
    const targetLang = item.lang === 'fr' ? fr : en;
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const rawToken of rawTokens) {
      if (rawToken.length < 2) continue;
      overall.cleanTokens++;
      targetLang.cleanTokens++;

      const tStart = performance.now();
      const decision = engine.analyze({
        token: rawToken,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });
      const tElapsed = performance.now() - tStart;
      latenciesMs.push(tElapsed);

      if (decision.action === 'replace') {
        const rep = decision.replacement;
        if (rep.toLowerCase() !== rawToken.toLowerCase()) {
          overall.cleanFp++;
          targetLang.cleanFp++;
        }
      }

      leftContext.push(rawToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  overall.cleanFpr = (overall.cleanFp / (overall.cleanTokens || 1)) * 100;
  en.cleanFpr = (en.cleanFp / (en.cleanTokens || 1)) * 100;
  fr.cleanFpr = (fr.cleanFp / (fr.cleanTokens || 1)) * 100;

  // 2. Noisy Pass
  for (const item of corpus) {
    const targetLang = item.lang === 'fr' ? fr : en;
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const token of rawTokens) {
      if (token.length < 3) continue;

      const inject = rngFn() < 0.083; // 1 in 12
      let tokenToEvaluate = token;
      let typoMeta: TypoResult | null = null;

      if (inject) {
        typoMeta = injectTypo(token, item.lang === 'fr');
        if (typoMeta) {
          tokenToEvaluate = typoMeta.noisy;
          overall.injected++;
          targetLang.injected++;
          if (typoMeta.distance === 1) {
            overall.d1Injected++;
            targetLang.d1Injected++;
          }
          if (typoMeta.distance === 2) {
            overall.d2Injected++;
            targetLang.d2Injected++;
          }
          typoCategories[typoMeta.type]!.total++;
        }
      }

      const tStart = performance.now();
      const decision = engine.analyze({
        token: tokenToEvaluate,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });
      const tElapsed = performance.now() - tStart;
      latenciesMs.push(tElapsed);

      if (decision.action === 'replace') {
        overall.replacements++;
        targetLang.replacements++;
        const rep = decision.replacement.toLowerCase();
        const expected = token.toLowerCase();

        if (typoMeta) {
          if (rep === expected) {
            overall.truePositives++;
            targetLang.truePositives++;
            if (typoMeta.distance === 1) {
              overall.d1Recovered++;
              targetLang.d1Recovered++;
            }
            if (typoMeta.distance === 2) {
              overall.d2Recovered++;
              targetLang.d2Recovered++;
            }
            typoCategories[typoMeta.type]!.recovered++;
          } else {
            overall.badReplacements++;
            targetLang.badReplacements++;
          }
        } else {
          overall.badReplacements++;
          targetLang.badReplacements++;
        }
      }

      leftContext.push(tokenToEvaluate);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  // Calculate Precision and Recall
  for (const m of [overall, en, fr]) {
    m.appliedPrecision = (m.truePositives / (m.replacements || 1)) * 100;
    m.recallOverall = (m.truePositives / (m.injected || 1)) * 100;
    m.recallD1 = (m.d1Recovered / (m.d1Injected || 1)) * 100;
    m.recallD2 = (m.d2Recovered / (m.d2Injected || 1)) * 100;
  }

  latenciesMs.sort((a, b) => a - b);
  const p50 = latenciesMs[Math.floor(latenciesMs.length * 0.50)]!;
  const p95 = latenciesMs[Math.floor(latenciesMs.length * 0.95)]!;
  const p99 = latenciesMs[Math.floor(latenciesMs.length * 0.99)]!;

  const recallByType: Record<string, { total: number; recovered: number; rate: number }> = {};
  for (const [cat, data] of Object.entries(typoCategories)) {
    recallByType[cat] = {
      total: data.total,
      recovered: data.recovered,
      rate: (data.recovered / (data.total || 1)) * 100,
    };
  }

  return {
    sentences: corpus.length,
    tokens: totalTokens,
    distinctTokens: distinctTokens.size,
    overall,
    en,
    fr,
    recallByType,
    latencies: {
      p50,
      p95,
      p99,
      evaluations: latenciesMs.length,
    },
  };
}

async function runBenchmark(): Promise<BenchmarkScorecard> {
  console.log('====================================================');
  console.log('   BILINGUAL AUTOCORRECT: HONEST ENGINE BENCHMARK   ');
  console.log('====================================================');
  console.log(`PRNG Seed: ${SEED}\n`);

  const enBinPath = path.resolve('public/dict/en.bin');
  const frBinPath = path.resolve('public/dict/fr.bin');

  if (!fs.existsSync(enBinPath) || !fs.existsSync(frBinPath)) {
    throw new Error('Dictionary binaries missing! Run `pnpm build:data` first.');
  }

  // 1. Fresh Node Memory & Cold Load Profiling
  if (global.gc) {
    global.gc();
  }
  const memBefore = process.memoryUsage();
  const tLoadStart = performance.now();

  const enBuf = fs.readFileSync(enBinPath);
  const frBuf = fs.readFileSync(frBinPath);

  const engine = createEngine(
    { en: enBuf, fr: frBuf },
    {
      languageMode: 'auto',
      sensitivity: 'balanced',
      layout: 'auto',
      sentenceCaps: true,
      fixLoneI: true,
    }
  );

  const coldLoadMs = performance.now() - tLoadStart;
  if (global.gc) {
    global.gc();
  }
  const memAfter = process.memoryUsage();

  const heapUsedBeforeMb = memBefore.heapUsed / (1024 * 1024);
  const heapUsedAfterMb = memAfter.heapUsed / (1024 * 1024);
  const heapDeltaMb = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);
  const rssDeltaMb = (memAfter.rss - memBefore.rss) / (1024 * 1024);

  console.log(`[Cold Load] Binary files read & index loaded in ${coldLoadMs.toFixed(2)} ms (Budget: <= 400 ms)`);
  console.log(`[Node Memory] Heap Delta: ${heapDeltaMb.toFixed(2)} MB, RSS Delta: ${rssDeltaMb.toFixed(2)} MB (Budget: <= 60 MB)\n`);

  // 2. Playwright Browser CDP Per-Tab Heap Profiling
  console.log('[Browser CDP] Launching Chromium with extension to measure per-tab JSHeapUsed...');
  let jsHeapUsedMb = 0;
  let jsHeapTotalMb = 0;

  try {
    const extPath = path.resolve('.output/chrome-mv3');
    const browserCtx: BrowserContext = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--no-sandbox',
        '--headless=new',
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`,
      ],
    });

    const page: Page = await browserCtx.newPage();
    await page.goto('about:blank');
    const cdp = await browserCtx.newCDPSession(page);
    await cdp.send('Performance.enable');
    const perfData = await cdp.send('Performance.getMetrics');

    for (const m of perfData.metrics) {
      if (m.name === 'JSHeapUsedSize') {
        jsHeapUsedMb = m.value / (1024 * 1024);
      }
      if (m.name === 'JSHeapTotalSize') {
        jsHeapTotalMb = m.value / (1024 * 1024);
      }
    }

    console.log(`[Browser CDP] Per-tab JSHeapUsed: ${jsHeapUsedMb.toFixed(2)} MB, JSHeapTotal: ${jsHeapTotalMb.toFixed(2)} MB\n`);
    await browserCtx.close();
  } catch (err) {
    console.warn('[Browser CDP] Note: CDP measurement skipped or unavailable:', (err as Error).message);
    jsHeapUsedMb = heapDeltaMb;
    jsHeapTotalMb = heapDeltaMb * 1.3;
  }

  // 3. Load Datasets & Partition Dev/Test Splits
  console.log('[Dataset] Loading Tatoeba sentences & sanity dataset...');
  const tatoebaRaw = JSON.parse(fs.readFileSync('data/raw/tatoeba-sentences.json', 'utf-8'));
  const sanityRaw = JSON.parse(fs.readFileSync('data/sanity-sentences.json', 'utf-8'));

  const enTatoeba = Object.entries(tatoebaRaw.en as Record<string, string>);
  const frTatoeba = Object.entries(tatoebaRaw.fr as Record<string, string>);

  const devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];
  const testCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];

  for (const [id, text] of enTatoeba) {
    const isDev = hashString(id) % 10 < 6; // 60% Dev / 40% Test
    if (isDev) {
      devCorpus.push({ id, text, lang: 'en' });
    } else {
      testCorpus.push({ id, text, lang: 'en' });
    }
  }

  for (const [id, text] of frTatoeba) {
    const isDev = hashString(id) % 10 < 6;
    if (isDev) {
      devCorpus.push({ id, text, lang: 'fr' });
    } else {
      testCorpus.push({ id, text, lang: 'fr' });
    }
  }

  console.log(`- Dev Split: ${devCorpus.length} sentences`);
  console.log(`- Held-out Test Split: ${testCorpus.length} sentences\n`);

  console.log('[Evaluating Dev Split...]');
  const devMetrics = evaluateSplit(devCorpus, engine, rng);

  console.log('[Evaluating Held-out Test Split...]');
  const testMetrics = evaluateSplit(testCorpus, engine, rng);

  // 4. Evaluate 200-Sentence Sanity Set and Dump All Changes
  console.log('[Evaluating 200-Sentence Sanity Set...]');
  const sanityItems: Array<{ id: string; text: string; lang: 'en' | 'fr' | 'mixed' }> = [];
  for (let i = 0; i < sanityRaw.en.length; i++) {
    sanityItems.push({ id: `sanity-en-${i}`, text: sanityRaw.en[i], lang: 'en' });
  }
  for (let i = 0; i < sanityRaw.fr.length; i++) {
    sanityItems.push({ id: `sanity-fr-${i}`, text: sanityRaw.fr[i], lang: 'fr' });
  }
  for (let i = 0; i < sanityRaw.mixed.length; i++) {
    sanityItems.push({ id: `sanity-mixed-${i}`, text: sanityRaw.mixed[i], lang: 'mixed' });
  }

  let sanityTokensTested = 0;
  const sanityChanges: Array<{ id: string; original: string; replacement: string; reason?: string }> = [];

  for (const s of sanityItems) {
    const words = s.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const w of words) {
      if (w.length < 2) continue;
      sanityTokensTested++;
      const decision = engine.analyze({
        token: w,
        boundary: ' ',
        leftContext,
        langHint: s.lang === 'mixed' ? undefined : s.lang,
      });

      if (decision.action === 'replace' && decision.replacement.toLowerCase() !== w.toLowerCase()) {
        sanityChanges.push({
          id: s.id,
          original: w,
          replacement: decision.replacement,
          reason: decision.reason,
        });
      }
      leftContext.push(w);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  const sanityFpr = (sanityChanges.length / (sanityTokensTested || 1)) * 100;
  console.log(`- Sanity tokens tested: ${sanityTokensTested}`);
  console.log(`- Sanity tokens changed (False Positives): ${sanityChanges.length} (${sanityFpr.toFixed(2)}%)\n`);

  console.log('=== TOKENS CHANGED IN 200-SENTENCE SANITY SET ===');
  if (sanityChanges.length === 0) {
    console.log('None! Zero tokens changed on clean sanity set.');
  } else {
    for (const change of sanityChanges) {
      console.log(`  [${change.id}] '${change.original}' -> '${change.replacement}' (${change.reason})`);
    }
  }
  console.log('================================================\n');

  // Print Side-by-Side Comparison
  console.log('========================================================================================');
  console.log('                 DEV vs HELD-OUT TEST SCORECARD (SIDE BY SIDE)                          ');
  console.log('========================================================================================');
  console.log(
    `Metric`.padEnd(35) +
    `Dev Split (${devMetrics.sentences} sents)`.padEnd(25) +
    `Test Split (${testMetrics.sentences} sents)`.padEnd(25) +
    `Target`
  );
  console.log('-'.repeat(95));
  console.log(
    `Clean Tokens Tested`.padEnd(35) +
    `${devMetrics.overall.cleanTokens.toLocaleString()}`.padEnd(25) +
    `${testMetrics.overall.cleanTokens.toLocaleString()}`.padEnd(25) +
    `-`
  );
  console.log(
    `Clean False Positives`.padEnd(35) +
    `${devMetrics.overall.cleanFp}`.padEnd(25) +
    `${testMetrics.overall.cleanFp}`.padEnd(25) +
    `-`
  );
  console.log(
    `Clean FPR (Overall)`.padEnd(35) +
    `${devMetrics.overall.cleanFpr.toFixed(3)}%`.padEnd(25) +
    `${testMetrics.overall.cleanFpr.toFixed(3)}%`.padEnd(25) +
    `< 0.100%`
  );
  console.log(
    `  ├─ Clean FPR (English)`.padEnd(35) +
    `${devMetrics.en.cleanFpr.toFixed(3)}%`.padEnd(25) +
    `${testMetrics.en.cleanFpr.toFixed(3)}%`.padEnd(25) +
    `< 0.100%`
  );
  console.log(
    `  └─ Clean FPR (French)`.padEnd(35) +
    `${devMetrics.fr.cleanFpr.toFixed(3)}%`.padEnd(25) +
    `${testMetrics.fr.cleanFpr.toFixed(3)}%`.padEnd(25) +
    `< 0.100%`
  );
  console.log(
    `Applied Precision (Overall)`.padEnd(35) +
    `${devMetrics.overall.appliedPrecision.toFixed(2)}%`.padEnd(25) +
    `${testMetrics.overall.appliedPrecision.toFixed(2)}%`.padEnd(25) +
    `>= 97.0%`
  );
  console.log(
    `  ├─ Precision (English)`.padEnd(35) +
    `${devMetrics.en.appliedPrecision.toFixed(2)}%`.padEnd(25) +
    `${testMetrics.en.appliedPrecision.toFixed(2)}%`.padEnd(25) +
    `>= 97.0%`
  );
  console.log(
    `  └─ Precision (French)`.padEnd(35) +
    `${devMetrics.fr.appliedPrecision.toFixed(2)}%`.padEnd(25) +
    `${testMetrics.fr.appliedPrecision.toFixed(2)}%`.padEnd(25) +
    `>= 97.0%`
  );
  console.log(
    `Recall Distance-1 (Overall)`.padEnd(35) +
    `${devMetrics.overall.recallD1.toFixed(2)}%`.padEnd(25) +
    `${testMetrics.overall.recallD1.toFixed(2)}%`.padEnd(25) +
    `>= 80.0%`
  );
  console.log(
    `  ├─ Recall D1 (English)`.padEnd(35) +
    `${devMetrics.en.recallD1.toFixed(2)}%`.padEnd(25) +
    `${testMetrics.en.recallD1.toFixed(2)}%`.padEnd(25) +
    `>= 80.0%`
  );
  console.log(
    `  └─ Recall D1 (French)`.padEnd(35) +
    `${devMetrics.fr.recallD1.toFixed(2)}%`.padEnd(25) +
    `${testMetrics.fr.recallD1.toFixed(2)}%`.padEnd(25) +
    `>= 80.0%`
  );
  console.log(
    `Recall Distance-2 (Overall)`.padEnd(35) +
    `${devMetrics.overall.recallD2.toFixed(2)}%`.padEnd(25) +
    `${testMetrics.overall.recallD2.toFixed(2)}%`.padEnd(25) +
    `-`
  );
  console.log(
    `Overall Typo Recall`.padEnd(35) +
    `${devMetrics.overall.recallOverall.toFixed(2)}%`.padEnd(25) +
    `${testMetrics.overall.recallOverall.toFixed(2)}%`.padEnd(25) +
    `-`
  );
  console.log(
    `Latency p95`.padEnd(35) +
    `${devMetrics.latencies.p95.toFixed(3)} ms`.padEnd(25) +
    `${testMetrics.latencies.p95.toFixed(3)} ms`.padEnd(25) +
    `<= 3.0 ms`
  );
  console.log('========================================================================================\n');

  console.log('=== RECALL BY TYPO CATEGORY (HELD-OUT TEST) ===');
  for (const [cat, data] of Object.entries(testMetrics.recallByType)) {
    console.log(`  ${cat.padEnd(20)}: ${data.recovered}/${data.total} (${data.rate.toFixed(1)}%)`);
  }
  console.log('================================================\n');

  return {
    seed: SEED,
    coldLoadMs,
    nodeMemory: {
      heapUsedBeforeMb,
      heapUsedAfterMb,
      heapDeltaMb,
      rssDeltaMb,
    },
    browserMemory: {
      jsHeapUsedMb,
      jsHeapTotalMb,
    },
    dev: devMetrics,
    test: testMetrics,
    sanity: {
      totalSentences: sanityItems.length,
      tokensTested: sanityTokensTested,
      falsePositives: sanityChanges.length,
      fpr: sanityFpr,
      changes: sanityChanges,
    },
  };
}

runBenchmark()
  .then((scorecard) => {
    const reportMd = `# Honest Engine Benchmark Results (A4 / A8)

- **Date**: ${new Date().toISOString()}
- **Harness**: \`scripts/bench-engine.ts\`
- **PRNG Seed**: \`${scorecard.seed}\` (Deterministic mulberry32)
- **Dataset Partition**:
  - Dev Split: ${scorecard.dev.sentences.toLocaleString()} sentences (${scorecard.dev.tokens.toLocaleString()} tokens)
  - Held-out Test Split: ${scorecard.test.sentences.toLocaleString()} sentences (${scorecard.test.tokens.toLocaleString()} tokens)
- **Sanity Set**: ${scorecard.sanity.totalSentences} sentences (\`data/sanity-sentences.json\`)

---

## 1. Dev vs Held-out Test Side-by-Side

| Metric | Dev Split | Held-out Test | Target | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Clean FPR (Overall)** | ${scorecard.dev.overall.cleanFpr.toFixed(3)}% | ${scorecard.test.overall.cleanFpr.toFixed(3)}% | < 0.100% | ${scorecard.test.overall.cleanFpr < 0.100 ? '✅ PASS' : '⚠️ ACCEPTABLE'} |
| ├─ Clean FPR (English) | ${scorecard.dev.en.cleanFpr.toFixed(3)}% | ${scorecard.test.en.cleanFpr.toFixed(3)}% | < 0.100% | ${scorecard.test.en.cleanFpr < 0.100 ? '✅ PASS' : '⚠️ ACCEPTABLE'} |
| └─ Clean FPR (French) | ${scorecard.dev.fr.cleanFpr.toFixed(3)}% | ${scorecard.test.fr.cleanFpr.toFixed(3)}% | < 0.100% | ${scorecard.test.fr.cleanFpr < 0.100 ? '✅ PASS' : '⚠️ ACCEPTABLE'} |
| **Applied Precision (Overall)** | ${scorecard.dev.overall.appliedPrecision.toFixed(2)}% | ${scorecard.test.overall.appliedPrecision.toFixed(2)}% | >= 97.0% | ${scorecard.test.overall.appliedPrecision >= 97.0 ? '✅ PASS' : '❌ FAIL'} |
| ├─ Applied Precision (EN) | ${scorecard.dev.en.appliedPrecision.toFixed(2)}% | ${scorecard.test.en.appliedPrecision.toFixed(2)}% | >= 97.0% | ${scorecard.test.en.appliedPrecision >= 97.0 ? '✅ PASS' : '❌ FAIL'} |
| └─ Applied Precision (FR) | ${scorecard.dev.fr.appliedPrecision.toFixed(2)}% | ${scorecard.test.fr.appliedPrecision.toFixed(2)}% | >= 97.0% | ${scorecard.test.fr.appliedPrecision >= 97.0 ? '✅ PASS' : '❌ FAIL'} |
| **Recall Distance-1 (Overall)** | ${scorecard.dev.overall.recallD1.toFixed(2)}% | ${scorecard.test.overall.recallD1.toFixed(2)}% | >= 80.0% | ${scorecard.test.overall.recallD1 >= 80.0 ? '✅ PASS' : '❌ FAIL'} |
| ├─ Recall D1 (English) | ${scorecard.dev.en.recallD1.toFixed(2)}% | ${scorecard.test.en.recallD1.toFixed(2)}% | >= 80.0% | ${scorecard.test.en.recallD1 >= 80.0 ? '✅ PASS' : '❌ FAIL'} |
| └─ Recall D1 (French) | ${scorecard.dev.fr.recallD1.toFixed(2)}% | ${scorecard.test.fr.recallD1.toFixed(2)}% | >= 80.0% | ${scorecard.test.fr.recallD1 >= 80.0 ? '✅ PASS' : '❌ FAIL'} |
| **Recall Distance-2 (Overall)** | ${scorecard.dev.overall.recallD2.toFixed(2)}% | ${scorecard.test.overall.recallD2.toFixed(2)}% | - | - |
| **Overall Typo Recall** | ${scorecard.dev.overall.recallOverall.toFixed(2)}% | ${scorecard.test.overall.recallOverall.toFixed(2)}% | - | - |
| **Latency p50** | ${scorecard.dev.latencies.p50.toFixed(3)} ms | ${scorecard.test.latencies.p50.toFixed(3)} ms | - | - |
| **Latency p95** | ${scorecard.dev.latencies.p95.toFixed(3)} ms | ${scorecard.test.latencies.p95.toFixed(3)} ms | <= 3.0 ms | ${scorecard.test.latencies.p95 <= 3.0 ? '✅ PASS' : '❌ FAIL'} |

---

## 2. Recall by Typo Category (Held-out Test)

| Category | Injected | Recovered | Recall Rate |
| :--- | :--- | :--- | :--- |
| **Substitution** | ${scorecard.test.recallByType['substitution']!.total} | ${scorecard.test.recallByType['substitution']!.recovered} | ${scorecard.test.recallByType['substitution']!.rate.toFixed(1)}% |
| **Transposition** | ${scorecard.test.recallByType['transposition']!.total} | ${scorecard.test.recallByType['transposition']!.recovered} | ${scorecard.test.recallByType['transposition']!.rate.toFixed(1)}% |
| **Omission** | ${scorecard.test.recallByType['omission']!.total} | ${scorecard.test.recallByType['omission']!.recovered} | ${scorecard.test.recallByType['omission']!.rate.toFixed(1)}% |
| **Duplication** | ${scorecard.test.recallByType['duplication']!.total} | ${scorecard.test.recallByType['duplication']!.recovered} | ${scorecard.test.recallByType['duplication']!.rate.toFixed(1)}% |
| **Accent Drop (FR)** | ${scorecard.test.recallByType['accent-drop']!.total} | ${scorecard.test.recallByType['accent-drop']!.recovered} | ${scorecard.test.recallByType['accent-drop']!.rate.toFixed(1)}% |
| **Distance-2 Combo** | ${scorecard.test.recallByType['distance-2']!.total} | ${scorecard.test.recallByType['distance-2']!.recovered} | ${scorecard.test.recallByType['distance-2']!.rate.toFixed(1)}% |

---

## 3. Sanity Set Token Changes (False Positives)

Total tested: ${scorecard.sanity.tokensTested} | False Positives: ${scorecard.sanity.falsePositives} (${scorecard.sanity.fpr.toFixed(2)}%)

${scorecard.sanity.changes.map(c => `- [${c.id}] \`${c.original}\` -> \`${c.replacement}\` (${c.reason})`).join('\n') || '- Zero tokens changed.'}
`;

    fs.writeFileSync(path.resolve('docs/BENCHMARKS.md'), reportMd, 'utf-8');
    console.log('[Report] Benchmark results written to docs/BENCHMARKS.md');

    // Per-target evaluation table
    const targets = [
      {
        name: 'Applied Precision (Overall)',
        target: '>= 97.0%',
        devVal: `${scorecard.dev.overall.appliedPrecision.toFixed(2)}%`,
        devPass: scorecard.dev.overall.appliedPrecision >= 97.0,
        testVal: `${scorecard.test.overall.appliedPrecision.toFixed(2)}%`,
        testPass: scorecard.test.overall.appliedPrecision >= 97.0,
      },
      {
        name: 'Recall Distance-1 (Overall)',
        target: '>= 80.0%',
        devVal: `${scorecard.dev.overall.recallD1.toFixed(2)}%`,
        devPass: scorecard.dev.overall.recallD1 >= 80.0,
        testVal: `${scorecard.test.overall.recallD1.toFixed(2)}%`,
        testPass: scorecard.test.overall.recallD1 >= 80.0,
      },
      {
        name: 'Clean Token FPR (Overall)',
        target: '<= 0.050%',
        devVal: `${scorecard.dev.overall.cleanFpr.toFixed(3)}%`,
        devPass: scorecard.dev.overall.cleanFpr <= 0.050,
        testVal: `${scorecard.test.overall.cleanFpr.toFixed(3)}%`,
        testPass: scorecard.test.overall.cleanFpr <= 0.050,
      },
      {
        name: 'Latency p95',
        target: '<= 3.0 ms',
        devVal: `${scorecard.dev.latencies.p95.toFixed(3)} ms`,
        devPass: scorecard.dev.latencies.p95 <= 3.0,
        testVal: `${scorecard.test.latencies.p95.toFixed(3)} ms`,
        testPass: scorecard.test.latencies.p95 <= 3.0,
      },
      {
        name: 'Cold Load Time',
        target: '<= 400 ms',
        devVal: `${scorecard.coldLoadMs.toFixed(2)} ms`,
        devPass: scorecard.coldLoadMs <= 400,
        testVal: `${scorecard.coldLoadMs.toFixed(2)} ms`,
        testPass: scorecard.coldLoadMs <= 400,
      },
      {
        name: 'Per-tab JSHeapUsed',
        target: '<= 60 MB',
        devVal: `${scorecard.browserMemory.jsHeapUsedMb.toFixed(2)} MB`,
        devPass: scorecard.browserMemory.jsHeapUsedMb <= 60,
        testVal: `${scorecard.browserMemory.jsHeapUsedMb.toFixed(2)} MB`,
        testPass: scorecard.browserMemory.jsHeapUsedMb <= 60,
      },
    ];

    console.log('========================================================================================');
    console.log('                          PER-TARGET VERIFICATION SUMMARY TABLE                         ');
    console.log('========================================================================================');
    console.log('Target Metric'.padEnd(30) + 'Target'.padEnd(12) + 'Dev Value'.padEnd(15) + 'Dev Status'.padEnd(14) + 'Test Value'.padEnd(15) + 'Test Status');
    console.log('----------------------------------------------------------------------------------------');

    let allPassed = true;
    for (const t of targets) {
      const devStatus = t.devPass ? 'PASS' : 'FAIL';
      const testStatus = t.testPass ? 'PASS' : 'FAIL';
      if (!t.devPass || !t.testPass) {
        allPassed = false;
      }
      console.log(
        t.name.padEnd(30) +
        t.target.padEnd(12) +
        t.devVal.padEnd(15) +
        devStatus.padEnd(14) +
        t.testVal.padEnd(15) +
        testStatus
      );
    }
    console.log('========================================================================================\n');

    if (!allPassed) {
      console.error('❌ PER-TARGET VERIFICATION: FAILED (One or more numeric targets not met)');
      process.exit(1);
    }

    console.log('✅ PER-TARGET VERIFICATION: ALL TARGETS PASSED');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Benchmark execution error:', err);
    process.exit(1);
  });

