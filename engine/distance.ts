/**
 * Weighted Damerau-Levenshtein distance with keyboard adjacency and accent scoring
 */

import { isAdjacentKey } from './keyboard';
import { fold } from './normalize';

export interface DistanceOptions {
  layout?: 'qwerty' | 'azerty';
}

// Reusable 1D scratchpad buffer for Damerau-Levenshtein dynamic programming
const MAX_SCRATCHPAD_DIM = 64;
const scratchpad = new Float64Array((MAX_SCRATCHPAD_DIM + 2) * (MAX_SCRATCHPAD_DIM + 2));

export function weightedDistance(
  s1: string,
  s2: string,
  options: DistanceOptions = {}
): number {
  const layout = options.layout || 'qwerty';

  // Fast check: exact match
  if (s1 === s2) return 0;

  const s1Low = s1.toLowerCase();
  const s2Low = s2.toLowerCase();
  const s1Folded = fold(s1Low);
  const s2Folded = fold(s2Low);

  // Accent-only restoration: e.g. ecole -> école or oeuvre -> œuvre
  if (s1Folded === s2Folded) {
    return 0.2;
  }

  // Morphological suffix variation: -ent <-> -ement on matching stems (e.g. developpent <-> développement)
  if (
    s1Low.endsWith('ent') && s2Low.endsWith('ement') &&
    fold(s1Low.slice(0, -3)) === fold(s2Low.slice(0, -5))
  ) {
    return weightedDistance(s1Low.slice(0, -3), s2Low.slice(0, -5), options) + 0.6;
  }
  if (
    s1Low.endsWith('ement') && s2Low.endsWith('ent') &&
    fold(s1Low.slice(0, -5)) === fold(s2Low.slice(0, -3))
  ) {
    return weightedDistance(s1Low.slice(0, -5), s2Low.slice(0, -3), options) + 0.6;
  }

  const n = s1Low.length;
  const m = s2Low.length;

  if (n === 0) return m * 1.0;
  if (m === 0) return n * 1.0;

  const rowStride = m + 2;
  // If word length exceeds scratchpad dimension, fallback to dynamic array
  const dp: Float64Array | number[] = (n + 2) * rowStride <= scratchpad.length
    ? scratchpad
    : new Float64Array((n + 2) * rowStride);

  const INF = 9999;
  dp[0] = INF;
  for (let i = 0; i <= n; i++) {
    dp[(i + 1) * rowStride + 1] = i * 1.0;
    dp[(i + 1) * rowStride + 0] = INF;
  }
  for (let j = 0; j <= m; j++) {
    dp[1 * rowStride + (j + 1)] = j * 1.0;
    dp[0 * rowStride + (j + 1)] = INF;
  }

  for (let i = 1; i <= n; i++) {
    const ch1 = s1Low[i - 1]!;
    const f1 = s1Folded[i - 1]!;

    for (let j = 1; j <= m; j++) {
      const ch2 = s2Low[j - 1]!;
      const f2 = s2Folded[j - 1]!;

      let cost = 0;
      if (ch1 === ch2) {
        cost = 0;
      } else if (f1 === f2) {
        cost = 0.2; // French accent-swap penalty
      } else if (
        ((ch1 === 'a' && ch2 === 'e') || (ch1 === 'e' && ch2 === 'a')) &&
        ((i < n && s1Low[i] === 'm') || (j < m && s2Low[j] === 'm'))
      ) {
        cost = 0.35; // French homophone vowel substitution before nasal mm (e.g. differament <-> différemment)
      } else if (isAdjacentKey(ch1, ch2, layout)) {
        cost = 0.5; // Adjacent keyboard key substitution
      } else {
        cost = 1.2; // Generic substitution
      }

      // First letter mismatch penalty (skip if accent-only match)
      if (i === 1 && j === 1 && f1 !== f2) {
        cost += 1.0;
      }

      // Doubled/undoubled letter cost (0.6 instead of 1.0)
      const isDelDouble = i > 1 && s1Low[i - 2] === ch1;
      const isInsDouble = j > 1 && s2Low[j - 2] === ch2;

      // Digraph variation: ou <-> o (e.g. fourty <-> forty, colour <-> color)
      const isOuVar =
        (ch1 === 'u' && i > 1 && s1Low[i - 2] === 'o') ||
        (ch2 === 'u' && j > 1 && s2Low[j - 2] === 'o');

      // Liquid consonant reduction in stop-liquid clusters (e.g. tr <-> t in apparaite <-> apparaître)
      const isLiquidCluster =
        ((ch1 === 'r' || ch1 === 'l') && i > 1 && /[tpbcdgf]/i.test(s1Low[i - 2]!)) ||
        ((ch2 === 'r' || ch2 === 'l') && j > 1 && /[tpbcdgf]/i.test(s2Low[j - 2]!));

      const delCost = isDelDouble ? 0.6 : (isOuVar ? 0.5 : (isLiquidCluster ? 0.6 : 1.0));
      const insCost = isInsDouble ? 0.6 : (isOuVar ? 0.5 : (isLiquidCluster ? 0.6 : 1.0));

      // Minimum of: deletion, insertion, substitution
      const del = dp[i * rowStride + (j + 1)]! + delCost;
      const ins = dp[(i + 1) * rowStride + j]! + insCost;
      const sub = dp[i * rowStride + j]! + cost;

      let min = Math.min(del, ins, sub);

      // Transposition check (Damerau)
      if (i > 1 && j > 1 && ch1 === s2Low[j - 2] && s1Low[i - 2] === ch2) {
        const trans = dp[(i - 1) * rowStride + (j - 1)]! + 0.6;
        if (trans < min) min = trans;
      }

      dp[(i + 1) * rowStride + (j + 1)] = min;
    }
  }

  return dp[(n + 1) * rowStride + (m + 1)]!;
}
