/**
 * scripts/baseline-deep-audit.ts
 * Detailed baseline diagnostic: records every incorrect applied correction,
 * every missed typo, score/margin/confidence distributions, and category breakdowns.
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

export interface DetailedAnalysis {
  badReplacements: Array<{
    sentenceId: string;
    lang: 'en' | 'fr';
    targetToken: string;
    noisyToken: string;
    replacement: string;
    confidence: number;
    reason: string;
    isCleanWord: boolean;
    rootCause: string;
    details: string;
  }>;
  missedTypos: Array<{
    sentenceId: string;
    lang: 'en' | 'fr';
    expectedToken: string;
    noisyToken: string;
    typoType: string;
    distance: number;
    decisionAction: string;
    decisionReason: string;
    isRealWord: boolean;
    rootCause: string;
    details: string;
  }>;
  confidenceDistribution: {
    tp: Record<string, number>;
    bad: Record<string, number>;
    cleanFp: Record<string, number>;
  };
  rootCauseCounts: Record<string, number>;
  missedCauseCounts: Record<string, number>;
  typoCategoryStats: Record<string, { total: number; recovered: number; missed: number; badRepl: number }>;
}

async function run() {
  const enBinPath = path.resolve('public/dict/en.bin');
  const frBinPath = path.resolve('public/dict/fr.bin');
  const enBuf = fs.readFileSync(enBinPath);
  const frBuf = fs.readFileSync(frBinPath);

  const engine = createEngine(
    { en: enBuf, fr: frBuf },
    { languageMode: 'auto', sensitivity: 'balanced', layout: 'auto', sentenceCaps: true, fixLoneI: true }
  );

  const tatoebaRaw = JSON.parse(fs.readFileSync('data/raw/tatoeba-sentences.json', 'utf-8'));
  const enTatoeba = Object.entries(tatoebaRaw.en as Record<string, string>);
  const frTatoeba = Object.entries(tatoebaRaw.fr as Record<string, string>);

  const devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];
  const testCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];

  for (const [id, text] of enTatoeba) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'en' });
    else testCorpus.push({ id, text, lang: 'en' });
  }
  for (const [id, text] of frTatoeba) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'fr' });
    else testCorpus.push({ id, text, lang: 'fr' });
  }

  const rng = createMulberry32(SEED);
  const injectTypo = createTypoInjector(rng);

  console.log(`[Baseline Audit] Dev Corpus: ${devCorpus.length} sentences. Running audit...`);

  const confBuckets = ['0.50-0.60', '0.60-0.70', '0.70-0.80', '0.80-0.90', '0.90-1.00'];
  function getBucket(conf: number): string {
    if (conf < 0.6) return '0.50-0.60';
    if (conf < 0.7) return '0.60-0.70';
    if (conf < 0.8) return '0.70-0.80';
    if (conf < 0.9) return '0.80-0.90';
    return '0.90-1.00';
  }

  const analysis: DetailedAnalysis = {
    badReplacements: [],
    missedTypos: [],
    confidenceDistribution: {
      tp: Object.fromEntries(confBuckets.map(b => [b, 0])),
      bad: Object.fromEntries(confBuckets.map(b => [b, 0])),
      cleanFp: Object.fromEntries(confBuckets.map(b => [b, 0])),
    },
    rootCauseCounts: {},
    missedCauseCounts: {},
    typoCategoryStats: {},
  };

  // 1. Clean Pass Dev
  let cleanTokens = 0;
  let cleanFp = 0;
  for (const item of devCorpus) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const rawToken of rawTokens) {
      if (rawToken.length < 2) continue;
      cleanTokens++;

      const decision = engine.analyze({
        token: rawToken,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });

      if (decision.action === 'replace') {
        const rep = decision.replacement;
        if (rep.toLowerCase() !== rawToken.toLowerCase()) {
          cleanFp++;
          const b = getBucket(decision.confidence || 0.5);
          analysis.confidenceDistribution.cleanFp[b] = (analysis.confidenceDistribution.cleanFp[b] || 0) + 1;
        }
      }

      leftContext.push(rawToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  // 2. Noisy Pass Dev
  let totalReplacements = 0;
  let truePositives = 0;
  let totalInjected = 0;
  let d1Injected = 0;
  let d1Recovered = 0;

  for (const item of devCorpus) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const token of rawTokens) {
      if (token.length < 3) continue;

      const inject = rng() < 0.083;
      let tokenToEvaluate = token;
      let typoMeta: TypoResult | null = null;

      if (inject) {
        typoMeta = injectTypo(token, item.lang === 'fr');
        if (typoMeta) {
          tokenToEvaluate = typoMeta.noisy;
          totalInjected++;
          if (typoMeta.distance === 1) d1Injected++;
          if (!analysis.typoCategoryStats[typoMeta.type]) {
            analysis.typoCategoryStats[typoMeta.type] = { total: 0, recovered: 0, missed: 0, badRepl: 0 };
          }
          analysis.typoCategoryStats[typoMeta.type]!.total++;
        }
      }

      const decision = engine.analyze({
        token: tokenToEvaluate,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });

      const rep = decision.action === 'replace' ? decision.replacement.toLowerCase() : null;
      const expected = token.toLowerCase();

      if (decision.action === 'replace') {
        totalReplacements++;
        const confBucket = getBucket(decision.confidence || 0.5);

        if (typoMeta) {
          if (rep === expected) {
            truePositives++;
            if (typoMeta.distance === 1) d1Recovered++;
            analysis.typoCategoryStats[typoMeta.type]!.recovered++;
            analysis.confidenceDistribution.tp[confBucket] = (analysis.confidenceDistribution.tp[confBucket] || 0) + 1;
          } else {
            analysis.typoCategoryStats[typoMeta.type]!.badRepl++;
            analysis.confidenceDistribution.bad[confBucket] = (analysis.confidenceDistribution.bad[confBucket] || 0) + 1;

            const isKnownExpected = engine.isKnownWord(token, item.lang);
            const isCognateConfusion = fold(token.toLowerCase()) === fold(rep) || (rep.length >= 5 && token.length >= 5 && rep.slice(0, 4) === token.slice(0, 4));

            let rootCause = 'Wrong neighbor candidate';
            if (!isKnownExpected) {
              rootCause = 'Expected target absent from lexicon';
            } else if (isCognateConfusion) {
              rootCause = 'Cognate / Inflection confusion';
            } else if (rep.length !== token.length) {
              rootCause = 'Length discrepancy substitution';
            }

            analysis.rootCauseCounts[rootCause] = (analysis.rootCauseCounts[rootCause] || 0) + 1;

            analysis.badReplacements.push({
              sentenceId: item.id,
              lang: item.lang,
              targetToken: token,
              noisyToken: tokenToEvaluate,
              replacement: decision.replacement,
              confidence: decision.confidence || 0,
              reason: decision.reason || '',
              isCleanWord: false,
              rootCause,
              details: `Expected '${token}', noisy was '${tokenToEvaluate}', engine replaced with '${decision.replacement}' (conf: ${decision.confidence?.toFixed(3)})`,
            });
          }
        } else {
          analysis.confidenceDistribution.bad[confBucket] = (analysis.confidenceDistribution.bad[confBucket] || 0) + 1;

          const isKnown = engine.isKnownWord(token, item.lang);
          let rootCause = 'Clean token falsely replaced';
          if (!isKnown) rootCause = 'Clean token absent from lexicon';

          analysis.rootCauseCounts[rootCause] = (analysis.rootCauseCounts[rootCause] || 0) + 1;

          analysis.badReplacements.push({
            sentenceId: item.id,
            lang: item.lang,
            targetToken: token,
            noisyToken: tokenToEvaluate,
            replacement: decision.replacement,
            confidence: decision.confidence || 0,
            reason: decision.reason || '',
            isCleanWord: true,
            rootCause,
            details: `Clean token '${token}' known=${isKnown} falsely replaced with '${decision.replacement}'`,
          });
        }
      } else {
        if (typoMeta) {
          analysis.typoCategoryStats[typoMeta.type]!.missed++;

          const isRealWord = engine.isKnownWord(tokenToEvaluate, 'en') || engine.isKnownWord(tokenToEvaluate, 'fr');
          let rootCause = 'Rejected by thresholds (margin/freq/dist)';
          if (isRealWord) {
            rootCause = 'Real-word typo (noisy token is valid word)';
          } else if (decision.reason?.includes('No candidate')) {
            rootCause = 'No candidate in trie within max edit distance';
          } else if (decision.reason?.includes('frequency')) {
            rootCause = 'Frequency floor rejection';
          } else if (decision.reason?.includes('margin')) {
            rootCause = 'Insufficient score margin over runner-up';
          } else if (decision.reason?.includes('No-op')) {
            rootCause = 'No-op guardrail triggered on typo';
          }

          analysis.missedCauseCounts[rootCause] = (analysis.missedCauseCounts[rootCause] || 0) + 1;

          analysis.missedTypos.push({
            sentenceId: item.id,
            lang: item.lang,
            expectedToken: token,
            noisyToken: tokenToEvaluate,
            typoType: typoMeta.type,
            distance: typoMeta.distance,
            decisionAction: decision.action,
            decisionReason: decision.reason || '',
            isRealWord,
            rootCause,
            details: `Expected '${token}', noisy '${tokenToEvaluate}' (d=${typoMeta.distance}, ${typoMeta.type}), reason: ${decision.reason}`,
          });
        }
      }

      leftContext.push(tokenToEvaluate);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  const precision = (truePositives / (totalReplacements || 1)) * 100;
  const recallD1 = (d1Recovered / (d1Injected || 1)) * 100;
  const recallOverall = (truePositives / (totalInjected || 1)) * 100;
  const fpr = (cleanFp / (cleanTokens || 1)) * 100;

  console.log('\n================ BASELINE SUMMARY (DEV SPLIT) ================');
  console.log(`Clean Tokens: ${cleanTokens} | Clean FP: ${cleanFp} | Clean FPR: ${fpr.toFixed(3)}%`);
  console.log(`Injected Typos: ${totalInjected} (D1: ${d1Injected})`);
  console.log(`Total Replacements: ${totalReplacements} | True Positives: ${truePositives} | Bad Replacements: ${analysis.badReplacements.length}`);
  console.log(`Applied Precision: ${precision.toFixed(2)}% | Recall D1: ${recallD1.toFixed(2)}% | Overall Recall: ${recallOverall.toFixed(2)}%`);

  console.log('\n=== BAD REPLACEMENTS ROOT CAUSES ===');
  for (const [cause, count] of Object.entries(analysis.rootCauseCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${cause.padEnd(45)}: ${count} (${((count / analysis.badReplacements.length) * 100).toFixed(1)}%)`);
  }

  console.log('\n=== MISSED TYPOS ROOT CAUSES ===');
  for (const [cause, count] of Object.entries(analysis.missedCauseCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${cause.padEnd(45)}: ${count} (${((count / analysis.missedTypos.length) * 100).toFixed(1)}%)`);
  }

  console.log('\n=== CONFIDENCE DISTRIBUTIONS ===');
  console.log('Bucket       | True Positives | Bad Replacements | Clean FP');
  console.log('-------------+----------------+------------------+---------');
  for (const b of confBuckets) {
    const tpCount = analysis.confidenceDistribution.tp[b] || 0;
    const badCount = analysis.confidenceDistribution.bad[b] || 0;
    const fpCount = analysis.confidenceDistribution.cleanFp[b] || 0;
    console.log(`${b.padEnd(12)} | ${String(tpCount).padStart(14)} | ${String(badCount).padStart(16)} | ${String(fpCount).padStart(8)}`);
  }

  console.log('\n=== TYPO CATEGORY RECOVERY STATS ===');
  for (const [cat, stats] of Object.entries(analysis.typoCategoryStats)) {
    const recRate = ((stats.recovered / (stats.total || 1)) * 100).toFixed(1);
    console.log(`  - ${cat.padEnd(15)}: Total=${stats.total}, Recovered=${stats.recovered} (${recRate}%), Missed=${stats.missed}, Bad=${stats.badRepl}`);
  }

  fs.writeFileSync('docs/BASELINE-AUDIT.json', JSON.stringify({
    summary: { cleanTokens, cleanFp, fpr, totalInjected, d1Injected, totalReplacements, truePositives, badReplacementsCount: analysis.badReplacements.length, precision, recallD1, recallOverall },
    rootCauseCounts: analysis.rootCauseCounts,
    missedCauseCounts: analysis.missedCauseCounts,
    confidenceDistribution: analysis.confidenceDistribution,
    typoCategoryStats: analysis.typoCategoryStats,
    sampleBadReplacements: analysis.badReplacements.slice(0, 100),
    sampleMissedTypos: analysis.missedTypos.slice(0, 100),
  }, null, 2));

  console.log('\n[Baseline Audit] Saved full structured dump to docs/BASELINE-AUDIT.json');
}

run().catch(console.error);
