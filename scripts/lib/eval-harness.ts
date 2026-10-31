/**
 * scripts/lib/eval-harness.ts
 *
 * Single, unified evaluation harness for bilingual autocorrect:
 * - Dataset splitting (Dev vs Held-Out Test on Tatoeba)
 * - Deterministic typo injection with keyboard layouts (QWERTY / AZERTY)
 * - Engine construction and standard benchmarking
 * - Evaluation with configurable language-hint policies (production vs oracle)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../../engine/engine';
import { fold, hashString } from '../../engine/normalize';
import type { EngineSettings } from '../../engine/types';

export type AutocorrectEngine = ReturnType<typeof createEngine>;
export type EngineOptions = Partial<EngineSettings>;

export const DEFAULT_SEED = 20261016;

export interface SentenceItem {
  id: string;
  text: string;
  lang: 'en' | 'fr';
}

export interface SanityItem {
  id: string;
  text: string;
  lang: 'en' | 'fr' | 'mixed';
}

export interface TypoResult {
  noisy: string;
  type: 'substitution' | 'transposition' | 'omission' | 'duplication' | 'accent-drop' | 'distance-2';
  distance: 1 | 2;
}

export interface MetricsPerLang {
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

  // Two-Tier Metrics (WP2)
  d1VisibleRecovered: number;
  d1CandidateRecovered: number;
  d1CombinedRecovered: number;
  combinedRecallD1: number;
  candidateCombinedRecallD1: number;
  visibleRecallD1: number;
  candidateRecallD1: number;

  // Mutually Exclusive Categories for Distance-1 Mutations (WP1)
  // Category 1: Valid in target language dictionary
  d1TargetWordInjected: number;
  d1TargetWordAutoRecovered: number;
  d1TargetWordVisibleRecovered: number;
  d1TargetWordCandidateRecovered: number;
  d1TargetWordCombinedRecovered: number;
  d1TargetWordAutoRecall: number;
  d1TargetWordCombinedRecall: number;

  // Category 2: Valid ONLY in other language dictionary
  d1OtherWordInjected: number;
  d1OtherWordAutoRecovered: number;
  d1OtherWordVisibleRecovered: number;
  d1OtherWordCandidateRecovered: number;
  d1OtherWordCombinedRecovered: number;
  d1OtherWordAutoRecall: number;
  d1OtherWordCombinedRecall: number;

  // Category 3: Genuine non-word (neither dictionary)
  d1NonWordInjected: number;
  d1NonWordAutoRecovered: number;
  d1NonWordVisibleRecovered: number;
  d1NonWordCandidateRecovered: number;
  d1NonWordCombinedRecovered: number;
  d1NonWordAutoRecall: number;
  d1NonWordCombinedRecall: number;

  // Real-word totals (Cat 1 + Cat 2) for backwards compatibility
  d1RealWordInjected: number;
  d1RealWordAutoRecovered: number;
  d1RealWordCombinedRecovered: number;
  d1RealWordAutoRecall: number;
  d1RealWordCombinedRecall: number;
}

export interface CleanFpDetail {
  sentenceId: string;
  token: string;
  replacement: string;
  lang: 'en' | 'fr';
  context: string[];
  reason?: string;
}

export interface BadReplacementDetail {
  sentenceId: string;
  original: string;
  noisy: string;
  replacement: string;
  lang: 'en' | 'fr';
  type: string;
  distance: number;
  reason?: string;
}

export interface SplitMetrics {
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
  cleanFpDetails: CleanFpDetail[];
  badReplacementDetails: BadReplacementDetail[];
}

export interface EvalOptions {
  langHintPolicy?: 'production' | 'oracle' | 'none';
  seed?: number;
  collectDetails?: boolean;
}

export function createMulberry32(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const QWERTY_NEIGHBORS: Record<string, string[]> = {
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

export const AZERTY_NEIGHBORS: Record<string, string[]> = {
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

export function getTokenSeed(sentenceId: string, tokenIndex: number, baseSeed = DEFAULT_SEED): number {
  return hashString(`${baseSeed}:${sentenceId}:${tokenIndex}`);
}

export function injectTypoWithRng(word: string, isFr: boolean, rng: () => number): TypoResult | null {
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
      const char2 = word[idx2]!.toLowerCase();
      const list1 = neighbors[char1];
      const list2 = neighbors[char2];
      if (list1 && list1.length > 0 && list2 && list2.length > 0) {
        const sub1 = list1[Math.floor(rng() * list1.length)]!;
        const sub2 = list2[Math.floor(rng() * list2.length)]!;
        const noisy =
          word.slice(0, idx1) +
          sub1 +
          word.slice(idx1 + 1, idx2) +
          sub2 +
          word.slice(idx2 + 1);
        return { noisy, type: 'distance-2', distance: 2 };
      }
    }

    return null;
}

export function createTypoInjector(rng: () => number) {
  return function injectTypo(word: string, isFr: boolean): TypoResult | null {
    return injectTypoWithRng(word, isFr, rng);
  };
}

export function loadCorpora(baseDir = '.') {
  const tatoebaPath = path.resolve(baseDir, 'data/raw/tatoeba-sentences.json');
  const sanityPath = path.resolve(baseDir, 'data/sanity-sentences.json');

  if (!fs.existsSync(tatoebaPath)) {
    throw new Error(`Tatoeba sentences not found at ${tatoebaPath}`);
  }

  const tatoebaRaw = JSON.parse(fs.readFileSync(tatoebaPath, 'utf-8'));
  const enTatoeba = Object.entries(tatoebaRaw.en as Record<string, string>);
  const frTatoeba = Object.entries(tatoebaRaw.fr as Record<string, string>);

  const dev: SentenceItem[] = [];
  const test: SentenceItem[] = [];

  for (const [id, text] of enTatoeba) {
    if (hashString(id) % 10 < 6) {
      dev.push({ id, text, lang: 'en' });
    } else {
      test.push({ id, text, lang: 'en' });
    }
  }

  for (const [id, text] of frTatoeba) {
    if (hashString(id) % 10 < 6) {
      dev.push({ id, text, lang: 'fr' });
    } else {
      test.push({ id, text, lang: 'fr' });
    }
  }

  const sanity: SanityItem[] = [];
  if (fs.existsSync(sanityPath)) {
    const sanityRaw = JSON.parse(fs.readFileSync(sanityPath, 'utf-8'));
    for (let i = 0; i < (sanityRaw.en || []).length; i++) {
      sanity.push({ id: `sanity-en-${i}`, text: sanityRaw.en[i], lang: 'en' });
    }
    for (let i = 0; i < (sanityRaw.fr || []).length; i++) {
      sanity.push({ id: `sanity-fr-${i}`, text: sanityRaw.fr[i], lang: 'fr' });
    }
    for (let i = 0; i < (sanityRaw.mixed || []).length; i++) {
      sanity.push({ id: `sanity-mixed-${i}`, text: sanityRaw.mixed[i], lang: 'mixed' });
    }
  }

  return { dev, test, sanity };
}

export function createStandardEngine(
  dictDir = 'public/dict',
  customEngineFn = createEngine,
  options?: Partial<EngineOptions>
): AutocorrectEngine {
  const enBinPath = path.resolve(dictDir, 'en.bin');
  const frBinPath = path.resolve(dictDir, 'fr.bin');
  const ngBinPath = path.resolve(dictDir, 'ngram.bin');

  if (!fs.existsSync(enBinPath) || !fs.existsSync(frBinPath)) {
    throw new Error(`Binary dictionaries missing in ${dictDir}`);
  }

  const enBuf = fs.readFileSync(enBinPath);
  const frBuf = fs.readFileSync(frBinPath);
  const ngBuf = fs.existsSync(ngBinPath) ? fs.readFileSync(ngBinPath) : undefined;

  return customEngineFn(
    { en: enBuf, fr: frBuf, ngram: ngBuf },
    {
      languageMode: 'auto',
      sensitivity: 'balanced',
      layout: 'auto',
      sentenceCaps: true,
      fixLoneI: true,
      ...options,
    }
  );
}

function normApos(s: string): string {
  return s.replace(/’/g, "'");
}

export function evaluateCorpus(
  corpus: SentenceItem[],
  engine: any,
  options: EvalOptions = {}
): SplitMetrics {
  const seed = options.seed ?? DEFAULT_SEED;
  const policy = options.langHintPolicy ?? 'production';
  const collectDetails = options.collectDetails ?? false;


  const initLang = (): MetricsPerLang => ({
    cleanTokens: 0,
    cleanFp: 0,
    cleanFpr: 0,
    injected: 0,
    d1Injected: 0,
    d2Injected: 0,
    d1Recovered: 0,
    d2Recovered: 0,
    replacements: 0,
    truePositives: 0,
    badReplacements: 0,
    appliedPrecision: 0,
    recallOverall: 0,
    recallD1: 0,
    recallD2: 0,

    d1VisibleRecovered: 0,
    d1CandidateRecovered: 0,
    d1CombinedRecovered: 0,
    combinedRecallD1: 0,
    candidateCombinedRecallD1: 0,
    visibleRecallD1: 0,
    candidateRecallD1: 0,

    d1TargetWordInjected: 0,
    d1TargetWordAutoRecovered: 0,
    d1TargetWordVisibleRecovered: 0,
    d1TargetWordCandidateRecovered: 0,
    d1TargetWordCombinedRecovered: 0,
    d1TargetWordAutoRecall: 0,
    d1TargetWordCombinedRecall: 0,

    d1OtherWordInjected: 0,
    d1OtherWordAutoRecovered: 0,
    d1OtherWordVisibleRecovered: 0,
    d1OtherWordCandidateRecovered: 0,
    d1OtherWordCombinedRecovered: 0,
    d1OtherWordAutoRecall: 0,
    d1OtherWordCombinedRecall: 0,

    d1NonWordInjected: 0,
    d1NonWordAutoRecovered: 0,
    d1NonWordVisibleRecovered: 0,
    d1NonWordCandidateRecovered: 0,
    d1NonWordCombinedRecovered: 0,
    d1NonWordAutoRecall: 0,
    d1NonWordCombinedRecall: 0,

    d1RealWordInjected: 0,
    d1RealWordAutoRecovered: 0,
    d1RealWordCombinedRecovered: 0,
    d1RealWordAutoRecall: 0,
    d1RealWordCombinedRecall: 0,
  });

  const overall = initLang();
  const en = initLang();
  const fr = initLang();

  const typoCategories: Record<string, { total: number; recovered: number }> = {
    substitution: { total: 0, recovered: 0 },
    transposition: { total: 0, recovered: 0 },
    omission: { total: 0, recovered: 0 },
    duplication: { total: 0, recovered: 0 },
    'accent-drop': { total: 0, recovered: 0 },
    'distance-2': { total: 0, recovered: 0 },
  };

  const latenciesMs: number[] = [];
  const cleanFpDetails: CleanFpDetail[] = [];
  const badReplacementDetails: BadReplacementDetail[] = [];
  const distinctTokens = new Set<string>();
  let totalTokens = 0;

  // Helper to determine langHint given policy
  const getLangHint = (itemLang: 'en' | 'fr'): 'en' | 'fr' | undefined => {
    if (policy === 'oracle') return itemLang;
    // 'production' or 'none': in content script, langHint comes from target.getAttribute('lang') || document.documentElement.lang
    // When unannotated or bilingual typing on web pages, this is undefined
    return undefined;
  };

  // 1. Clean Pass (measures Clean Token FPR)
  for (const item of corpus) {
    engine.resetStickyLanguage?.();
    const targetLang = item.lang === 'fr' ? fr : en;
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const rawToken of rawTokens) {
      if (rawToken.length < 2) continue;
      totalTokens++;
      distinctTokens.add(rawToken.toLowerCase());

      overall.cleanTokens++;
      targetLang.cleanTokens++;

      const decision = engine.analyze({
        token: rawToken,
        boundary: ' ',
        leftContext,
        langHint: getLangHint(item.lang),
      });
      if (decision.action === 'replace') {
        const rep = decision.replacement;
        if (normApos(rep.toLowerCase()) !== normApos(rawToken.toLowerCase())) {
          overall.cleanFp++;
          targetLang.cleanFp++;
          if (collectDetails) {
            cleanFpDetails.push({
              sentenceId: item.id,
              token: rawToken,
              replacement: rep,
              lang: item.lang,
              context: [...leftContext],
              reason: decision.reason,
            });
          }
        }
      }

      leftContext.push(rawToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  overall.cleanFpr = (overall.cleanFp / (overall.cleanTokens || 1)) * 100;
  en.cleanFpr = (en.cleanFp / (en.cleanTokens || 1)) * 100;
  fr.cleanFpr = (fr.cleanFp / (fr.cleanTokens || 1)) * 100;

  // 2. Noisy Pass (measures Precision & Typo Recall)
  for (const item of corpus) {
    engine.resetStickyLanguage?.();
    const targetLang = item.lang === 'fr' ? fr : en;
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (let tokenIdx = 0; tokenIdx < rawTokens.length; tokenIdx++) {
      const token = rawTokens[tokenIdx]!;
      if (token.length < 3) continue;

      const tokenSeed = getTokenSeed(item.id, tokenIdx, seed);
      const tokenRng = createMulberry32(tokenSeed);

      const inject = tokenRng() < 0.083; // 1 in 12
      let tokenToEvaluate = token;
      let typoMeta: TypoResult | null = null;

      if (inject) {
        typoMeta = injectTypoWithRng(token, item.lang === 'fr', tokenRng);
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
        langHint: getLangHint(item.lang),
      });
      const tElapsed = performance.now() - tStart;
      latenciesMs.push(tElapsed);

      let autoRecoveredD1 = false;
      const expected = token.toLowerCase();

      if (decision.action === 'replace') {
        overall.replacements++;
        targetLang.replacements++;
        const rep = decision.replacement.toLowerCase();

        if (typoMeta) {
          if (normApos(rep) === normApos(expected)) {
            overall.truePositives++;
            targetLang.truePositives++;
            if (typoMeta.distance === 1) {
              overall.d1Recovered++;
              targetLang.d1Recovered++;
              autoRecoveredD1 = true;
            }
            if (typoMeta.distance === 2) {
              overall.d2Recovered++;
              targetLang.d2Recovered++;
            }
            typoCategories[typoMeta.type]!.recovered++;
          } else {
            overall.badReplacements++;
            targetLang.badReplacements++;
            if (collectDetails) {
              badReplacementDetails.push({
                sentenceId: item.id,
                original: token,
                noisy: tokenToEvaluate,
                replacement: decision.replacement,
                lang: item.lang,
                type: typoMeta.type,
                distance: typoMeta.distance,
                reason: decision.reason,
              });
            }
          }
        } else {
          overall.badReplacements++;
          targetLang.badReplacements++;
          if (collectDetails) {
            badReplacementDetails.push({
              sentenceId: item.id,
              original: token,
              noisy: tokenToEvaluate,
              replacement: decision.replacement,
              lang: item.lang,
              type: 'false_trigger_on_clean',
              distance: 0,
              reason: decision.reason,
            });
          }
        }
      }

      // Two-tier evaluation & mutually exclusive classification for distance-1 typos
      if (typoMeta && typoMeta.distance === 1) {
        const otherLang = item.lang === 'fr' ? 'en' : 'fr';
        const inTarget = engine.isKnownWord(tokenToEvaluate.toLowerCase(), item.lang);
        const inOther = engine.isKnownWord(tokenToEvaluate.toLowerCase(), otherLang);
        const inOtherOnly = !inTarget && inOther;

        if (inTarget) {
          overall.d1TargetWordInjected++;
          targetLang.d1TargetWordInjected++;
          overall.d1RealWordInjected++;
          targetLang.d1RealWordInjected++;
          if (autoRecoveredD1) {
            overall.d1TargetWordAutoRecovered++;
            targetLang.d1TargetWordAutoRecovered++;
            overall.d1RealWordAutoRecovered++;
            targetLang.d1RealWordAutoRecovered++;
          }
        } else if (inOtherOnly) {
          overall.d1OtherWordInjected++;
          targetLang.d1OtherWordInjected++;
          overall.d1RealWordInjected++;
          targetLang.d1RealWordInjected++;
          if (autoRecoveredD1) {
            overall.d1OtherWordAutoRecovered++;
            targetLang.d1OtherWordAutoRecovered++;
            overall.d1RealWordAutoRecovered++;
            targetLang.d1RealWordAutoRecovered++;
          }
        } else {
          overall.d1NonWordInjected++;
          targetLang.d1NonWordInjected++;
          if (autoRecoveredD1) {
            overall.d1NonWordAutoRecovered++;
            targetLang.d1NonWordAutoRecovered++;
          }
        }

        // Suggestions evaluation
        const suggs = engine.suggest({
          token: tokenToEvaluate,
          boundary: ' ',
          leftContext,
          langHint: getLangHint(item.lang),
        });

        const expectedLow = expected;
        // Visible strip slots 2 & 3: top 2 candidates
        const inVisibleSuggs = suggs.slice(0, 2).some((s: string) => normApos(s.toLowerCase()) === normApos(expectedLow));
        // All returned candidates (up to 3)
        const inAllSuggs = suggs.some((s: string) => normApos(s.toLowerCase()) === normApos(expectedLow));

        const visibleRecovered = autoRecoveredD1 || inVisibleSuggs;
        const candidateRecovered = autoRecoveredD1 || inAllSuggs;

        if (visibleRecovered) {
          overall.d1CombinedRecovered++;
          targetLang.d1CombinedRecovered++;
          overall.d1VisibleRecovered++;
          targetLang.d1VisibleRecovered++;
          if (inTarget) {
            overall.d1TargetWordVisibleRecovered++;
            targetLang.d1TargetWordVisibleRecovered++;
            overall.d1TargetWordCombinedRecovered++;
            targetLang.d1TargetWordCombinedRecovered++;
            overall.d1RealWordCombinedRecovered++;
            targetLang.d1RealWordCombinedRecovered++;
          } else if (inOtherOnly) {
            overall.d1OtherWordVisibleRecovered++;
            targetLang.d1OtherWordVisibleRecovered++;
            overall.d1OtherWordCombinedRecovered++;
            targetLang.d1OtherWordCombinedRecovered++;
            overall.d1RealWordCombinedRecovered++;
            targetLang.d1RealWordCombinedRecovered++;
          } else {
            overall.d1NonWordVisibleRecovered++;
            targetLang.d1NonWordVisibleRecovered++;
            overall.d1NonWordCombinedRecovered++;
            targetLang.d1NonWordCombinedRecovered++;
          }
        }

        if (candidateRecovered) {
          overall.d1CandidateRecovered++;
          targetLang.d1CandidateRecovered++;
          if (inTarget) {
            overall.d1TargetWordCandidateRecovered++;
            targetLang.d1TargetWordCandidateRecovered++;
          } else if (inOtherOnly) {
            overall.d1OtherWordCandidateRecovered++;
            targetLang.d1OtherWordCandidateRecovered++;
          } else {
            overall.d1NonWordCandidateRecovered++;
            targetLang.d1NonWordCandidateRecovered++;
          }
        }
      }

      leftContext.push(tokenToEvaluate);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  // Summary ratios
  for (const m of [overall, en, fr]) {
    m.appliedPrecision = (m.truePositives / (m.replacements || 1)) * 100;
    m.recallOverall = (m.truePositives / (m.injected || 1)) * 100;
    m.recallD1 = (m.d1Recovered / (m.d1Injected || 1)) * 100;
    m.recallD2 = (m.d2Recovered / (m.d2Injected || 1)) * 100;

    m.combinedRecallD1 = (m.d1CombinedRecovered / (m.d1Injected || 1)) * 100;
    m.candidateCombinedRecallD1 = (m.d1CandidateRecovered / (m.d1Injected || 1)) * 100;
    m.visibleRecallD1 = (m.d1VisibleRecovered / (m.d1Injected || 1)) * 100;
    m.candidateRecallD1 = (m.d1CandidateRecovered / (m.d1Injected || 1)) * 100;

    m.d1TargetWordAutoRecall = (m.d1TargetWordAutoRecovered / (m.d1TargetWordInjected || 1)) * 100;
    m.d1TargetWordCombinedRecall = (m.d1TargetWordCombinedRecovered / (m.d1TargetWordInjected || 1)) * 100;
    m.d1OtherWordAutoRecall = (m.d1OtherWordAutoRecovered / (m.d1OtherWordInjected || 1)) * 100;
    m.d1OtherWordCombinedRecall = (m.d1OtherWordCombinedRecovered / (m.d1OtherWordInjected || 1)) * 100;
    m.d1NonWordAutoRecall = (m.d1NonWordAutoRecovered / (m.d1NonWordInjected || 1)) * 100;
    m.d1NonWordCombinedRecall = (m.d1NonWordCombinedRecovered / (m.d1NonWordInjected || 1)) * 100;
    m.d1RealWordAutoRecall = (m.d1RealWordAutoRecovered / (m.d1RealWordInjected || 1)) * 100;
    m.d1RealWordCombinedRecall = (m.d1RealWordCombinedRecovered / (m.d1RealWordInjected || 1)) * 100;
  }

  // Programmatic Invariant Assertions (WP 4)
  for (const m of [overall, en, fr]) {
    if (m.truePositives > m.replacements) throw new Error(`Invariant: truePositives (${m.truePositives}) > replacements (${m.replacements})`);
    if (m.d1Recovered > m.d1Injected) throw new Error(`Invariant: d1Recovered (${m.d1Recovered}) > d1Injected (${m.d1Injected})`);
    if (m.cleanFp > m.cleanTokens) throw new Error(`Invariant: cleanFp (${m.cleanFp}) > cleanTokens (${m.cleanTokens})`);
    if (m.d1NonWordAutoRecovered > m.d1Recovered) throw new Error(`Invariant: nonWordAuto (${m.d1NonWordAutoRecovered}) > d1Recovered (${m.d1Recovered})`);
    if (m.d1Recovered > m.d1CombinedRecovered) throw new Error(`Invariant: d1Recovered (${m.d1Recovered}) > d1CombinedRecovered (${m.d1CombinedRecovered})`);
    if (m.d1VisibleRecovered > m.d1CandidateRecovered) throw new Error(`Invariant: d1VisibleRecovered (${m.d1VisibleRecovered}) > d1CandidateRecovered (${m.d1CandidateRecovered})`);

    // Mutually exclusive 3-category partition invariants (WP 1)
    if (m.d1TargetWordInjected + m.d1OtherWordInjected + m.d1NonWordInjected !== m.d1Injected) {
      throw new Error(`Invariant: target (${m.d1TargetWordInjected}) + other (${m.d1OtherWordInjected}) + nonWord (${m.d1NonWordInjected}) !== d1Injected (${m.d1Injected})`);
    }
    if (m.d1TargetWordAutoRecovered + m.d1OtherWordAutoRecovered + m.d1NonWordAutoRecovered !== m.d1Recovered) {
      throw new Error(`Invariant: targetAuto (${m.d1TargetWordAutoRecovered}) + otherAuto (${m.d1OtherWordAutoRecovered}) + nonWordAuto (${m.d1NonWordAutoRecovered}) !== d1Recovered (${m.d1Recovered})`);
    }
    if (m.d1TargetWordCombinedRecovered + m.d1OtherWordCombinedRecovered + m.d1NonWordCombinedRecovered !== m.d1CombinedRecovered) {
      throw new Error(`Invariant: targetComb (${m.d1TargetWordCombinedRecovered}) + otherComb (${m.d1OtherWordCombinedRecovered}) + nonWordComb (${m.d1NonWordCombinedRecovered}) !== d1CombinedRecovered (${m.d1CombinedRecovered})`);
    }
    if (m.d1NonWordInjected + m.d1RealWordInjected !== m.d1Injected) throw new Error(`Invariant: nonWordInjected (${m.d1NonWordInjected}) + realWordInjected (${m.d1RealWordInjected}) !== d1Injected (${m.d1Injected})`);
    if (m.d1NonWordAutoRecovered + m.d1RealWordAutoRecovered !== m.d1Recovered) throw new Error(`Invariant: nonWordAuto (${m.d1NonWordAutoRecovered}) + realWordAuto (${m.d1RealWordAutoRecovered}) !== d1Recovered (${m.d1Recovered})`);
    if (m.d1NonWordCombinedRecovered + m.d1RealWordCombinedRecovered !== m.d1CombinedRecovered) throw new Error(`Invariant: nonWordComb (${m.d1NonWordCombinedRecovered}) + realWordComb (${m.d1RealWordCombinedRecovered}) !== d1CombinedRecovered (${m.d1CombinedRecovered})`);
  }

  if (en.cleanTokens + fr.cleanTokens !== overall.cleanTokens) throw new Error('Partition mismatch: cleanTokens');
  if (en.cleanFp + fr.cleanFp !== overall.cleanFp) throw new Error('Partition mismatch: cleanFp');
  if (en.replacements + fr.replacements !== overall.replacements) throw new Error('Partition mismatch: replacements');
  if (en.truePositives + fr.truePositives !== overall.truePositives) throw new Error('Partition mismatch: truePositives');
  if (en.d1Injected + fr.d1Injected !== overall.d1Injected) throw new Error('Partition mismatch: d1Injected');
  if (en.d1Recovered + fr.d1Recovered !== overall.d1Recovered) throw new Error('Partition mismatch: d1Recovered');
  if (en.d1CombinedRecovered + fr.d1CombinedRecovered !== overall.d1CombinedRecovered) throw new Error('Partition mismatch: d1CombinedRecovered');
  if (en.d1VisibleRecovered + fr.d1VisibleRecovered !== overall.d1VisibleRecovered) throw new Error('Partition mismatch: d1VisibleRecovered');
  if (en.d1CandidateRecovered + fr.d1CandidateRecovered !== overall.d1CandidateRecovered) throw new Error('Partition mismatch: d1CandidateRecovered');
  if (en.d1TargetWordInjected + fr.d1TargetWordInjected !== overall.d1TargetWordInjected) throw new Error('Partition mismatch: d1TargetWordInjected');
  if (en.d1OtherWordInjected + fr.d1OtherWordInjected !== overall.d1OtherWordInjected) throw new Error('Partition mismatch: d1OtherWordInjected');
  if (en.d1NonWordInjected + fr.d1NonWordInjected !== overall.d1NonWordInjected) throw new Error('Partition mismatch: d1NonWordInjected');
  if (en.d1TargetWordAutoRecovered + fr.d1TargetWordAutoRecovered !== overall.d1TargetWordAutoRecovered) throw new Error('Partition mismatch: d1TargetWordAutoRecovered');
  if (en.d1OtherWordAutoRecovered + fr.d1OtherWordAutoRecovered !== overall.d1OtherWordAutoRecovered) throw new Error('Partition mismatch: d1OtherWordAutoRecovered');
  if (en.d1NonWordAutoRecovered + fr.d1NonWordAutoRecovered !== overall.d1NonWordAutoRecovered) throw new Error('Partition mismatch: d1NonWordAutoRecovered');

  latenciesMs.sort((a, b) => a - b);
  const p50 = latenciesMs[Math.floor(latenciesMs.length * 0.50)] || 0;
  const p95 = latenciesMs[Math.floor(latenciesMs.length * 0.95)] || 0;
  const p99 = latenciesMs[Math.floor(latenciesMs.length * 0.99)] || 0;

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
    cleanFpDetails,
    badReplacementDetails,
  };
}
