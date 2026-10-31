/**
 * scripts/eval-tiered-actions.ts
 *
 * Implements WP 1 & WP 2:
 * Measures precision of the auto-apply tier and recall of:
 * - auto-only
 * - visible suggestions (strip slots 2 & 3: top 2 candidates)
 * - all candidate suggestions (up to 3)
 * - auto + visible suggestions combined
 * - auto + candidate suggestions combined
 *
 * Also calculates mutually exclusive distance-1 typo categories:
 * (1) Valid in target language dictionary
 * (2) Valid ONLY in other language dictionary
 * (3) Genuine non-word (neither dictionary)
 *
 * Output saved to evidence/v0.5.0/tiered-actions.json
 */

import fs from 'node:fs';
import { createEngine } from '../engine/engine';
import {
  loadCorpora,
  DEFAULT_SEED,
  createMulberry32,
  createTypoInjector,
} from './lib/eval-harness';

async function main() {
  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const engine = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });
  const { dev } = loadCorpora('.');

  const rng = createMulberry32(DEFAULT_SEED);
  const injectTypo = createTypoInjector(rng);

  let totalD1Typos = 0;
  let autoReplaced = 0;
  let autoCorrect = 0;
  let combinedVisibleCorrect = 0;
  let combinedCandidateCorrect = 0;

  let targetWordInjected = 0;
  let targetWordAutoRecovered = 0;
  let targetWordCombinedRecovered = 0;

  let otherWordInjected = 0;
  let otherWordAutoRecovered = 0;
  let otherWordCombinedRecovered = 0;

  let nonWordInjected = 0;
  let nonWordAutoRecovered = 0;
  let nonWordCombinedRecovered = 0;

  for (const item of dev) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const token of rawTokens) {
      if (token.length < 3) continue;

      const shouldInject = rng() < 0.083;
      if (!shouldInject) {
        leftContext.push(token);
        if (leftContext.length > 8) leftContext.shift();
        continue;
      }

      const typo = injectTypo(token, item.lang === 'fr');
      if (!typo || typo.distance !== 1) {
        leftContext.push(token);
        if (leftContext.length > 8) leftContext.shift();
        continue;
      }

      totalD1Typos++;
      const evalToken = typo.noisy;
      const dec = engine.analyze({
        token: evalToken,
        boundary: ' ',
        leftContext,
        langHint: undefined, // Production mode
      });

      const otherLang = item.lang === 'fr' ? 'en' : 'fr';
      const inTarget = engine.isKnownWord(evalToken.toLowerCase(), item.lang);
      const inOther = engine.isKnownWord(evalToken.toLowerCase(), otherLang);
      const inOtherOnly = !inTarget && inOther;
      const genuineNonWord = !inTarget && !inOther;

      if (inTarget) targetWordInjected++;
      else if (inOtherOnly) otherWordInjected++;
      else nonWordInjected++;

      const expectedLow = token.toLowerCase();
      let isAutoCorrect = false;

      if (dec.action === 'replace') {
        autoReplaced++;
        if (dec.replacement.toLowerCase() === expectedLow) {
          autoCorrect++;
          isAutoCorrect = true;
          if (inTarget) targetWordAutoRecovered++;
          else if (inOtherOnly) otherWordAutoRecovered++;
          else nonWordAutoRecovered++;
        }
      }

      const suggestions = engine.suggest({
        token: evalToken,
        boundary: ' ',
        leftContext,
        langHint: undefined,
      });

      const inVisible = suggestions.slice(0, 2).some(s => s.toLowerCase() === expectedLow);
      const inCandidate = suggestions.some(s => s.toLowerCase() === expectedLow);

      const isVisibleRecovered = isAutoCorrect || inVisible;
      const isCandidateRecovered = isAutoCorrect || inCandidate;

      if (isVisibleRecovered) {
        combinedVisibleCorrect++;
        if (inTarget) targetWordCombinedRecovered++;
        else if (inOtherOnly) otherWordCombinedRecovered++;
        else nonWordCombinedRecovered++;
      }

      if (isCandidateRecovered) {
        combinedCandidateCorrect++;
      }

      leftContext.push(evalToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  // Invariant checks
  if (targetWordInjected + otherWordInjected + nonWordInjected !== totalD1Typos) {
    throw new Error('WP1 Invariant Failed: Category partition mismatch');
  }
  if (targetWordAutoRecovered + otherWordAutoRecovered + nonWordAutoRecovered !== autoCorrect) {
    throw new Error('WP1 Invariant Failed: Auto recovered sum mismatch');
  }
  if (targetWordCombinedRecovered + otherWordCombinedRecovered + nonWordCombinedRecovered !== combinedVisibleCorrect) {
    throw new Error('WP1 Invariant Failed: Combined recovered sum mismatch');
  }

  const autoPrecision = (autoCorrect / (autoReplaced || 1)) * 100;
  const autoRecall = (autoCorrect / (totalD1Typos || 1)) * 100;
  const combinedVisibleRecall = (combinedVisibleCorrect / (totalD1Typos || 1)) * 100;
  const combinedCandidateRecall = (combinedCandidateCorrect / (totalD1Typos || 1)) * 100;

  const result = {
    totalD1Typos,
    autoReplaced,
    autoCorrect,
    combinedVisibleCorrect,
    combinedCandidateCorrect,
    autoPrecision: parseFloat(autoPrecision.toFixed(2)),
    autoRecall: parseFloat(autoRecall.toFixed(2)),
    combinedVisibleRecall: parseFloat(combinedVisibleRecall.toFixed(2)),
    combinedCandidateRecall: parseFloat(combinedCandidateRecall.toFixed(2)),
    categories: {
      targetWord: {
        injected: targetWordInjected,
        autoRecovered: targetWordAutoRecovered,
        combinedRecovered: targetWordCombinedRecovered,
        autoRecall: parseFloat(((targetWordAutoRecovered / targetWordInjected) * 100).toFixed(2)),
        combinedRecall: parseFloat(((targetWordCombinedRecovered / targetWordInjected) * 100).toFixed(2)),
      },
      otherWord: {
        injected: otherWordInjected,
        autoRecovered: otherWordAutoRecovered,
        combinedRecovered: otherWordCombinedRecovered,
        autoRecall: parseFloat(((otherWordAutoRecovered / otherWordInjected) * 100).toFixed(2)),
        combinedRecall: parseFloat(((otherWordCombinedRecovered / otherWordInjected) * 100).toFixed(2)),
      },
      genuineNonWord: {
        injected: nonWordInjected,
        autoRecovered: nonWordAutoRecovered,
        combinedRecovered: nonWordCombinedRecovered,
        autoRecall: parseFloat(((nonWordAutoRecovered / nonWordInjected) * 100).toFixed(2)),
        combinedRecall: parseFloat(((nonWordCombinedRecovered / nonWordInjected) * 100).toFixed(2)),
      },
    },
    // Backwards compatibility alias
    autoOrSuggestCorrect: combinedVisibleCorrect,
    combinedRecall: parseFloat(combinedVisibleRecall.toFixed(2)),
  };

  console.log('Tiered Actions Evaluation (Dev Split, Production Policy):');
  console.log('------------------------------------------------------------');
  console.log(`Auto-apply Tier Precision: ${result.autoPrecision}% (${autoCorrect}/${autoReplaced})`);
  console.log(`Auto-apply Tier Recall:    ${result.autoRecall}% (${autoCorrect}/${totalD1Typos})`);
  console.log(`Auto+Visible Suggest Combined Recall: ${result.combinedVisibleRecall}% (${combinedVisibleCorrect}/${totalD1Typos})`);
  console.log(`Auto+Candidate Suggest Combined Recall: ${result.combinedCandidateRecall}% (${combinedCandidateCorrect}/${totalD1Typos})`);
  console.log('------------------------------------------------------------');
  console.log('Mutually Exclusive Categories:');
  console.log(`  1. Target-language word: ${targetWordInjected} (${result.categories.targetWord.autoRecall}% auto, ${result.categories.targetWord.combinedRecall}% combined)`);
  console.log(`  2. Other-language word:  ${otherWordInjected} (${result.categories.otherWord.autoRecall}% auto, ${result.categories.otherWord.combinedRecall}% combined)`);
  console.log(`  3. Genuine non-word:     ${nonWordInjected} (${result.categories.genuineNonWord.autoRecall}% auto, ${result.categories.genuineNonWord.combinedRecall}% combined)`);
  console.log(`  Sum: ${targetWordInjected + otherWordInjected + nonWordInjected} === ${totalD1Typos}`);
  console.log('------------------------------------------------------------');

  const outPath = 'evidence/v0.5.0/tiered-actions.json';
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Evidence written to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
