import fs from 'node:fs';
import { createStandardEngine, loadCorpora, DEFAULT_SEED, createMulberry32, createTypoInjector } from './lib/eval-harness';

async function main() {
  const { dev } = loadCorpora('.');
  const engine = createStandardEngine();
  const rng = createMulberry32(DEFAULT_SEED);
  const injectTypo = createTypoInjector(rng);

  interface TypoEval {
    token: string;
    expected: string;
    autoRep?: string;
    score?: number;
    confidence?: number;
    margin?: number;
    len: number;
    suggestions: string[];
  }

  const allTypos: TypoEval[] = [];

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

      const suggs = engine.suggest({
        token: evalToken,
        boundary: ' ',
        leftContext,
        langHint: undefined,
      });

      const alts = dec.alternatives || [];
      const runnerUpScore = alts.length > 0 ? alts[0].score : (dec.score ? dec.score - 5 : 0);
      const margin = (dec.score !== undefined && runnerUpScore !== undefined) ? (dec.score - runnerUpScore) : 5.0;

      allTypos.push({
        token: evalToken,
        expected: token,
        autoRep: dec.action === 'replace' ? dec.replacement : undefined,
        score: dec.score,
        confidence: dec.confidence,
        margin,
        len: evalToken.length,
        suggestions: suggs,
      });

      leftContext.push(evalToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  const totalD1 = allTypos.length;
  console.log('Total D1 typos:', totalD1);

  const configs = [
    [0.5, 1.0],
    [0.5, 1.2],
    [0.5, 1.4],
    [0.5, 1.5],
    [0.6, 1.2],
    [0.6, 1.4],
    [0.7, 1.0],
    [0.7, 1.2],
    [0.7, 1.4],
    [0.7, 1.5],
    [0.8, 1.0],
  ];

  for (const [minConf, minMargin] of configs) {
    let autoReplaced = 0;
    let autoCorrect = 0;
    let combinedVisibleCorrect = 0;
    let combinedCandidateCorrect = 0;

    for (const t of allTypos) {
      let willAuto = false;
      const exp = t.expected.toLowerCase();
      if (t.autoRep) {
        const conf = t.confidence || 0;
        const margin = t.margin || 0;
        if (conf >= minConf && margin >= minMargin && !(t.len === 3 && margin < minMargin + 0.8)) {
          willAuto = true;
        }
      }

      let isAutoCorrect = false;
      if (willAuto) {
        autoReplaced++;
        if (t.autoRep!.toLowerCase() === exp) {
          autoCorrect++;
          isAutoCorrect = true;
        }
      }

      const inCand = t.suggestions.some(s => s.toLowerCase() === exp);
      const inVisible = t.suggestions.slice(0, 2).some(s => s.toLowerCase() === exp);

      if (isAutoCorrect || inVisible) {
        combinedVisibleCorrect++;
      }
      if (isAutoCorrect || inCand) {
        combinedCandidateCorrect++;
      }
    }

    const prec = (autoCorrect / (autoReplaced || 1)) * 100;
    const autoRec = (autoCorrect / totalD1) * 100;
    const combVisRec = (combinedVisibleCorrect / totalD1) * 100;
    const combCandRec = (combinedCandidateCorrect / totalD1) * 100;

    console.log(`minConf=${minConf.toFixed(2)}, minMargin=${minMargin.toFixed(1)}:`);
    console.log(`  Auto: Replaced=${autoReplaced}, Correct=${autoCorrect}, Prec=${prec.toFixed(2)}%, Recall=${autoRec.toFixed(2)}%`);
    console.log(`  Combined Visible Recall (Auto + Strip Top-2): ${combVisRec.toFixed(2)}%`);
    console.log(`  Combined Candidate Recall (Auto + All 3 Suggs): ${combCandRec.toFixed(2)}%`);
  }
}

main().catch(console.error);
