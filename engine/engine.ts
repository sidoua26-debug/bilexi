/**
 * Core Bilingual Autocorrect NLP Engine (100% Pure TypeScript, zero DOM/Chrome API)
 */

import {
  AnalyzeContext,
  EngineDecision,
  EngineSettings,
} from './types';
import { normalize, fold } from './normalize';
import { splitElision, getPotentialElisions } from './tokenize';
import { LanguageIndex, parseBinaryIndex } from './index';
import { weightedDistance } from './distance';
import { lookupRuleEn } from './rules-en';
import { lookupRuleFr } from './rules-fr';
import { computeLanguagePosterior, COMMON_EN_FUNCTION_WORDS } from './language';
import { matchCase, isSentenceInitial } from './case';
import { isNoOpToken, getThresholds } from './decide';
import { ContextModel } from './context';

export interface EngineData {
  en?: ArrayBuffer | Uint8Array;
  fr?: ArrayBuffer | Uint8Array;
  ngram?: ArrayBuffer | Uint8Array;
}

export const DEFAULT_ENGINE_SETTINGS: EngineSettings = {
  languageMode: 'auto',
  sensitivity: 'balanced',
  layout: 'auto',
  sentenceCaps: true,
  fixLoneI: true,
  typographicApostrophe: false,
};

const FRENCH_POST_HYPHEN_CLITICS = new Set([
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'ce',
  'moi', 'toi', 'lui', 'le', 'la', 'les', 'leur', 'en', 'y',
  't-il', 't-elle', 't-on',
  'là', 'ci', 'même', 'mêmes',
]);

const STANDARD_ENGLISH_CONTRACTIONS: readonly string[] = [
  "don't", "doesn't", "didn't", "won't", "can't", "couldn't", "shouldn't", "wouldn't",
  "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "i'm", "i've", "i'll", "i'd",
  "you're", "you've", "you'll", "you'd",
  "he's", "he'll", "he'd",
  "she's", "she'll", "she'd",
  "it's", "it'll", "it'd",
  "we're", "we've", "we'll", "we'd",
  "they're", "they've", "they'll", "they'd",
  "that's", "what's", "who's", "there's", "here's", "where's", "how's",
  "let's",
];

function isFrenchHyphenatedClitic(token: string, frIndex: LanguageIndex | null): boolean {
  if (!frIndex) return false;
  const lower = token.toLowerCase();
  const firstHyphen = lower.indexOf('-');
  if (firstHyphen <= 0 || firstHyphen >= lower.length - 1) return false;

  const stem = lower.slice(0, firstHyphen);
  const suffix = lower.slice(firstHyphen + 1);

  if (FRENCH_POST_HYPHEN_CLITICS.has(suffix)) {
    if (stem === 'a' || stem === 'va' || stem === 'ce' || frIndex.isKnownWord(stem)) {
      return true;
    }
  }
  return false;
}

function isEnglishPossessive(token: string, enIndex: LanguageIndex | null): boolean {
  if (!enIndex) return false;
  // 1. Plural possessives: students', hours', Holmes'
  if (token.endsWith("'") || token.endsWith('’')) {
    const stem = token.slice(0, -1);
    if (stem.length < 2) return false;
    const lowerStem = stem.toLowerCase();
    if (lowerStem.endsWith('s')) {
      if (enIndex.isKnownWord(lowerStem) || /^[A-Z][a-z]+s$/.test(stem)) {
        return true;
      }
    }
    // Colloquial clipping of -ing -> -in': goin', movin'
    if (lowerStem.endsWith('in')) {
      if (enIndex.isKnownWord(lowerStem + 'g')) {
        return true;
      }
    }
  }

  // 2. Singular possessives: else's, Kato's, Chama's, Emmet's, doctor's
  if (token.endsWith("'s") || token.endsWith('’s')) {
    const stem = token.slice(0, -2);
    if (stem.length >= 2) {
      const lowerStem = stem.toLowerCase();
      if (enIndex.isKnownWord(lowerStem) || /^[A-Z][a-z]+$/.test(stem)) {
        return true;
      }
    }
  }

  // 3. Contractions with 'd: What'd, How'd, Who'd
  if (token.endsWith("'d") || token.endsWith('’d')) {
    const stem = token.slice(0, -2);
    if (stem.length >= 2 && enIndex.isKnownWord(stem.toLowerCase())) {
      return true;
    }
  }

  // 4. Contractions with 're: Where're, They're, We're
  if (token.endsWith("'re") || token.endsWith('’re')) {
    const stem = token.slice(0, -3);
    if (stem.length >= 2 && enIndex.isKnownWord(stem.toLowerCase())) {
      return true;
    }
  }

  // 5. Leading apostrophe abbreviations: 'flu, 'cause, 'til
  if (token.startsWith("'") || token.startsWith('’')) {
    const stem = token.slice(1);
    if (stem.length >= 2 && enIndex.isKnownWord(stem.toLowerCase())) {
      return true;
    }
  }

  return false;
}

const ENGLISH_PREFIXES = new Set(['pre', 'anti', 'non', 'semi', 'multi', 'sub', 're', 'co', 'ex', 'post', 'electro', 'half', 'self']);

function isEnglishHyphenatedCompound(token: string, enIndex: LanguageIndex | null): boolean {
  if (!enIndex || !token.includes('-')) return false;
  const parts = token.split('-');
  if (parts.length >= 2) {
    if (parts.every(p => p.length >= 2 && (enIndex.isKnownWord(p.toLowerCase()) || ENGLISH_PREFIXES.has(p.toLowerCase())))) {
      return true;
    }
  }
  return false;
}

