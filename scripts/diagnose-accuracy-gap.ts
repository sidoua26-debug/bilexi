/**
 * scripts/diagnose-accuracy-gap.ts
 * Comprehensive Phase 1 diagnostic script for accuracy gap analysis on dev data.
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

  return null;
}

async function main() {
  console.log('[Diagnostic] Initializing engine with dictionaries...');
  const enBuffer = fs.readFileSync('public/dict/en.bin');
  const frBuffer = fs.readFileSync('public/dict/fr.bin');
  const ngramBuffer = fs.readFileSync('public/dict/ngram.bin');

  const engine = createEngine({
    en: enBuffer.buffer.slice(enBuffer.byteOffset, enBuffer.byteOffset + enBuffer.byteLength),
    fr: frBuffer.buffer.slice(frBuffer.byteOffset, frBuffer.byteOffset + frBuffer.byteLength),
    ngram: ngramBuffer.buffer.slice(ngramBuffer.byteOffset, ngramBuffer.byteOffset + ngramBuffer.byteLength),
  });

  const tatoebaRaw = JSON.parse(fs.readFileSync('data/raw/tatoeba-sentences.json', 'utf-8'));
  const devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];

  for (const [id, text] of Object.entries(tatoebaRaw.en as Record<string, string>)) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'en' });
  }
  for (const [id, text] of Object.entries(tatoebaRaw.fr as Record<string, string>)) {
    if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'fr' });
  }

  console.log(`[Diagnostic] Loaded ${devCorpus.length} sentences on dev split.`);

  // 1. Clean Token False Positives Analysis
  interface CleanFPInfo {
    lang: 'en' | 'fr';
    token: string;
    replacement: string;
    length: number;
    confidence: number;
    reason: string;
  }
  const cleanFPs: CleanFPInfo[] = [];
  let totalCleanTokens = 0;

  for (const item of devCorpus) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const rawToken of rawTokens) {
      if (rawToken.length < 2) continue;
      totalCleanTokens++;

      const decision = engine.analyze({
        token: rawToken,
        boundary: ' ',
        leftContext,
        langHint: item.lang,
      });

      if (decision.action === 'replace' && decision.replacement.toLowerCase() !== rawToken.toLowerCase()) {
        cleanFPs.push({
          lang: item.lang,
          token: rawToken,
          replacement: decision.replacement,
          length: rawToken.length,
          confidence: decision.confidence,
          reason: decision.reason || 'none',
        });
      }

      leftContext.push(rawToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  // 2. Noisy Pass: Missed D1 Typos & Wrong Corrections Analysis
  interface WrongCorrectionInfo {
    lang: 'en' | 'fr';
    target: string;
    noisy: string;
    replacement: string;
    typoType: string;
    confidence: number;
  }

  interface MissedD1Info {
    lang: 'en' | 'fr';
    target: string;
    noisy: string;
    typoType: string;
    reason: string;
  }

  const wrongCorrections: WrongCorrectionInfo[] = [];
  const missedD1s: MissedD1Info[] = [];
  let totalInjectedD1 = 0;
  let totalRecoveredD1 = 0;
  let totalReplacements = 0;
  let totalTruePositives = 0;

  for (const item of devCorpus) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const token of rawTokens) {
      if (token.length < 3) continue;

      const inject = rng() < 0.083;
      let tokenToEval = token;
      let typoMeta: TypoResult | null = null;

      if (inject) {
        typoMeta = injectTypo(token, item.lang === 'fr');
        if (typoMeta && typoMeta.distance === 1) {
          totalInjectedD1++;
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
        totalReplacements++;
        const isCorrect = typoMeta && decision.replacement.toLowerCase() === token.toLowerCase();
        if (isCorrect) {
          totalTruePositives++;
          if (typoMeta.distance === 1) totalRecoveredD1++;
        } else {
          wrongCorrections.push({
            lang: item.lang,
            target: token,
            noisy: tokenToEval,
            replacement: decision.replacement,
            typoType: typoMeta ? typoMeta.type : 'clean-token',
            confidence: decision.confidence,
          });
        }
      } else {
        if (typoMeta && typoMeta.distance === 1) {
          missedD1s.push({
            lang: item.lang,
            target: token,
            noisy: typoMeta.noisy,
            typoType: typoMeta.type,
            reason: decision.reason || 'Rejected without reason',
          });
        }
      }

      leftContext.push(tokenToEval);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  console.log('\n======================================================');
  console.log('              PHASE 1 DIAGNOSTIC REPORT               ');
  console.log('======================================================');
  console.log(`Total Clean Tokens Evaluated: ${totalCleanTokens}`);
  console.log(`Clean False Positives: ${cleanFPs.length} (${((cleanFPs.length / totalCleanTokens) * 100).toFixed(4)}%)`);
  console.log(`Total Replacements on Noisy Pass: ${totalReplacements}`);
  console.log(`True Positives: ${totalTruePositives} (${((totalTruePositives / (totalReplacements || 1)) * 100).toFixed(2)}% precision)`);
  console.log(`Wrong Corrections: ${wrongCorrections.length}`);
  console.log(`Total D1 Injected: ${totalInjectedD1}`);
  console.log(`Total D1 Recovered: ${totalRecoveredD1} (${((totalRecoveredD1 / (totalInjectedD1 || 1)) * 100).toFixed(2)}% recall)`);
  console.log(`Missed D1 Typos: ${missedD1s.length}`);

  // Breakdown 1: Clean FPs by Language & Length
  console.log('\n--- 1. Clean False Positives Breakdown ---');
  const fpByLang = { en: 0, fr: 0 };
  const fpByLen: Record<number, number> = {};
  for (const fp of cleanFPs) {
    fpByLang[fp.lang]++;
    fpByLen[fp.length] = (fpByLen[fp.length] || 0) + 1;
  }
  console.log('By Language:', fpByLang);
  console.log('By Length:', fpByLen);
  console.log('Sample Clean FPs:', cleanFPs.slice(0, 10));

  // Breakdown 2: Wrong Corrections Breakdown
  console.log('\n--- 2. Wrong Corrections Breakdown ---');
  const wrongByLang = { en: 0, fr: 0 };
  const wrongByType: Record<string, number> = {};
  for (const wc of wrongCorrections) {
    wrongByLang[wc.lang]++;
    wrongByType[wc.typoType] = (wrongByType[wc.typoType] || 0) + 1;
  }
  console.log('By Language:', wrongByLang);
  console.log('By Source Typo Type:', wrongByType);
  console.log('Sample Wrong Corrections:', wrongCorrections.slice(0, 15));

  // Breakdown 3: Missed D1 Typos Breakdown
  console.log('\n--- 3. Missed D1 Typos Breakdown ---');
  const missedByLang = { en: 0, fr: 0 };
  const missedByType: Record<string, number> = {};
  const missedByReason: Record<string, number> = {};
  for (const m of missedD1s) {
    missedByLang[m.lang]++;
    missedByType[m.typoType] = (missedByType[m.typoType] || 0) + 1;
    missedByReason[m.reason] = (missedByReason[m.reason] || 0) + 1;
  }
  console.log('By Language:', missedByLang);
  console.log('By Typo Type:', missedByType);
  console.log('By Engine Rejection Reason:', missedByReason);
  console.log('Sample Missed D1s:', missedD1s.slice(0, 15));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
