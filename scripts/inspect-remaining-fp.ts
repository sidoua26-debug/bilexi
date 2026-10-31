import fs from 'node:fs';
import { createStandardEngine, loadCorpora, DEFAULT_SEED, createMulberry32, createTypoInjector } from './lib/eval-harness';
import { fold } from '../engine/normalize';

async function main() {
  const { dev } = loadCorpora('.');
  const engine = createStandardEngine();
  const rng = createMulberry32(DEFAULT_SEED);
  const injectTypo = createTypoInjector(rng);

  let fpCount = 0;
  let tpCount = 0;
  const fps: any[] = [];

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
        if (isCorrect) {
          tpCount++;
        } else {
          fpCount++;
          const alts = dec.alternatives || [];
          const runnerUpScore = alts.length > 0 ? alts[0].score : (dec.score ? dec.score - 5 : 0);
          const margin = (dec.score !== undefined && runnerUpScore !== undefined) ? (dec.score - runnerUpScore) : 5.0;
          fps.push({
            orig: token,
            noisy: evalToken,
            rep: dec.replacement,
            lang: item.lang,
            len: evalToken.length,
            conf: dec.confidence,
            score: dec.score,
            margin,
            hasAlts: alts.length > 0,
            dist: alts.length > 0 ? alts[0].distance : 0,
          });
        }
      }

      leftContext.push(evalToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  console.log('TP:', tpCount, 'FP:', fpCount, 'Precision:', (tpCount / (tpCount + fpCount) * 100).toFixed(2) + '%');
  console.log('Sample FPs:');
  fps.slice(0, 15).forEach(f => console.log(JSON.stringify(f)));

  // Group by length
  const byLen: Record<number, number> = {};
  fps.forEach(f => { byLen[f.len] = (byLen[f.len] || 0) + 1; });
  console.log('FP by length:', byLen);

  // Group by margin range
  console.log('FP with margin < 1.5:', fps.filter(f => f.margin < 1.5).length);
  console.log('FP with margin < 2.0:', fps.filter(f => f.margin < 2.0).length);
  console.log('FP with conf < 0.65:', fps.filter(f => f.conf < 0.65).length);
  console.log('FP with conf < 0.70:', fps.filter(f => f.conf < 0.70).length);
  console.log('FP with hasAlts === false:', fps.filter(f => !f.hasAlts).length);
}

main().catch(console.error);