function isEnglishSuffixLessWord(token: string, enIndex: LanguageIndex | null): boolean {
  if (!enIndex) return false;
  const lower = token.toLowerCase();
  if (lower.endsWith('less') && lower.length >= 6) {
    const stem = lower.slice(0, -4);
    if (enIndex.isKnownWord(stem)) {
      return true;
    }
  }
  return false;
}

export function createEngine(data: EngineData, initialSettings?: Partial<EngineSettings>) {
  let settings: EngineSettings = { ...DEFAULT_ENGINE_SETTINGS, ...initialSettings };
  let enIndex: LanguageIndex | null = null;
  let frIndex: LanguageIndex | null = null;
  let contextModel: ContextModel | null = null;

  if (data.ngram) {
    try {
      contextModel = new ContextModel(data.ngram);
    } catch (e) {
      console.warn('[bilingual-autocorrect] Failed to parse ngram binary model:', e);
    }
  }

  if (data.en) {
    try {
      enIndex = new LanguageIndex(parseBinaryIndex(data.en));
    } catch (e) {
      console.warn('[bilingual-autocorrect] Failed to parse EN binary dictionary:', e);
    }
  }

  if (data.fr) {
    try {
      frIndex = new LanguageIndex(parseBinaryIndex(data.fr));
    } catch (e) {
      console.warn('[bilingual-autocorrect] Failed to parse FR binary dictionary:', e);
    }
  }

  let personalSet = new Set((settings.personalWords || []).map(w => w.toLowerCase()));
  let rejectedSet = new Set((settings.rejectedWords || []).map(w => w.toLowerCase()));

  let stickyLang: 'en' | 'fr' | undefined = undefined;
  let consecutiveFr = 0;
  let consecutiveEn = 0;

  function getLangSignals() {
    return {
      isKnownWordEn: (w: string) => (enIndex ? enIndex.isKnownWord(w) : false),
      isKnownWordFr: (w: string) => (frIndex ? frIndex.isKnownWord(w) : false),
      stickyLang,
    };
  }

  function updateStickyLanguage(pEn: number, pFr: number) {
    if (pFr >= 0.85) {
      consecutiveFr++;
      consecutiveEn = 0;
      if (consecutiveFr >= 2) stickyLang = 'fr';
    } else if (pEn >= 0.85) {
      consecutiveEn++;
      consecutiveFr = 0;
      if (consecutiveEn >= 2) stickyLang = 'en';
    }
  }

  function formatApostrophes(str: string): string {
    if (settings.typographicApostrophe) {
      return str.replace(/'/g, '’');
    }
    return str.replace(/’/g, "'");
  }

  interface ScoredCandidate {
    word: string;
    score: number;
    distance: number;
    frequency: number;
    lang: 'en' | 'fr';
  }

  function rankCandidates(
    token: string,
    core: string,
    ctx: AnalyzeContext,
    isForSuggest = false
  ): { ranked: ScoredCandidate[]; pEn: number; pFr: number; layout: 'qwerty' | 'azerty'; thresholds: ReturnType<typeof getThresholds> } {
    const isEnEnabled = settings.languageMode === 'auto' || settings.languageMode === 'en' || settings.languageMode === 'en+fr';
    const isFrEnabled = settings.languageMode === 'auto' || settings.languageMode === 'fr' || settings.languageMode === 'en+fr';
    const { pEn, pFr } = computeLanguagePosterior(token, ctx.leftContext, ctx.langHint, getLangSignals());
    const layout = ctx.layoutHint || (settings.layout === 'auto' ? (pFr >= 0.50 ? 'azerty' : 'qwerty') : settings.layout);
    const thresholds = { ...getThresholds(settings.sensitivity), ...(settings.thresholdOverrides || {}) };

    const scoredMap = new Map<string, ScoredCandidate>();

    // Query English index
    if (isEnEnabled && enIndex) {
      const enCandidates = enIndex.lookupCandidates(core);
      const hasApos = core.includes("'") || core.includes('’');
      const lowerCore = core.toLowerCase();

      // Check English contractions when core has an apostrophe or ends in common contraction suffix
      if (hasApos || lowerCore.endsWith('nt') || lowerCore.endsWith('re') || lowerCore.endsWith('ve') || lowerCore.endsWith('ll')) {
        for (const cont of STANDARD_ENGLISH_CONTRACTIONS) {
          const cDist = weightedDistance(lowerCore, cont, { layout });
          if (cDist <= 1.0) {
            enCandidates.push({ word: cont, frequency: 150 });
          }
        }
      }

      // Check English possessive candidate generation when core ends in 's or ’s
      if (lowerCore.endsWith("'s") || lowerCore.endsWith("’s")) {
        const stem = lowerCore.slice(0, -2);
        if (!enIndex.isKnownWord(stem)) {
          const stemCands = enIndex.lookupCandidates(stem);
          for (const sc of stemCands) {
            const sDist = weightedDistance(stem, sc.word, { layout });
            if (sDist <= 1.0 && enIndex.isKnownWord(sc.word)) {
              enCandidates.push({ word: `${sc.word}'s`, frequency: Math.max(sc.frequency, 40) });
            }
          }
        }
      }

      for (const cand of enCandidates) {
        if (pFr >= 0.70 && pEn < 0.25) continue;
        const isAposCand = cand.word.includes("'") || cand.word.includes('’');
        if (hasApos && !isAposCand && fold(core.toLowerCase()) !== fold(cand.word.toLowerCase())) {
          continue;
        }

        const dist = weightedDistance(core, cand.word, { layout });
        const maxAllowedDist = core.length <= 4
          ? thresholds.maxDistanceLen3to4
          : (core.length === 5 ? thresholds.maxDistanceLen5 : (isForSuggest ? Math.max(thresholds.maxDistanceLen6plus, 2.25) : thresholds.maxDistanceLen6plus));
        if (dist > maxAllowedDist) continue;

        const editCost = Math.pow(dist, 1.35) * 4.2;
        const firstMatch = cand.word[0]?.toLowerCase() === core[0]?.toLowerCase() ? 0.6 : 0;
        const lastMatch = cand.word.slice(-1).toLowerCase() === core.slice(-1).toLowerCase() ? 0.6 : 0;
        const suffix2Match = core.length >= 4 && cand.word.slice(-2) === core.slice(-2) ? 0.8 : 0;
        const boundaryBonus = firstMatch + lastMatch + suffix2Match;

        let lengthPenalty = 0;
        if (core.length >= 4 && cand.word.length < core.length) {
          lengthPenalty = (core.length - cand.word.length) * 1.5;
        }

        const freqScore = Math.pow(cand.frequency / 255, 0.6) * 6.5;
        const score = freqScore + Math.log(pEn + 1e-4) - editCost + boundaryBonus - lengthPenalty;
        const key = cand.word.toLowerCase();
        const existing = scoredMap.get(key);
        if (!existing || score > existing.score) {
          scoredMap.set(key, {
            word: cand.word,
            score,
            distance: dist,
            frequency: cand.frequency,
            lang: 'en',
          });
        }
      }
    }

    // Query French index
    if (isFrEnabled && frIndex) {
      const frCandidates = frIndex.lookupCandidates(core);
      for (const cand of frCandidates) {
        const isFoldedAccentMatch = fold(cand.word.toLowerCase()) === fold(core.toLowerCase());

        if (pEn >= 0.70 && pFr < 0.25 && !isFoldedAccentMatch) continue;
        if (pFr < 0.25 && !isFoldedAccentMatch && /[éèêëàâùûüçœæ]/i.test(cand.word)) continue;

        const dist = weightedDistance(core, cand.word, { layout });
        const maxAllowedDist = core.length <= 4
          ? thresholds.maxDistanceLen3to4
          : (core.length === 5 ? thresholds.maxDistanceLen5 : (isForSuggest ? Math.max(thresholds.maxDistanceLen6plus, 2.25) : thresholds.maxDistanceLen6plus));
        if (dist > maxAllowedDist) continue;

        const editCost = Math.pow(dist, 1.35) * 4.2;
        const firstMatch = cand.word[0]?.toLowerCase() === core[0]?.toLowerCase() ? 0.6 : 0;
        const lastMatch = cand.word.slice(-1).toLowerCase() === core.slice(-1).toLowerCase() ? 0.6 : 0;
        const suffix2Match = core.length >= 4 && cand.word.slice(-2) === core.slice(-2) ? 0.8 : 0;
        const boundaryBonus = firstMatch + lastMatch + suffix2Match;

        let lengthPenalty = 0;
        if (core.length >= 4 && cand.word.length < core.length) {
          lengthPenalty = (core.length - cand.word.length) * 1.5;
        }

        const freqScore = Math.pow(cand.frequency / 255, 0.6) * 6.5;
        const score = freqScore + Math.log(pFr + 1e-4) - editCost + boundaryBonus - lengthPenalty;
        const key = cand.word.toLowerCase();
        const existing = scoredMap.get(key);
        if (!existing || score > existing.score) {
          scoredMap.set(key, {
            word: cand.word,
            score,
            distance: dist,
            frequency: cand.frequency,
            lang: 'fr',
          });
        }
      }

      // Check French elision candidate generation when token has no apostrophe
      const potentialElisions = (!token.includes("'") && !token.includes('’')) ? getPotentialElisions(token) : [];
      const hasFrenchElisionCandidate = potentialElisions.some(pe => {
        const foldedRem = fold(pe.remainder.toLowerCase());
        if (frIndex.isKnownWord(pe.remainder)) return true;
        const cands = frIndex.lookupCandidates(pe.remainder);
        return cands.some(c => frIndex.isKnownWord(c.word) && fold(c.word.toLowerCase()) === foldedRem);
      });
      if (
        potentialElisions.length > 0 &&
        (pFr >= 0.25 || ctx.langHint === 'fr' || hasFrenchElisionCandidate)
      ) {
        for (const { prefix: elPrefix, remainder } of potentialElisions) {
          const lowerRem = remainder.toLowerCase();
          if (remainder.length < 3 && !['un', 'il', 'on', 'en', 'or', 'eu'].includes(lowerRem)) continue;
          const remCandidates = frIndex.lookupCandidates(remainder);
          const allRem = [...remCandidates];
          if (frIndex.isKnownWord(remainder) && !allRem.some(c => c.word.toLowerCase() === remainder.toLowerCase())) {
            allRem.push({ word: remainder, frequency: 80 });
          }

          for (const cand of allRem) {
            if (!frIndex.isKnownWord(cand.word)) continue;
            if (fold(cand.word.toLowerCase()) !== fold(remainder.toLowerCase())) continue;

            const remDist = weightedDistance(remainder, cand.word, { layout });
            if (remDist > 0.5) continue;

            const totalDist = remDist + 0.3;
            if (totalDist > thresholds.maxDistanceLen6plus) continue;

            const elisionWord = `${elPrefix}'${cand.word}`;
            const editCost = Math.pow(totalDist, 1.35) * 4.2;
            const freqScore = Math.pow(cand.frequency / 255, 0.6) * 6.5;
            const score = freqScore + Math.log(pFr + 1e-4) - editCost;

            const key = elisionWord.toLowerCase();
            const existing = scoredMap.get(key);
            if (!existing || score > existing.score) {
              scoredMap.set(key, {
                word: elisionWord,
                score,
                distance: totalDist,
                frequency: cand.frequency,
                lang: 'fr',
              });
            }
          }
        }
      }
    }

    // Apply contextual scoring boost if contextModel and leftContext are available
    if (contextModel && ctx.leftContext && ctx.leftContext.length > 0) {
      const prevWord = ctx.leftContext[ctx.leftContext.length - 1]!;
      for (const cand of scoredMap.values()) {
        const boost = contextModel.getBigramBoost(prevWord, cand.word, cand.lang);
        if (boost > 0) {
          cand.score += boost;
        }
      }
    }

    const ranked = Array.from(scoredMap.values()).sort((a, b) => b.score - a.score);

    const isEnglishContext = (ctx.langHint && ctx.langHint.toLowerCase().startsWith('en')) || pEn >= 0.70;
    if (isEnglishContext && ranked.length > 0 && ranked[0]!.lang === 'fr' && fold(ranked[0]!.word.toLowerCase()) === fold(core.toLowerCase())) {
      const enCognate = ranked.find(c =>
        c.lang === 'en' &&
        c.distance <= 1.2 &&
        fold(c.word.toLowerCase()).slice(0, 5) === fold(core.toLowerCase()).slice(0, 5)
      );
      if (enCognate) {
        const idx = ranked.indexOf(enCognate);
        if (idx > 0) {
          ranked.splice(idx, 1);
          ranked.unshift(enCognate);
        }
      }
    }

    const isFrenchContext = (ctx.langHint && ctx.langHint.toLowerCase().startsWith('fr')) || pFr >= 0.70;
    if (isFrenchContext && ranked.length > 0 && ranked[0]!.lang === 'en') {
      const frCognate = ranked.find(c =>
        c.lang === 'fr' &&
        c.distance <= 1.2 &&
        fold(c.word.toLowerCase()).slice(0, 5) === fold(core.toLowerCase()).slice(0, 5)
      );
      if (frCognate) {
        const idx = ranked.indexOf(frCognate);
        if (idx > 0) {
          ranked.splice(idx, 1);
          ranked.unshift(frCognate);
        }
      }
    }

    return { ranked, pEn, pFr, layout, thresholds };
  }

  function applySentenceCaps(str: string, ctx: AnalyzeContext, originalWord: string): string {
    if (!settings.sentenceCaps) return str;
    if (!isSentenceInitial(ctx.leftContext, ctx.boundary, ctx.isSentenceInitial)) return str;

    // Guard against URLs, handles, camelCase, all-caps acronyms, or custom lowercase words
    if (
      originalWord.startsWith('@') ||
      originalWord.startsWith('#') ||
      originalWord.includes('://') ||
      /[A-Z].*[a-z]|[a-z].*[A-Z]/.test(originalWord) && originalWord[0] === originalWord[0]?.toLowerCase() ||
      originalWord === originalWord.toUpperCase() && originalWord.length > 1
    ) {
      return str;
    }

    if (personalSet.has(originalWord.toLowerCase()) && settings.personalWords?.includes(originalWord.toLowerCase())) {
      return str;
    }

    if (str.length === 0) return str;
    return str[0]!.toUpperCase() + str.slice(1);
  }

  function analyze(ctx: AnalyzeContext): EngineDecision {
    const rawToken = ctx.token;
    if (!rawToken || rawToken.trim().length === 0) {
      return {
        action: 'none',
        replacement: rawToken,
        original: rawToken,
        confidence: 0,
        alternatives: [],
        reason: 'Empty token',
      };
    }

    const token = normalize(rawToken);

    // 1. Check French elision decomposition
    const { prefix, core } = splitElision(token);
    const lowerCore = core.toLowerCase();
    const lowerToken = token.toLowerCase();

    // Check shortcuts first
    if (settings.shortcuts && settings.shortcuts.length > 0) {
      const match = settings.shortcuts.find(s => s.trigger.toLowerCase() === lowerCore || s.trigger.toLowerCase() === lowerToken);
      if (match) {
        const isCoreMatch = match.trigger.toLowerCase() === lowerCore;
        const matchedOrig = isCoreMatch ? core : token;
        const cased = matchCase(matchedOrig, match.replacement);
        const finalReplacement = isCoreMatch && prefix ? prefix + cased : cased;
        const formatted = formatApostrophes(finalReplacement);
        const capped = applySentenceCaps(formatted, ctx, token);
        return {
          action: 'replace',
          replacement: capped,
          original: token,
          confidence: 1.0,
          alternatives: [],
          reason: 'Text shortcut expansion',
        };
      }
    }

    // Check personal dictionary & rejection list
    if (personalSet.has(lowerToken) || personalSet.has(lowerCore)) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: [],
        reason: 'Personal dictionary match',
      };
    }
    if (rejectedSet.has(lowerToken) || rejectedSet.has(lowerCore)) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: [],
        reason: 'Previously rejected token',
      };
    }

    // 2. Check Curated High-Precision Rules
    const isEnEnabled = settings.languageMode === 'auto' || settings.languageMode === 'en' || settings.languageMode === 'en+fr';
    const isFrEnabled = settings.languageMode === 'auto' || settings.languageMode === 'fr' || settings.languageMode === 'en+fr';
    let { pEn, pFr } = computeLanguagePosterior(core, ctx.leftContext, ctx.langHint, getLangSignals());

    if (isEnEnabled) {
      const hasFrenchLeftContext = Boolean(ctx.leftContext && ctx.leftContext.length > 0 &&
        (pFr > 0.55 || ctx.leftContext.some(w => /[éèêëàâùûüçœæ]/i.test(w))));
      const isFrenchDont =
        core.toLowerCase() === 'dont' &&
        isFrEnabled &&
        (ctx.langHint === 'fr' || hasFrenchLeftContext);

      const isWordInFr = isFrEnabled && frIndex && frIndex.isKnownWord(core.toLowerCase());
      const hasFrContext = pFr > pEn && (ctx.leftContext && ctx.leftContext.length > 0);
      const enAllowed = !hasFrContext || ctx.langHint === 'en';
      const crossLingualAllowed = !isWordInFr || pEn >= 0.65 || ctx.langHint === 'en' || !ctx.leftContext?.length;

      if (!prefix && enAllowed && crossLingualAllowed && !isFrenchDont) {
        const enRule = lookupRuleEn(core, settings.fixLoneI, ctx, pEn);
        if (enRule) {
          const replacement = prefix ? prefix + enRule : enRule;
          const formatted = formatApostrophes(replacement);
          const capped = applySentenceCaps(formatted, ctx, token);
          return {
            action: 'replace',
            replacement: capped,
            original: token,
            confidence: 1.0,
            alternatives: [],
            reason: 'Curated English rule',
          };
        }
      }
    }

    if (isFrEnabled) {
      const isWordInEn = isEnEnabled && enIndex && enIndex.isKnownWord(core.toLowerCase());
      const hasEnContext = pEn > pFr && (ctx.leftContext && ctx.leftContext.length > 0);
      const frAllowed = !hasEnContext || ctx.langHint === 'fr';
      const crossLingualAllowed = !isWordInEn || pFr >= 0.65 || ctx.langHint === 'fr' || !ctx.leftContext?.length;

      if (frAllowed && crossLingualAllowed) {
        const frFullRule = lookupRuleFr(token, ctx, pFr, pEn);
        if (frFullRule) {
          const formatted = formatApostrophes(frFullRule);
          const capped = applySentenceCaps(formatted, ctx, token);
          return {
            action: 'replace',
            replacement: capped,
            original: token,
            confidence: 1.0,
            alternatives: [],
            reason: 'Curated French compound rule',
          };
        }

        const frCoreRule = lookupRuleFr(core, ctx, pFr, pEn);
        if (frCoreRule) {
          const replacement = prefix ? prefix + frCoreRule : frCoreRule;
          const formatted = formatApostrophes(replacement);
          const capped = applySentenceCaps(formatted, ctx, token);
          return {
            action: 'replace',
            replacement: capped,
            original: token,
            confidence: 1.0,
            alternatives: [],
            reason: 'Curated French rule',
          };
        }
      }
    }

    // 3. Check No-Op Guardrails on the core token
    const noOpCheck = isNoOpToken(core, false, personalSet, rejectedSet);
    if (noOpCheck.noOp) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: [],
        reason: noOpCheck.reason || 'No-op token',
      };
    }

    // 3b. Check French inverted clitics and English possessives
    if (isFrEnabled && isFrenchHyphenatedClitic(core, frIndex)) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: [],
        reason: 'Known French inverted verb/clitic form',
      };
    }
    if (isEnEnabled && isEnglishPossessive(core, enIndex)) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: [],
        reason: 'English plural possessive form',
      };
    }
    if (isEnEnabled && isEnglishHyphenatedCompound(core, enIndex)) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: [],
        reason: 'English hyphenated compound word',
      };
    }
    if (isEnEnabled && isEnglishSuffixLessWord(core, enIndex)) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: [],
        reason: 'Valid English -less suffix word',
      };
    }
    if (lowerToken === "c'est-à-dire" || lowerCore === "c'est-à-dire") {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: [],
        reason: 'Known French fixed expression',
      };
    }

    // 5. Known Word Check
    const isKnownFr = isFrEnabled && frIndex && frIndex.isKnownWord(core);
    const isKnownEn = isEnEnabled && enIndex && enIndex.isKnownWord(core);
    const hasFrenchDiacritic = /[éèêëàâùûüçœæîï]/i.test(core);

    const { pEn: pEnCheck, pFr: pFrCheck } = computeLanguagePosterior(token, ctx.leftContext, ctx.langHint, getLangSignals());

    if (isKnownFr) {
      const hasEnContext = ctx.langHint === 'en' || (Boolean(ctx.leftContext && ctx.leftContext.length > 0) && pEnCheck >= 0.75);
      const isEnglishTypoCandidate = hasEnContext && !isKnownEn && !hasFrenchDiacritic;
      if (!isEnglishTypoCandidate) {
        const finalPFr = !isKnownEn ? 0.90 : pFrCheck;
        const finalPEn = !isKnownEn ? 0.10 : pEnCheck;
        updateStickyLanguage(finalPEn, finalPFr);
        if (settings.sentenceCaps && isSentenceInitial(ctx.leftContext, ctx.boundary, ctx.isSentenceInitial) && token[0] === token[0]?.toLowerCase()) {
          const capped = applySentenceCaps(token, ctx, token);
          if (capped !== token) {
            return {
              action: 'replace',
              replacement: formatApostrophes(capped),
              original: token,
              confidence: 1.0,
              alternatives: [],
              reason: 'Sentence initial capitalization',
            };
          }
        }
        return {
          action: 'none',
          replacement: token,
          original: token,
          confidence: 0,
          alternatives: [],
          reason: 'Known valid French word',
        };
      }
    }

    const isEnFunctionWord = COMMON_EN_FUNCTION_WORDS.has(core.toLowerCase());
    const minFrAccentCheck = isKnownEn ? 0.85 : 0.4;
    const hasFrenchAccentRestore =
      isFrEnabled &&
      frIndex &&
      !isEnFunctionWord &&
      (ctx.langHint === 'fr' || pFrCheck >= minFrAccentCheck) &&
      frIndex.lookupCandidates(core).some(
        c => fold(c.word.toLowerCase()) === fold(core.toLowerCase()) && c.word.toLowerCase() !== core.toLowerCase()
      );

    const allowElisionCheck = !isKnownEn || ctx.langHint === 'fr';
    const hasFrenchElisionCandidate =
      isFrEnabled &&
      frIndex &&
      allowElisionCheck &&
      !token.includes("'") &&
      !token.includes('’') &&
      getPotentialElisions(core).some(pe => {
        const foldedRem = fold(pe.remainder.toLowerCase());
        if (frIndex.isKnownWord(pe.remainder)) return true;
        const cands = frIndex.lookupCandidates(pe.remainder);
        return cands.some(c => frIndex.isKnownWord(c.word) && fold(c.word.toLowerCase()) === foldedRem);
      });

    if (isKnownEn && !hasFrenchAccentRestore && !hasFrenchElisionCandidate) {
      const hasFrContext = ctx.langHint === 'fr';
      const isFrenchTypoCandidate = hasFrContext && !isKnownFr;
      if (!isFrenchTypoCandidate) {
        const finalPEn = !isKnownFr ? 0.90 : pEnCheck;
        const finalPFr = !isKnownFr ? 0.10 : pFrCheck;
        updateStickyLanguage(finalPEn, finalPFr);
        if (settings.sentenceCaps && isSentenceInitial(ctx.leftContext, ctx.boundary, ctx.isSentenceInitial) && token[0] === token[0]?.toLowerCase()) {
          const capped = applySentenceCaps(token, ctx, token);
          if (capped !== token) {
            return {
              action: 'replace',
              replacement: formatApostrophes(capped),
              original: token,
              confidence: 1.0,
              alternatives: [],
              reason: 'Sentence initial capitalization',
            };
          }
        }
        return {
          action: 'none',
          replacement: token,
          original: token,
          confidence: 0,
          alternatives: [],
          reason: 'Known valid English word',
        };
      }
    }

    const rankedResult = rankCandidates(token, core, ctx, false);
    const ranked = rankedResult.ranked;
    const thresholds = rankedResult.thresholds;
    pEn = rankedResult.pEn;
    pFr = rankedResult.pFr;

    if (ranked.length === 0) {
      if (settings.sentenceCaps && isSentenceInitial(ctx.leftContext, ctx.boundary) && token[0] === token[0]?.toLowerCase()) {
        const capped = applySentenceCaps(token, ctx, token);
        if (capped !== token) {
          return {
            action: 'replace',
            replacement: formatApostrophes(capped),
            original: token,
            confidence: 1.0,
            alternatives: [],
            reason: 'Sentence initial capitalization',
          };
        }
      }
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: [],
        reason: 'No candidate within distance threshold',
      };
    }

    const top = ranked[0]!;
    const runnerUp = ranked[1];

    const minFreq = (core.length >= 7 && top.distance <= 1.0) ? 10 : thresholds.minFrequency;
    if (top.frequency < minFreq && fold(core.toLowerCase()) !== fold(top.word.toLowerCase())) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: ranked.slice(0, 3).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
        reason: 'Top candidate frequency below threshold',
      };
    }

    if (runnerUp) {
      const margin = top.score - runnerUp.score;
      const baseMargin = thresholds.tauMargin * 0.65;
      const suffixTieBreaker =
        core.length >= 4 &&
        top.word.slice(-2) === core.slice(-2) &&
        runnerUp.word.slice(-2) !== core.slice(-2);
      const boundaryTieBreaker =
        core.length >= 4 &&
        top.word[0]?.toLowerCase() === core[0]?.toLowerCase() &&
        top.word.slice(-1).toLowerCase() === core.slice(-1).toLowerCase() &&
        (runnerUp.word[0]?.toLowerCase() !== core[0]?.toLowerCase() ||
         runnerUp.word.slice(-1).toLowerCase() !== core.slice(-1).toLowerCase());
      const effectiveMargin = (suffixTieBreaker || boundaryTieBreaker) ? baseMargin * 0.3 : baseMargin;

      if (margin < effectiveMargin && top.distance >= runnerUp.distance && fold(core.toLowerCase()) !== fold(top.word.toLowerCase())) {
        const isCrossLangWinner =
          top.lang !== runnerUp.lang &&
          ((top.lang === 'en' && pEn >= 0.70) || (top.lang === 'fr' && pFr >= 0.70));
        const isCrossLangCognate =
          top.lang !== runnerUp.lang &&
          fold(top.word.toLowerCase()).slice(0, 5) === fold(runnerUp.word.toLowerCase()).slice(0, 5);

        if (!isCrossLangWinner && !isCrossLangCognate) {
          return {
            action: 'none',
            replacement: token,
            original: token,
            confidence: 0,
            alternatives: ranked.slice(0, 3).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
            reason: 'Insufficient margin over runner-up',
          };
        }
      }

      // Safe two-tier behavior: guard against ambiguous cross-lingual candidates on context-free inputs
      const isContextFree = !ctx.langHint && (!ctx.leftContext || ctx.leftContext.length === 0) && pEn < 0.65 && pFr < 0.65;
      if (
        isContextFree &&
        top.lang !== runnerUp.lang &&
        fold(top.word.toLowerCase()).slice(0, 5) === fold(runnerUp.word.toLowerCase()).slice(0, 5) &&
        (top.distance > 0.5 || runnerUp.distance <= 1.2)
      ) {
        return {
          action: 'none',
          replacement: token,
          original: token,
          confidence: 0,
          alternatives: ranked.slice(0, 3).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
          reason: 'Ambiguous cross-lingual candidates without context (use suggestions)',
        };
      }
    }

    if (isKnownEn && top.lang === 'en' && top.word.toLowerCase() !== core.toLowerCase()) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: ranked.slice(0, 3).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
        reason: 'Known valid English word',
      };
    }

    if (
      isEnEnabled &&
      enIndex &&
      lowerCore.endsWith('ise') &&
      top.word.toLowerCase().endsWith('ize') &&
      lowerCore.slice(0, -3) === top.word.toLowerCase().slice(0, -3)
    ) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: ranked.slice(0, 3).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
        reason: 'Valid British English -ise spelling',
      };
    }

    if (
      isEnEnabled &&
      enIndex &&
      lowerCore.endsWith('our') &&
      top.word.toLowerCase().endsWith('or') &&
      lowerCore.slice(0, -3) === top.word.toLowerCase().slice(0, -2)
    ) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: ranked.slice(0, 3).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
        reason: 'Valid British English -our spelling',
      };
    }

    if (lowerCore.startsWith('un') && top.word.toLowerCase() === lowerCore.slice(2)) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: ranked.slice(0, 3).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
        reason: 'Protected un- prefix word',
      };
    }

    const isTitle = /^[A-Z][a-zà-öø-ÿ]+$/.test(core);
    if (isTitle && fold(core.toLowerCase()) !== fold(top.word.toLowerCase())) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: ranked.slice(0, 3).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
        reason: 'Capitalized token protected from auto-replacement',
      };
    }

    // Format replacement casing and re-attach elision prefix
    const casedCore = matchCase(core, top.word);
    const finalReplacement = prefix ? prefix + casedCore : casedCore;
    const formattedReplacement = formatApostrophes(finalReplacement);
    const cappedReplacement = applySentenceCaps(formattedReplacement, ctx, token);

    if (cappedReplacement.toLowerCase() === token.toLowerCase() && cappedReplacement === token) {
      return {
        action: 'none',
        replacement: token,
        original: token,
        confidence: 0,
        alternatives: ranked.slice(1, 4).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
        reason: 'Token already correctly matches top candidate',
      };
    }

    // Calibrated Platt Confidence Scaling fitted on dev split (Brier: 0.0912, ECE: 2.87%)
    const confidence = Math.min(1.0, Math.max(0.5, 1 / (1 + Math.exp(-(0.4721 * top.score + 0.3676)))));

    // Two-Tier Precision Calibration (WP 3): Withhold automatic replacement if runner-up margin is too narrow
    // or short tokens have ambiguous competitors, routing uncertain corrections to Tier 2 suggestions.
    const isDiacriticOrApostropheOnly =
      fold(core.toLowerCase()) === fold(top.word.toLowerCase()) ||
      (!isTitle &&
       !(enIndex?.isKnownWord(core.toLowerCase()) || frIndex?.isKnownWord(core.toLowerCase())) &&
       (top.word.includes("'") || top.word.includes("’")) &&
       fold(core.replace(/['’]/g, '').toLowerCase()) === fold(top.word.replace(/['’]/g, '').toLowerCase()));
    if (!isDiacriticOrApostropheOnly) {
      if (runnerUp) {
        const margin = top.score - runnerUp.score;
        const isCrossLangWinner =
          top.lang !== runnerUp.lang &&
          fold(top.word.toLowerCase()).slice(0, 5) === fold(runnerUp.word.toLowerCase()).slice(0, 5) &&
          ((top.lang === 'en' && pEn >= 0.70) || (top.lang === 'fr' && pFr >= 0.70));

        if (!isCrossLangWinner) {
          const minMargin = thresholds.minMargin ?? 1.3;
          const shortMargin = thresholds.shortMargin ?? 2.1;
          const isShortWordNarrow = core.length <= 4 && margin < shortMargin;
          const useConf = thresholds.useConfidenceGate !== undefined ? thresholds.useConfidenceGate !== 0 : true;
          const isLowConfMargin = useConf && margin < 2.5 && confidence < 0.52;
          const frMorphMargin = thresholds.frMorphMargin ?? 0;
          const isFrenchMorphCompetitor =
            frMorphMargin > 0 &&
            top.lang === 'fr' &&
            runnerUp.lang === 'fr' &&
            core.length >= 5 &&
            top.word.slice(0, 4).toLowerCase() === runnerUp.word.slice(0, 4).toLowerCase() &&
            margin < frMorphMargin;
          if (margin < minMargin || isShortWordNarrow || isLowConfMargin || isFrenchMorphCompetitor) {
            return {
              action: 'none',
              replacement: token,
              original: token,
              confidence,
              score: top.score,
              alternatives: ranked.slice(0, 3).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
              reason: 'Ambiguous candidate margin (use suggestions)',
            };
          }
        }
      } else {
        const useConf = thresholds.useConfidenceGate !== undefined ? thresholds.useConfidenceGate !== 0 : true;
        const isLowConfSingle = useConf && confidence < 0.52 && top.distance > 0.8;
        const minSingleScore = thresholds.minSingleScore ?? -2.0;
        if (!ctx.langHint && (top.score < minSingleScore || isLowConfSingle)) {
          return {
            action: 'none',
            replacement: token,
            original: token,
            confidence,
            score: top.score,
            alternatives: ranked.slice(0, 3).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
            reason: 'Single candidate score too low for auto-replacement without language context (use suggestions)',
          };
        }
      }
    }

    updateStickyLanguage(pEn, pFr);
    return {
      action: 'replace',
      replacement: cappedReplacement,
      original: token,
      confidence,
      score: top.score,
      alternatives: ranked.slice(1, 4).map(c => ({ word: c.word, score: c.score, distance: c.distance })),
      reason: 'Passed distance, frequency and confidence thresholds',
    };
  }

  function suggest(ctx: AnalyzeContext): string[] {
    const rawToken = ctx.token;
    if (!rawToken || rawToken.trim().length === 0) return [];

    const token = normalize(rawToken);

    const { prefix, core } = splitElision(token);
    const lowerCore = core.toLowerCase();
    const lowerToken = token.toLowerCase();

    // Check shortcuts
    if (settings.shortcuts && settings.shortcuts.length > 0) {
      const match = settings.shortcuts.find(s => s.trigger.toLowerCase() === lowerCore || s.trigger.toLowerCase() === lowerToken);
      if (match) {
        const isCoreMatch = match.trigger.toLowerCase() === lowerCore;
        const matchedOrig = isCoreMatch ? core : token;
        const cased = matchCase(matchedOrig, match.replacement);
        const finalReplacement = isCoreMatch && prefix ? prefix + cased : cased;
        const formatted = formatApostrophes(finalReplacement);
        const capped = applySentenceCaps(formatted, ctx, token);
        return [capped];
      }
    }

    // Check personal dictionary & rejection list
    if (personalSet.has(lowerToken) || personalSet.has(lowerCore)) return [];
    if (rejectedSet.has(lowerToken) || rejectedSet.has(lowerCore)) return [];

    // Check Curated High-Precision Rules
    const isEnEnabled = settings.languageMode === 'auto' || settings.languageMode === 'en' || settings.languageMode === 'en+fr';
    const isFrEnabled = settings.languageMode === 'auto' || settings.languageMode === 'fr' || settings.languageMode === 'en+fr';

    if (isEnEnabled) {
      const isFrenchDont =
        core.toLowerCase() === 'dont' &&
        isFrEnabled &&
        (ctx.langHint === 'fr' || (ctx.leftContext && ctx.leftContext.some(w => /[éèêëàâùûüçœæ]/i.test(w))));

      if (!isFrenchDont) {
        const enRule = lookupRuleEn(core, settings.fixLoneI);
        if (enRule) {
          const replacement = prefix ? prefix + enRule : enRule;
          const formatted = formatApostrophes(replacement);
          const capped = applySentenceCaps(formatted, ctx, token);
          return [capped];
        }
      }
    }

    if (isFrEnabled) {
      const frFullRule = lookupRuleFr(token);
      if (frFullRule) {
        const formatted = formatApostrophes(frFullRule);
        const capped = applySentenceCaps(formatted, ctx, token);
        return [capped];
      }
      const frCoreRule = lookupRuleFr(core);
      if (frCoreRule) {
        const replacement = prefix ? prefix + frCoreRule : frCoreRule;
        const formatted = formatApostrophes(replacement);
        const capped = applySentenceCaps(formatted, ctx, token);
        return [capped];
      }
    }

    // Check No-Op Guardrails on the core token
    const noOpCheck = isNoOpToken(core, false, personalSet, rejectedSet);
    if (noOpCheck.noOp) return [];

    if (isFrEnabled && isFrenchHyphenatedClitic(core, frIndex)) return [];
    if (isEnEnabled && isEnglishPossessive(core, enIndex)) return [];

    const isKnownFr = isFrEnabled && frIndex && frIndex.isKnownWord(core);
    const isKnownEn = isEnEnabled && enIndex && enIndex.isKnownWord(core);

    const { pFr } = computeLanguagePosterior(token, ctx.leftContext, ctx.langHint, getLangSignals());
    const isEnFunctionWord = COMMON_EN_FUNCTION_WORDS.has(core.toLowerCase());
    const minFrAccentCheck = isKnownEn ? 0.85 : 0.4;
    const hasFrenchAccentRestore =
      isFrEnabled &&
      frIndex &&
      !isEnFunctionWord &&
      (ctx.langHint === 'fr' || pFr >= minFrAccentCheck) &&
      frIndex.lookupCandidates(core).some(
        c => fold(c.word.toLowerCase()) === fold(core.toLowerCase()) && c.word.toLowerCase() !== core.toLowerCase()
      );

    const allowElisionCheck = !isKnownEn || ctx.langHint === 'fr';
    const hasFrenchElisionCandidate =
      isFrEnabled &&
      frIndex &&
      allowElisionCheck &&
      !token.includes("'") &&
      !token.includes('’') &&
      getPotentialElisions(core).some(pe => {
        const foldedRem = fold(pe.remainder.toLowerCase());
        if (frIndex.isKnownWord(pe.remainder)) return true;
        const cands = frIndex.lookupCandidates(pe.remainder);
        return cands.some(c => frIndex.isKnownWord(c.word) && fold(c.word.toLowerCase()) === foldedRem);
      });

    if (isKnownFr && !hasFrenchAccentRestore && !hasFrenchElisionCandidate) return [];
    if (isKnownEn && !hasFrenchAccentRestore && !hasFrenchElisionCandidate) return [];

    const { ranked } = rankCandidates(token, core, ctx, true);

    if (ranked.length === 0) return [];

    return ranked.slice(0, 3).map(c => {
      const cased = matchCase(core, c.word);
      const withPrefix = prefix ? prefix + cased : cased;
      const formatted = formatApostrophes(withPrefix);
      return applySentenceCaps(formatted, ctx, token);
    });
  }

  function updateSettings(newSettings: Partial<EngineSettings>) {
    settings = { ...settings, ...newSettings };
    if (newSettings.personalWords) {
      personalSet = new Set(newSettings.personalWords.map(w => w.toLowerCase()));
    }
    if (newSettings.rejectedWords) {
      rejectedSet = new Set(newSettings.rejectedWords.map(w => w.toLowerCase()));
    }
  }

  function getSettings(): Readonly<EngineSettings> {
    return settings;
  }

  function isKnownWord(word: string, lang?: 'en' | 'fr'): boolean {
    const lower = word.toLowerCase();
    if (settings.personalWords?.some(w => w.toLowerCase() === lower)) {
      return true;
    }
    if (lang === 'en') return enIndex?.isKnownWord(word) || false;
    if (lang === 'fr') return frIndex?.isKnownWord(word) || false;
    return (enIndex?.isKnownWord(word) || false) || (frIndex?.isKnownWord(word) || false);
  }

  return {
    analyze,
    suggest,
    updateSettings,
    getSettings,
    isKnownWord,
    getStickyLanguage: () => stickyLang,
    resetStickyLanguage: () => {
      stickyLang = undefined;
      consecutiveFr = 0;
      consecutiveEn = 0;
    },
    isReady: () => enIndex !== null || frIndex !== null,
  };
}
