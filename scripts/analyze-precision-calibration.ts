import fs from 'node:fs';
import { createStandardEngine, loadCorpora, DEFAULT_SEED, createMulberry32, createTypoInjector } from './lib/eval-harness';

async function main() {
  const { dev } = loadCorpora('.');
  const engine = createStandardEngine();
  const rng = createMulberry32(DEFAULT_SEED);
  const injectTypo = createTypoInjector(rng);

  interface Sample {
    original: string;
    noisy: string;
    replacement: string;
    lang: string;
    isCorrect: boolean;
    len: number;
    distance: number;
    confidence: number;
    score: number;
    margin: number;
    pEn: number;
    pFr: number;
    hasRunnerUp: boolean;
    hasContext: boolean;
    type: string;
  }

  const samples: Sample[] = [];

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

      const evalToken = typo.noisy;
      const dec = engine.analyze({
        token: evalToken,
        boundary: ' ',
        leftContext,
        langHint: undefined,
      });

      if (dec.action === 'replace') {
        const isCorrect = dec.replacement.toLowerCase() === token.toLowerCase();
        const alts = dec.alternatives || [];
        const runnerUpScore = alts.length > 0 ? alts[0].score : (dec.score ? dec.score - 5 : 0);
        const margin = (dec.score !== undefined && runnerUpScore !== undefined) ? (dec.score - runnerUpScore) : 2.0;

        samples.push({
          original: token,
          noisy: evalToken,
          replacement: dec.replacement,
          lang: item.lang,
          isCorrect,
          len: evalToken.length,
          distance: alts.length > 0 ? (alts[0].distance || 1) : 1,
          confidence: dec.confidence || 0,
          score: dec.score || 0,
          margin,
          pEn: 0.5,
          pFr: 0.5,
          hasRunnerUp: alts.length > 0,
          hasContext: leftContext.length > 0,
          type: typo.type,
        });
      }

      leftContext.push(evalToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  console.log(`Total replaced samples: ${samples.length}`);
  const tp = samples.filter(s => s.isCorrect).length;
  const fp = samples.filter(s => !s.isCorrect).length;
  console.log(`TP: ${tp}, FP: ${fp}, Precision: ${(tp / samples.length * 100).toFixed(2)}%`);

  // Analyze features of FP vs TP
  console.log('\n--- Accuracy by Length ---');
  for (let l = 3; l <= 12; l++) {
    const sub = samples.filter(s => s.len === l);
    if (sub.length === 0) continue;
    const subTp = sub.filter(s => s.isCorrect).length;
    const subFp = sub.filter(s => !s.isCorrect).length;
    console.log(`Len ${l}: ${sub.length} samples, TP=${subTp}, FP=${subFp}, Prec=${(subTp / sub.length * 100).toFixed(2)}%`);
  }

  console.log('\n--- Accuracy by Confidence Bucket ---');
  const confBuckets = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1.0];
  for (let i = 0; i < confBuckets.length - 1; i++) {
    const cLow = confBuckets[i];
    const cHigh = confBuckets[i + 1];
    const sub = samples.filter(s => s.confidence >= cLow && s.confidence < cHigh);
    if (sub.length === 0) continue;
    const subTp = sub.filter(s => s.isCorrect).length;
    console.log(`Conf [${cLow}, ${cHigh}): ${sub.length} samples, TP=${subTp}, Prec=${(subTp / sub.length * 100).toFixed(2)}%`);
  }

  console.log('\n--- Accuracy by Margin Bucket ---');
  const marginBuckets = [0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0, 10.0];
  for (let i = 0; i < marginBuckets.length - 1; i++) {
    const mLow = marginBuckets[i];
    const mHigh = marginBuckets[i + 1];
    const sub = samples.filter(s => s.margin >= mLow && s.margin < mHigh);
    if (sub.length === 0) continue;
    const subTp = sub.filter(s => s.isCorrect).length;
    console.log(`Margin [${mLow}, ${mHigh}): ${sub.length} samples, TP=${subTp}, Prec=${(subTp / sub.length * 100).toFixed(2)}%`);
  }
}

main().catch(console.error);
