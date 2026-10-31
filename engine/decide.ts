/**
 * Autocorrect Decision Engine and Safety Guardrails
 */

import { SensitivityMode } from './types';

export const COMMON_ALLOWLIST = new Set<string>();

export interface SensitivityThresholds {
  maxDistanceLen3to4: number;
  maxDistanceLen5: number;
  maxDistanceLen6plus: number;
  maxDistanceLen5plus: number;
  tauMargin: number;
  minFrequency: number;
  minMargin?: number;
  shortMargin?: number;
  useConfidenceGate?: number;
  minSingleScore?: number;
  frMorphMargin?: number;
}

export function getThresholds(mode: SensitivityMode): SensitivityThresholds {
  switch (mode) {
    case 'cautious':
      return {
        maxDistanceLen3to4: 1.0,
        maxDistanceLen5: 1.2,
        maxDistanceLen6plus: 1.8,
        maxDistanceLen5plus: 1.5,
        tauMargin: 1.8,
        minFrequency: 40,
      };
    case 'bold':
      return {
        maxDistanceLen3to4: 1.0,
        maxDistanceLen5: 2.0,
        maxDistanceLen6plus: 2.4,
        maxDistanceLen5plus: 2.2,
        tauMargin: 0.5,
        minFrequency: 5,
      };
    case 'balanced':
    default:
      return {
        maxDistanceLen3to4: 1.0,
        maxDistanceLen5: 1.8,
        maxDistanceLen6plus: 2.25,
        maxDistanceLen5plus: 2.0,
        tauMargin: 0.9,
        minFrequency: 15,
      };
  }
}

/**
 * Check if token matches any no-op safety conditions
 */
export function isNoOpToken(
  token: string,
  isCuratedRule: boolean,
  personalWords: Set<string> = new Set(),
  rejectedWords: Set<string> = new Set()
): { noOp: boolean; reason?: string } {
  const lower = token.toLowerCase();

  // If matched by curated rules (e.g. "i" -> "I", "dont" -> "don't"), do NOT no-op
  if (isCuratedRule) {
    return { noOp: false };
  }

  // 1. Length under 3
  if (token.length < 3) {
    return { noOp: true, reason: 'Length under 3' };
  }

  // Trailing or affixed punctuation (e.g. people:, world:, lying-)
  if (token.endsWith(':') || token.endsWith('-') || token.startsWith('-')) {
    return { noOp: true, reason: 'Punctuation affixed to token' };
  }

  // 2. URLs, emails, tags, handles
  if (
    token.includes('://') ||
    token.includes('@') ||
    token.includes('#') ||
    token.includes('_') ||
    token.includes('/')
  ) {
    return { noOp: true, reason: 'URL, email, handle or symbol token' };
  }

  // 3. Contains digits (including ordinals like 1er, 1st, 2nd)
  if (/\d/.test(token)) {
    return { noOp: true, reason: 'Contains digits or ordinal' };
  }

  // 4. Internal capitals / camelCase (e.g. iPhone, GitHub, LaTeX)
  if (/[a-z][A-Z]/.test(token)) {
    return { noOp: true, reason: 'Internal capital (camelCase)' };
  }

  // 5. ALL CAPS up to 5 letters (e.g. NASA, SNCF, USA)
  if (token.length <= 5 && token === token.toUpperCase() && token.toLowerCase() !== token.toUpperCase()) {
    return { noOp: true, reason: 'ALL CAPS acronym <= 5 letters' };
  }

  // 5b. Plural acronyms (e.g. PTAs, CPUs, APIs, URLs)
  if (/^[A-Z]{2,5}s$/.test(token)) {
    return { noOp: true, reason: 'Plural acronym' };
  }

  // 5c. Consonant-only abbreviations/initialisms (e.g. npm, slt, stp, mdr, html, css, bldg)
  if (token.length >= 3 && !/[aeiouyàâäéèêëîïôöùûüœæ]/i.test(token)) {
    return { noOp: true, reason: 'Consonant-only abbreviation/initialism' };
  }

  // 6. User personal dictionary or rejection list
  if (personalWords.has(lower) || personalWords.has(token)) {
    return { noOp: true, reason: 'Personal dictionary match' };
  }
  if (rejectedWords.has(lower) || rejectedWords.has(token)) {
    return { noOp: true, reason: 'Previously rejected token' };
  }

  return { noOp: false };
}
