/**
 * Tokenization and French elision prefix extraction
 */

const FRENCH_ELISION_REGEX = /^(l'|d'|j'|n'|m'|t'|s'|c'|qu'|jusqu'|lorsqu'|puisqu'|l’|d’|j’|n’|m’|t’|s’|c’|qu’|jusqu’|lorsqu’|puisqu’)(.+)$/i;

export interface TokenDecomposition {
  raw: string;
  prefix: string;
  core: string;
  hasElision: boolean;
}

export function splitElision(token: string): TokenDecomposition {
  const match = FRENCH_ELISION_REGEX.exec(token);
  if (match && match[1] && match[2]) {
    return {
      raw: token,
      prefix: match[1],
      core: match[2],
      hasElision: true,
    };
  }

  return {
    raw: token,
    prefix: '',
    core: token,
    hasElision: false,
  };
}

// Prefixes eligible for elision when typed without an apostrophe:
// jusqu, lorsqu, puisqu, qu, j, l, d, n, m, t, s, c
const POTENTIAL_ELISION_PREFIXES = [
  'jusqu',
  'lorsqu',
  'puisqu',
  'qu',
  'j',
  'l',
  'd',
  'n',
  'm',
  't',
  's',
  'c',
];

export interface PotentialElision {
  prefix: string;
  remainder: string;
}

export const VOWEL_OR_H_REGEX = /^[aeiouyàâäéèêëîïôöùûüœæh]/i;

export function getPotentialElisions(token: string): PotentialElision[] {
  const lower = token.toLowerCase();
  const results: PotentialElision[] = [];

  const isCapitalized = token.length > 0 && token[0] === token[0]!.toUpperCase();
  for (const p of POTENTIAL_ELISION_PREFIXES) {
    if (isCapitalized && ['m', 't', 's', 'n'].includes(p)) continue;
    if (lower.startsWith(p) && lower.length >= p.length + 1) {
      const remainder = token.slice(p.length);
      // Remainder must start with a vowel or 'h'
      if (VOWEL_OR_H_REGEX.test(remainder)) {
        results.push({
          prefix: token.slice(0, p.length),
          remainder,
        });
      }
    }
  }

  return results;
}

export const BOUNDARY_REGEX = /[\s\u00A0\u202F.,;:!?()[\]{}»…]/;

export const WORD_TOKEN_REGEX = /^[\p{L}'’\u2019-]+$/u;

export function isWordToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  return WORD_TOKEN_REGEX.test(token);
}

export function isBoundaryChar(char: string): boolean {
  if (!char || char.length !== 1) return false;
  return char === ' ' || char === '\u00A0' || char === '\u202F' || '. , ; : ! ? ) ] } » …'.includes(char);
}
