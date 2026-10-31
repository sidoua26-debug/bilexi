/**
 * scripts/analyze-errors.ts
 * Deep error analysis on the dev split prior to tuning (C1).
 * Samples 200 wrongly applied corrections and categorizes them into:
 *   1. True word absent from dictionary
 *   2. Wrong but more frequent neighbor picked
 *   3. Proper noun / Name wrongly corrected
 *   4. Clean token wrongly flagged as unknown
 *   5. Elision / Accent confusion
 *   6. Other
 * Also analyzes omission failures.
 */

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

const rng = createMulberry32(SEED);

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

function injectTypo(word: string, isFr: boolean): TypoResult | null {
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
}

interface WrongCorrectionRecord {
  sentenceId: string;
  lang: 'en' | 'fr';
  sourceToken: string;
  noisyToken: string;
  replacement: string;
  isCleanToken: boolean;
  category: string;
  details: string;
}

interface OmissionRecord {
  sentenceId: string;
  lang: 'en' | 'fr';
  expectedToken: string;
  noisyToken: string;
  typoType: string;
  reason: string;
}

async function runAnalysis() {
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
  for (const [id, text] of enTatoeba) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'en' });
  }
  for (const [id, text] of frTatoeba) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'fr' });
  }

  console.log(`[C1 Error Analysis] Loaded dev split with ${devCorpus.length} sentences. Processing...`);

  const wrongCorrections: WrongCorrectionRecord[] = [];
  const omissions: OmissionRecord[] = [];

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

      if (rep !== null) {
        if (rep !== expected) {
          let category = 'Other';
          let details = '';

          const isClean = !typoMeta;
          const isExpectedKnown = engine.isKnownWord(token, item.lang);
          const isProperNoun = /^[A-Z][a-z]+$/.test(token) && leftContext.length > 0;
          const hasApos = token.includes("'") || token.includes('’') || rep.includes("'") || rep.includes('’');

          if (isClean) {
            if (isProperNoun) {
              category = 'Proper noun / Name wrongly corrected';
              details = `Proper noun '${token}' normalized or replaced with '${decision.replacement}'`;
            } else if (!isExpectedKnown) {
              category = 'Clean token absent from dictionary (flagged unknown)';
              details = `Clean word '${token}' not in validity index; replaced with '${decision.replacement}'`;
            } else {
              category = 'Clean token wrongly flagged unknown';
              details = `Clean token '${token}' known=${isExpectedKnown} replaced with '${decision.replacement}'`;
            }
          } else {
            if (!isExpectedKnown) {
              category = 'True word absent from dictionary';
              details = `Target word '${token}' not in candidate index; engine chose nearest neighbor '${decision.replacement}'`;
            } else if (hasApos || tokenToEvaluate.includes("'") || tokenToEvaluate.includes('’')) {
              category = 'Elision / Accent confusion';
              details = `Apostrophe or accent mismatch between expected '${token}' and '${decision.replacement}'`;
            } else {
              category = 'Wrong but more frequent neighbor';
              details = `Noisy '${tokenToEvaluate}' (target '${token}') corrected to more frequent '${decision.replacement}'`;
            }
          }

          wrongCorrections.push({
            sentenceId: item.id,
            lang: item.lang,
            sourceToken: token,
            noisyToken: tokenToEvaluate,
            replacement: decision.replacement,
            isCleanToken: isClean,
            category,
            details,
          });
        }
      } else {
        if (typoMeta) {
          omissions.push({
            sentenceId: item.id,
            lang: item.lang,
            expectedToken: token,
            noisyToken: tokenToEvaluate,
            typoType: typoMeta.type,
            reason: decision.reason || 'None',
          });
        }
      }

      leftContext.push(tokenToEvaluate);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  console.log(`\nFound ${wrongCorrections.length} total wrongly applied corrections on dev split.`);
  console.log(`Found ${omissions.length} total omission failures on dev split.\n`);

  const sampleRng = createMulberry32(20261016);
  const shuffledWrong = [...wrongCorrections].sort(() => sampleRng() - 0.5);
  const sampled200 = shuffledWrong.slice(0, 200);

  const categoryCounts: Record<string, number> = {};
  for (const item of sampled200) {
    categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
  }

  console.log('========================================================================================');
  console.log('       C1: ERROR ANALYSIS - 200 WRONGLY APPLIED CORRECTIONS BREAKDOWN (DEV SPLIT)       ');
  console.log('========================================================================================');
  console.log('Category'.padEnd(55) + 'Count'.padEnd(10) + 'Percentage');
  console.log('-'.repeat(75));
  for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / 200) * 100).toFixed(1);
    console.log(`${cat.padEnd(55)}${String(count).padEnd(10)}${pct}%`);
  }
  console.log('='.repeat(75) + '\n');

  console.log('=== SAMPLE OF 20 SPECIFIC WRONG CORRECTIONS FROM THE 200 SAMPLE ===');
  for (let i = 0; i < Math.min(20, sampled200.length); i++) {
    const rec = sampled200[i]!;
    console.log(
      `[${rec.lang.toUpperCase()}] '${rec.noisyToken}' (target: '${rec.sourceToken}') -> '${rec.replacement}' | Category: ${rec.category}`
    );
  }
  console.log('===================================================================\n');

  const omissionReasons: Record<string, number> = {};
  const omissionByTypo: Record<string, number> = {};
  for (const o of omissions) {
    omissionReasons[o.reason] = (omissionReasons[o.reason] || 0) + 1;
    omissionByTypo[o.typoType] = (omissionByTypo[o.typoType] || 0) + 1;
  }

  console.log('========================================================================================');
  console.log('                     C1: OMISSION FAILURES BREAKDOWN (DEV SPLIT)                        ');
  console.log('========================================================================================');
  console.log('1. By Engine Rejection Reason:');
  for (const [reason, count] of Object.entries(omissionReasons).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / omissions.length) * 100).toFixed(1);
    console.log(`   - ${reason.padEnd(45)}: ${String(count).padEnd(6)} (${pct}%)`);
  }
  console.log('\n2. By Typo Category:');
  for (const [typo, count] of Object.entries(omissionByTypo).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / omissions.length) * 100).toFixed(1);
    console.log(`   - ${typo.padEnd(45)}: ${String(count).padEnd(6)} (${pct}%)`);
  }
  console.log('========================================================================================\n');
}

runAnalysis().catch((err) => {
  console.error(err);
  process.exit(1);
});
