/**
 * scripts/eval-calibration.ts
 *
 * Computes ECE (Expected Calibration Error) and Brier Score for
 * Platt-calibrated confidence on Dev and Held-Out Test splits.
 *
 * Output saved to evidence/v0.5.0/calibration.json
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

interface CalibrationMetrics {
  brierScore: number;
  ece: number; // percentage
  samples: number;
  bins: Array<{
    binLower: number;
    binUpper: number;
    count: number;
    avgConfidence: number;
    accuracy: number;
  }>;
}

function evaluateCalibration(
  corpus: any[],
  engine: any,
  seed = DEFAULT_SEED
): CalibrationMetrics {
  const rng = createMulberry32(seed);
  const injectTypo = createTypoInjector(rng);

  const predictions: Array<{ conf: number; correct: number }> = [];

  for (const item of corpus) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    // Clean pass (predictions of replacement on clean tokens are incorrect: correct = 0)
    for (const raw of rawTokens) {
      if (raw.length < 2) continue;
      const dec = engine.analyze({ token: raw, boundary: ' ', leftContext });
      if (dec.action === 'replace' && dec.replacement.toLowerCase() !== raw.toLowerCase()) {
        predictions.push({
          conf: dec.confidence ?? 0.5,
          correct: 0,
        });
      }
      leftContext.push(raw);
      if (leftContext.length > 8) leftContext.shift();
    }

    // Noisy pass
    const leftContextNoisy: string[] = [];
    for (const token of rawTokens) {
      if (token.length < 3) continue;

      const shouldInject = rng() < 0.083;
      let evalToken = token;
      let typo: TypoResult | null = null;

      if (shouldInject) {
        typo = injectTypo(token, item.lang === 'fr');
        if (typo) {
          evalToken = typo.noisy;
        }
      }

      const dec = engine.analyze({ token: evalToken, boundary: ' ', leftContext: leftContextNoisy });
      if (dec.action === 'replace') {
        const isCorrect = typo
          ? (dec.replacement.toLowerCase() === token.toLowerCase() ? 1 : 0)
          : (dec.replacement.toLowerCase() === evalToken.toLowerCase() ? 1 : 0);
        predictions.push({
          conf: dec.confidence ?? 0.5,
          correct: isCorrect,
        });
      }

      leftContextNoisy.push(evalToken);
      if (leftContextNoisy.length > 8) leftContextNoisy.shift();
    }
  }

  // Calculate Brier Score: mean((conf - correct)^2)
  const n = predictions.length;
  const brier = n > 0 ? predictions.reduce((acc, p) => acc + (p.conf - p.correct) ** 2, 0) / n : 0;

  // Calculate 10-bin ECE
  const numBins = 10;
  const binCounts = new Array(numBins).fill(0);
  const binConfSums = new Array(numBins).fill(0);
  const binCorrectSums = new Array(numBins).fill(0);

  for (const p of predictions) {
    const binIdx = Math.min(numBins - 1, Math.floor(p.conf * numBins));
    binCounts[binIdx]++;
    binConfSums[binIdx] += p.conf;
    binCorrectSums[binIdx] += p.correct;
  }

  let ece = 0;
  const binDetails = [];
  for (let i = 0; i < numBins; i++) {
    const count = binCounts[i];
    const binLower = i / numBins;
    const binUpper = (i + 1) / numBins;
    if (count > 0) {
      const avgConf = binConfSums[i] / count;
      const acc = binCorrectSums[i] / count;
      ece += (count / n) * Math.abs(acc - avgConf);
      binDetails.push({
        binLower,
        binUpper,
        count,
        avgConfidence: parseFloat(avgConf.toFixed(4)),
        accuracy: parseFloat(acc.toFixed(4)),
      });
    }
  }

  return {
    brierScore: parseFloat(brier.toFixed(4)),
    ece: parseFloat((ece * 100).toFixed(2)),
    samples: n,
    bins: binDetails,
  };
}

async function main() {
  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const engine = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });
  const { dev, test } = loadCorpora('.');

  console.log('Evaluating Platt calibration on Dev...');
  const devCalib = evaluateCalibration(dev, engine);
  console.log(`  Dev Brier Score: ${devCalib.brierScore}, ECE: ${devCalib.ece}% (${devCalib.samples} samples)`);

  console.log('Evaluating Platt calibration on Held-Out Test...');
  const testCalib = evaluateCalibration(test, engine);
  console.log(`  Test Brier Score: ${testCalib.brierScore}, ECE: ${testCalib.ece}% (${testCalib.samples} samples)`);

  const out = {
    timestamp: new Date().toISOString(),
    status: 'display-only (does not gate actions)',
    dev: devCalib,
    test: testCalib,
  };

  const outPath = 'evidence/v0.5.0/calibration.json';
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
  console.log(`\nEvidence written to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
