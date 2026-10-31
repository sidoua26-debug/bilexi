/**
 * scripts/eval-error-categories.ts
 *
 * Implements WP C.a:
 * Detailed categorization of False Positives and False Negatives on Dev split
 * per language (EN and FR) with counts, percentages, and 5 concrete examples each.
 *
 * Output written to evidence/v0.5.0/error-categories.json
 */

import fs from 'node:fs';
import { createEngine } from '../engine/engine';
import { fold } from '../engine/normalize';
import { LanguageIndex, parseBinaryIndex } from '../engine/index';
import {
  loadCorpora,
  DEFAULT_SEED,
  createMulberry32,
  createTypoInjector,
  type TypoResult,
} from './lib/eval-harness';

interface Example {
  original: string;
  evaluated: string;
  replacement?: string;
  context: string[];
}

interface CategoryStats {
  count: number;
  percentage: number;
  examples: Example[];
}

async function main() {
  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const enIdx = new LanguageIndex(parseBinaryIndex(enBuf));
  const frIdx = new LanguageIndex(parseBinaryIndex(frBuf));

  const engine = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });
  const { dev } = loadCorpora('.');

  const rng = createMulberry32(DEFAULT_SEED);
  const injectTypo = createTypoInjector(rng);

  type FpCategory =
    | 'valid_word_flagged'
    | 'wrong_candidate_on_typo'
    | 'accent_only_wrong'
    | 'wrong_language'
    | 'proper_noun_or_foreign'
    | 'elision'
    | 'short_word_le_4';

  type FnCategory =
    | 'dictionary_hit'
    | 'below_threshold'
    | 'not_in_top_k'
    | 'real_word_collision';

  const makeFpBuckets = (): Record<FpCategory, { count: number; examples: Example[] }> => ({
    valid_word_flagged: { count: 0, examples: [] },
    wrong_candidate_on_typo: { count: 0, examples: [] },
    accent_only_wrong: { count: 0, examples: [] },
    wrong_language: { count: 0, examples: [] },
    proper_noun_or_foreign: { count: 0, examples: [] },
    elision: { count: 0, examples: [] },
    short_word_le_4: { count: 0, examples: [] },
  });

  const makeFnBuckets = (): Record<FnCategory, { count: number; examples: Example[] }> => ({
    dictionary_hit: { count: 0, examples: [] },
    below_threshold: { count: 0, examples: [] },
    not_in_top_k: { count: 0, examples: [] },
    real_word_collision: { count: 0, examples: [] },
  });

  const fpEn = makeFpBuckets();
  const fpFr = makeFpBuckets();
  const fnEn = makeFnBuckets();
  const fnFr = makeFnBuckets();

  function recordFp(
    buckets: Record<FpCategory, { count: number; examples: Example[] }>,
    cat: FpCategory,
    ex: Example
  ) {
    buckets[cat].count++;
    if (buckets[cat].examples.length < 5) {
      buckets[cat].examples.push(ex);
    }
  }

  function recordFn(
    buckets: Record<FnCategory, { count: number; examples: Example[] }>,
    cat: FnCategory,
    ex: Example
  ) {
    buckets[cat].count++;
    if (buckets[cat].examples.length < 5) {
      buckets[cat].examples.push(ex);
    }
  }

  // 1. Clean Pass (measures Clean False Positives)
  for (const item of dev) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];
    const isFr = item.lang === 'fr';
    const dict = isFr ? frIdx : enIdx;
    const otherDict = isFr ? enIdx : frIdx;
    const fpBuckets = isFr ? fpFr : fpEn;

    for (const raw of rawTokens) {
      if (raw.length < 2) continue;

      const dec = engine.analyze({
        token: raw,
        boundary: ' ',
        leftContext,
        langHint: undefined,
      });

      if (dec.action === 'replace' && dec.replacement.toLowerCase() !== raw.toLowerCase()) {
        const ex: Example = {
          original: raw,
          evaluated: raw,
          replacement: dec.replacement,
          context: [...leftContext],
        };

        const rawLow = raw.toLowerCase();
        const repLow = dec.replacement.toLowerCase();

        // Categorize Clean FP:
        if (fold(rawLow) === fold(repLow)) {
          recordFp(fpBuckets, 'accent_only_wrong', ex);
        } else if (/^[A-Z][a-z]+$/.test(raw) && !dict.isKnownWord(rawLow)) {
          recordFp(fpBuckets, 'proper_noun_or_foreign', ex);
        } else if (raw.includes("'") || raw.includes('’')) {
          recordFp(fpBuckets, 'elision', ex);
        } else if (otherDict.isKnownWord(repLow) && !dict.isKnownWord(repLow)) {
          recordFp(fpBuckets, 'wrong_language', ex);
        } else if (raw.length <= 4) {
          recordFp(fpBuckets, 'short_word_le_4', ex);
        } else {
          recordFp(fpBuckets, 'valid_word_flagged', ex);
        }
      }

      leftContext.push(raw);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  // 2. Noisy Pass (measures Wrong candidates on Typos & False Negatives)
  for (const item of dev) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];
    const isFr = item.lang === 'fr';
    const dict = isFr ? frIdx : enIdx;
    const otherDict = isFr ? enIdx : frIdx;
    const fpBuckets = isFr ? fpFr : fpEn;
    const fnBuckets = isFr ? fnFr : fnEn;

    for (const token of rawTokens) {
      if (token.length < 3) continue;

      const shouldInject = rng() < 0.083;
      if (!shouldInject) {
        leftContext.push(token);
        if (leftContext.length > 8) leftContext.shift();
        continue;
      }

      const typo = injectTypo(token, isFr);
      if (!typo || typo.distance !== 1) {
        leftContext.push(token);
        if (leftContext.length > 8) leftContext.shift();
        continue;
      }

      const evalToken = typo.noisy;
      const dec = engine.analyze({
        token: evalToken,
        boundary: ' ',
        leftContext,
        langHint: undefined,
      });

      const ex: Example = {
        original: token,
        evaluated: evalToken,
        replacement: dec.action === 'replace' ? dec.replacement : undefined,
        context: [...leftContext],
      };

      const noisyLow = evalToken.toLowerCase();
      const expectedLow = token.toLowerCase();

      if (dec.action === 'replace') {
        const repLow = dec.replacement.toLowerCase();
        if (repLow !== expectedLow) {
          // Wrong candidate on a typo
          if (fold(repLow) === fold(expectedLow)) {
            recordFp(fpBuckets, 'accent_only_wrong', ex);
          } else if (otherDict.isKnownWord(repLow) && !dict.isKnownWord(repLow)) {
            recordFp(fpBuckets, 'wrong_language', ex);
          } else if (evalToken.length <= 4) {
            recordFp(fpBuckets, 'short_word_le_4', ex);
          } else {
            recordFp(fpBuckets, 'wrong_candidate_on_typo', ex);
          }
        }
      } else {
        // False Negative (not replaced)
        const isRealWord = dict.isKnownWord(noisyLow) || otherDict.isKnownWord(noisyLow);
        if (isRealWord) {
          recordFn(fnBuckets, 'real_word_collision', ex);
        } else if (dict.isKnownWord(noisyLow)) {
          recordFn(fnBuckets, 'dictionary_hit', ex);
        } else {
          // Check if correct candidate was generated in top-k
          const suggestions = engine.suggest(evalToken, { token: evalToken, boundary: ' ', leftContext });
          const inTopK = suggestions.some(s => s.toLowerCase() === expectedLow);
          if (inTopK) {
            recordFn(fnBuckets, 'below_threshold', ex);
          } else {
            recordFn(fnBuckets, 'not_in_top_k', ex);
          }
        }
      }

      leftContext.push(evalToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  function formatOutput(
    fp: Record<FpCategory, { count: number; examples: Example[] }>,
    fn: Record<FnCategory, { count: number; examples: Example[] }>
  ) {
    const totalFp = Object.values(fp).reduce((a, b) => a + b.count, 0) || 1;
    const totalFn = Object.values(fn).reduce((a, b) => a + b.count, 0) || 1;

    const fpFormatted: Record<string, CategoryStats> = {};
    for (const [k, v] of Object.entries(fp)) {
      fpFormatted[k] = {
        count: v.count,
        percentage: parseFloat(((v.count / totalFp) * 100).toFixed(1)),
        examples: v.examples,
      };
    }

    const fnFormatted: Record<string, CategoryStats> = {};
    for (const [k, v] of Object.entries(fn)) {
      fnFormatted[k] = {
        count: v.count,
        percentage: parseFloat(((v.count / totalFn) * 100).toFixed(1)),
        examples: v.examples,
      };
    }

    return { fp: fpFormatted, fn: fnFormatted, totalFp, totalFn };
  }

  const enSummary = formatOutput(fpEn, fnEn);
  const frSummary = formatOutput(fpFr, fnFr);

  const report = {
    timestamp: new Date().toISOString(),
    en: enSummary,
    fr: frSummary,
  };

  const outPath = 'evidence/v0.5.0/error-categories.json';
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`Error analysis written to ${outPath}\n`);

  console.log('=== ENGLISH FALSE POSITIVES ===');
  console.table(Object.entries(enSummary.fp).map(([k, v]) => ({ Category: k, Count: v.count, '%': `${v.percentage}%` })));

  console.log('=== ENGLISH FALSE NEGATIVES ===');
  console.table(Object.entries(enSummary.fn).map(([k, v]) => ({ Category: k, Count: v.count, '%': `${v.percentage}%` })));

  console.log('\n=== FRENCH FALSE POSITIVES ===');
  console.table(Object.entries(frSummary.fp).map(([k, v]) => ({ Category: k, Count: v.count, '%': `${v.percentage}%` })));

  console.log('=== FRENCH FALSE NEGATIVES ===');
  console.table(Object.entries(frSummary.fn).map(([k, v]) => ({ Category: k, Count: v.count, '%': `${v.percentage}%` })));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
