import fs from 'node:fs';
import { createStandardEngine, loadCorpora, DEFAULT_SEED, createMulberry32, createTypoInjector } from './lib/eval-harness';
import { fold } from '../engine/normalize';

async function main() {
  const { dev } = loadCorpora('.');
  const engine = createStandardEngine();
  const rng = createMulberry32(DEFAULT_SEED);
  const injectTypo = createTypoInjector(rng);

  interface Cand {
    orig: string;
    noisy: string;
    expected: string;
    action: string;
    rep: string;
    isCorrect: boolean;
    conf: number;
    score: number;
    margin: number;
    hasRunnerUp: boolean;
    len: number;
    isAccentOnly: boolean;
    isCurated: boolean;
  }

  const items: Cand[] = [];

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

      const isCurated = dec.reason?.startsWith('Curated') || false;
      const isAccentOnly = fold(evalToken.toLowerCase()) === fold(dec.replacement.toLowerCase());
      const alts = dec.alternatives || [];
      const runnerUpScore = alts.length > 0 ? alts[0].score : undefined;
      const margin = (dec.score !== undefined && runnerUpScore !== undefined) ? (dec.score - runnerUpScore) : 10.0;

      items.push({
        orig: token,
        noisy: evalToken,
        expected: token.toLowerCase(),
        action: dec.action,
        rep: dec.replacement.toLowerCase(),
        isCorrect: dec.replacement.toLowerCase() === token.toLowerCase(),
        conf: dec.confidence || 0,
        score: dec.score || 0,
        margin,
        hasRunnerUp: runnerUpScore !== undefined,
        len: evalToken.length,
        isAccentOnly,
        isCurated,
      });

      leftContext.push(evalToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  console.log('Total items:', items.length);

  // Sweep parameters
  for (const minConf of [0.60, 0.65, 0.70]) {
    for (const minMargin of [1.2, 1.4, 1.5, 1.6]) {
      for (const shortMargin of [2.0, 2.2, 2.5]) {
        let tp = 0;
        let fp = 0;
        let replaced = 0;

        for (const it of items) {
          if (it.action !== 'replace') continue;

          let pass = true;
          if (!it.isCurated && !it.isAccentOnly) {
            if (it.conf < minConf) pass = false;
            if (it.hasRunnerUp) {
              if (it.margin < minMargin) pass = false;
              if (it.len <= 4 && it.margin < shortMargin) pass = false;
            } else {
              if (it.score < 1.0) pass = false;
            }
          }

          if (pass) {
            replaced++;
            if (it.isCorrect) tp++;
            else fp++;
          }
        }

        const prec = (tp / (replaced || 1)) * 100;
        const rec = (tp / items.length) * 100;
        if (prec >= 97.0) {
          console.log(`PASS: conf=${minConf}, margin=${minMargin}, shortMargin=${shortMargin} => Prec=${prec.toFixed(2)}%, Rec=${rec.toFixed(2)}%, TP=${tp}, FP=${fp}, Rep=${replaced}`);
        }
      }
    }
  }
}

main().catch(console.error);
