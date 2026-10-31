/**
 * scripts/eval-circularity.ts
 *
 * Measures precision and recall per error type on Dev split:
 * - substitution
 * - transposition
 * - omission
 * - duplication
 * - accent-drop
 *
 * Saves raw output to evidence/v0.5.0/circularity.json
 */

import fs from 'node:fs';
import { createEngine } from '../engine/engine';
import {
  loadCorpora,
  DEFAULT_SEED,
  createMulberry32,
  createTypoInjector,
  type TypoResult,
} from './lib/eval-harness';

async function main() {
  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const engine = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });
  const { dev } = loadCorpora('.');

  const rng = createMulberry32(DEFAULT_SEED);
  const injectTypo = createTypoInjector(rng);

  type ErrorType = 'substitution' | 'transposition' | 'omission' | 'duplication' | 'accent-drop';

  const stats: Record<ErrorType, {
    injected: number;
    replaced: number;
    correct: number;
  }> = {
    substitution: { injected: 0, replaced: 0, correct: 0 },
    transposition: { injected: 0, replaced: 0, correct: 0 },
    omission: { injected: 0, replaced: 0, correct: 0 },
    duplication: { injected: 0, replaced: 0, correct: 0 },
    'accent-drop': { injected: 0, replaced: 0, correct: 0 },
  };

  for (const item of dev) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const token of rawTokens) {
      if (token.length < 3) continue;

      const shouldInject = rng() < 0.083;
      let evalToken = token;
      let typo: TypoResult | null = null;

      if (shouldInject) {
        typo = injectTypo(token, item.lang === 'fr');
        if (typo && typo.distance === 1 && typo.type in stats) {
          evalToken = typo.noisy;
          stats[typo.type as ErrorType].injected++;
        } else {
          typo = null;
        }
      }

      const dec = engine.analyze({
        token: evalToken,
        boundary: ' ',
        leftContext,
        langHint: undefined, // Production mode
      });

      if (typo) {
        const t = typo.type as ErrorType;
        if (dec.action === 'replace') {
          stats[t].replaced++;
          if (dec.replacement.toLowerCase() === token.toLowerCase()) {
            stats[t].correct++;
          }
        }
      }

      leftContext.push(evalToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  const results: Record<string, {
    injected: number;
    replaced: number;
    correct: number;
    precision: number;
    recall: number;
  }> = {};

  console.log('Error Type Breakdown (Dev Set, Production Policy):');
  console.log('-------------------------------------------------------------');
  console.log('Type            | Injected | Replaced | Correct | Prec (%) | Rec (%)');
  console.log('-------------------------------------------------------------');

  for (const [t, s] of Object.entries(stats)) {
    const prec = s.replaced > 0 ? (s.correct / s.replaced) * 100 : 0;
    const rec = s.injected > 0 ? (s.correct / s.injected) * 100 : 0;
    results[t] = {
      ...s,
      precision: parseFloat(prec.toFixed(2)),
      recall: parseFloat(rec.toFixed(2)),
    };
    console.log(
      `${t.padEnd(16)}| ${String(s.injected).padStart(8)} | ${String(s.replaced).padStart(8)} | ${String(s.correct).padStart(7)} | ${prec.toFixed(2).padStart(8)} | ${rec.toFixed(2).padStart(7)}`
    );
  }

  const outPath = 'evidence/v0.5.0/circularity.json';
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nEvidence written to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
