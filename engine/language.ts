/**
 * Two-class short-fragment language detection and posterior weighting (EN vs FR)
 */

const FRENCH_EXCLUSIVE_CHARS = /[éèêëàâùûüçœæîï]/i;

export const COMMON_EN_FUNCTION_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
]);

const COMMON_FR_FUNCTION_WORDS = new Set([
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'est',
  'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'en', 'au', 'aux',
  'ce', 'cet', 'cette', 'ces', 'que', 'qui', 'dans', 'pour', 'pas', 'sur',
  'avec', 'par', 'plus', 'mais', 'son', 'sa', 'ses', 'tout', 'tous', 'fait',
]);

const FRENCH_ELISION_PREFIX = /^(l'|d'|j'|n'|m'|t'|s'|c'|qu'|jusqu'|lorsqu'|puisqu'|l’|d’|j’|n’|m’|t’|s’|c’|qu’|jusqu’|lorsqu’|puisqu’)/i;

export interface LanguageLookupSignals {
  isKnownWordEn?: (word: string) => boolean;
  isKnownWordFr?: (word: string) => boolean;
  stickyLang?: 'en' | 'fr';
}

export interface LanguagePrior {
  en: number; // log-prior
  fr: number; // log-prior
}

export function computeLanguagePosterior(
  token: string,
  leftContext: string[] = [],
  langHint?: string,
  signals?: LanguageLookupSignals
): { pEn: number; pFr: number } {
  // Base log-prior (balanced default)
  let logEn = 0.0;
  let logFr = 0.0;

  // 1. Language hint from element or document lang attribute
  if (langHint) {
    const hint = langHint.toLowerCase();
    if (hint.startsWith('fr')) {
      logFr += 2.0;
    } else if (hint.startsWith('en')) {
      logEn += 2.0;
    }
  }

  // 2. Sticky language context from recent typing (mild prior for ambiguous tokens)
  if (signals?.stickyLang === 'fr') {
    logFr += 0.6;
  } else if (signals?.stickyLang === 'en') {
    logEn += 0.6;
  }

  // 3. Strong feature: French-exclusive diacritics in token or context
  if (FRENCH_EXCLUSIVE_CHARS.test(token)) {
    logFr += 4.0;
  }
  // Strong feature: French elision prefix in token (e.g. l', d', j', c', qu')
  if (FRENCH_ELISION_PREFIX.test(token)) {
    logFr += 6.0;
  }

  // 4. Rolling log-likelihood over last <= 8 words
  const window = leftContext.slice(-8);
  for (const w of window) {
    const lower = w.toLowerCase();
    if (FRENCH_EXCLUSIVE_CHARS.test(lower)) {
      logFr += 2.5;
    }
    if (FRENCH_ELISION_PREFIX.test(lower)) {
      logFr += 2.5;
    }
    if (COMMON_EN_FUNCTION_WORDS.has(lower)) {
      logEn += 2.5;
    }
    if (COMMON_FR_FUNCTION_WORDS.has(lower)) {
      logFr += 2.5;
    }

    // Dictionary membership signal for context words
    if (signals?.isKnownWordEn && signals?.isKnownWordFr && lower.length >= 2) {
      const inEn = signals.isKnownWordEn(lower);
      const inFr = signals.isKnownWordFr(lower);
      if (inFr && !inEn) {
        logFr += 2.0;
      } else if (inEn && !inFr) {
        logEn += 2.0;
      }
    }
  }

  // Convert log odds to normalized posterior probabilities
  const maxLog = Math.max(logEn, logFr);
  const expEn = Math.exp(logEn - maxLog);
  const expFr = Math.exp(logFr - maxLog);
  const total = expEn + expFr;

  return {
    pEn: expEn / total,
    pFr: expFr / total,
  };
}
