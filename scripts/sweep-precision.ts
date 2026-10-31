import fs from 'node:fs';
import { createStandardEngine, loadCorpora, DEFAULT_SEED, createMulberry32, createTypoInjector } from './lib/eval-harness';

async function main() {
  const { dev } = loadCorpora('.');
  const engine = createStandardEngine();
  const rng = createMulberry32(DEFAULT_SEED);
  const injectTypo = createTypoInjector(rng);

  interface DecisionData {
    token: string;
    expected: string;
    rep: string;
    isCorrect: boolean;
    score: number;
    confidence: number;
    margin: number;
    len: number;
    dist: number;
  }

  const data: DecisionData[] = [];
  let totalD1 = 0;

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

      totalD1++;
      const evalToken = typo.noisy;
      const dec = engine.analyze({
        token: evalToken,
        boundary: ' ',
        leftContext,
        langHint: undefined,
      });

      if (dec.action === 'replace') {
        const alts = dec.alternatives || [];
        const runnerUpScore = alts.length > 0 ? alts[0].score : (dec.score ? dec.score - 5 : 0);
        const margin = (dec.score !== undefined && runnerUpScore !== undefined) ? (dec.score - runnerUpScore) : 5.0;
        data.push({
          token: evalToken,
          expected: token,
          rep: dec.replacement,
          isCorrect: dec.replacement.toLowerCase() === token.toLowerCase(),
          score: dec.score || 0,
          confidence: dec.confidence || 0,
          margin,
          len: evalToken.length,
          dist: alts.length > 0 ? (alts[0].distance || 1) : 1,
        });
      }

      leftContext.push(evalToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  console.log(`Total D1: ${totalD1}, Replacements: ${data.length}`);

  // Now sweep gating rules!
  for (const minConf of [0.5, 0.7, 0.8, 0.85, 0.88, 0.90, 0.92, 0.93, 0.94]) {
    for (const minMargin of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]) {
      const passed = data.filter(d => {
        if (d.confidence < minConf) return false;
        if (d.margin < minMargin) return false;
        if (d.len === 3 && d.margin < minMargin + 1.0) return false;
        return true;
      });
      const tp = passed.filter(d => d.isCorrect).length;
      const prec = (tp / (passed.length || 1)) * 100;
      const rec = (tp / totalD1) * 100;
      if (prec >= 96.0) {
        console.log(`minConf=${minConf.toFixed(2)}, minMargin=${minMargin.toFixed(1)} => Kept=${passed.length}, Prec=${prec.toFixed(2)}%, AutoRecall=${rec.toFixed(2)}%`);
      }
    }
  }
}

main().catch(console.error);
