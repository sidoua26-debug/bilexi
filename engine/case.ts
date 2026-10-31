/**
 * Case restoration and sentence capitalization
 */

export function matchCase(original: string, target: string): string {
  if (!original || !target) return target;

  // ALL UPPERCASE: e.g. TEH -> THE
  if (original === original.toUpperCase() && original.toLowerCase() !== original.toUpperCase()) {
    return target.toUpperCase();
  }

  // Capitalized: e.g. Teh -> The
  if (original[0] === original[0]!.toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return target[0]!.toUpperCase() + target.slice(1);
  }

  // Default: lowercase
  return target.toLowerCase();
}

export interface SentenceStartOptions {
  capitalizeFieldStart?: boolean;
}

const COMMON_ABBREVIATIONS = new Set([
  'e.g.', 'i.e.', 'etc.', 'mr.', 'ms.', 'mrs.', 'dr.', 'prof.',
  'vs.', 'al.', 'm.', 'mme.', 'mlle.', 'p. ex.', 'av.', 'bd.', 'cf.', 'env.', 'st.', 'no.'
]);

export function detectSentenceStart(
  precedingText: string,
  options?: SentenceStartOptions
): boolean {
  if (!precedingText || precedingText.trim().length === 0) {
    return options?.capitalizeFieldStart ?? false;
  }

  // Newline / paragraph starts are always sentence starts
  if (/\n\s*$/.test(precedingText)) {
    return true;
  }

  // Must end with sentence punctuation followed by whitespace
  if (!/[.!?][\s\u00A0\u202F]+$/.test(precedingText)) {
    return false;
  }

  // Ellipsis (... or …) does not terminate a sentence
  if (/\.\.\.[\s\u00A0\u202F]*$/.test(precedingText) || /…[\s\u00A0\u202F]*$/.test(precedingText)) {
    return false;
  }

  // Check abbreviation before the trailing punctuation
  const trimmed = precedingText.trimEnd();
  const lastTokenMatch = /([^\s\u00A0\u202F]+)$/.exec(trimmed);
  if (lastTokenMatch) {
    const lastToken = lastTokenMatch[1]!.toLowerCase();
    if (COMMON_ABBREVIATIONS.has(lastToken)) {
      return false;
    }
    // Check 2-word abbreviation like "p. ex."
    const twoTokenMatch = /([^\s\u00A0\u202F]+[\s\u00A0\u202F]+[^\s\u00A0\u202F]+)$/.exec(trimmed);
    if (twoTokenMatch && COMMON_ABBREVIATIONS.has(twoTokenMatch[1]!.toLowerCase().replace(/\s+/g, ' '))) {
      return false;
    }
  }

  return true;
}

export function isSentenceInitial(
  leftContext?: string[],
  boundaryBefore?: string,
  explicitSentenceInitial?: boolean,
  options?: SentenceStartOptions
): boolean {
  if (explicitSentenceInitial !== undefined) {
    if (leftContext && leftContext.length > 0) {
      const lastToken = leftContext[leftContext.length - 1]!.toLowerCase();
      if (COMMON_ABBREVIATIONS.has(lastToken)) {
        return false;
      }
    }
    return explicitSentenceInitial;
  }
  if (!leftContext || leftContext.length === 0) {
    return options?.capitalizeFieldStart ?? false;
  }

  const lastToken = leftContext[leftContext.length - 1]!;
  const lowerLast = lastToken.toLowerCase();

  // If previous token was an abbreviation, do NOT capitalize next
  if (COMMON_ABBREVIATIONS.has(lowerLast)) {
    return false;
  }

  // If previous boundary ended a sentence
  if (boundaryBefore && (boundaryBefore === '.' || boundaryBefore === '!' || boundaryBefore === '?')) {
    return true;
  }

  // If last token ended with sentence punctuation
  if (/[.!?]$/.test(lastToken)) {
    return true;
  }

  return false;
}
