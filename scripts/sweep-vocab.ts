import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createEngine } from '../engine/engine';
import { hashString, fold } from '../engine/normalize';

const SEED = 20261016;

function createMulberry32(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const QWERTY_NEIGHBORS: Record<string, string[]> = {
  a: ['q', 'w', 's', 'z'], b: ['v', 'g', 'h', 'n'], c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'], e: ['w', 's', 'd', 'r'], f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'], h: ['g', 'y', 'u', 'j', 'n', 'b'], i: ['u', 'j', 'k', 'o'],
  j: ['h', 'u', 'i', 'k', 'm', 'n'], k: ['j', 'i', 'o', 'l', 'm'], l: ['k', 'o', 'p'],
  m: ['n', 'j', 'k'], n: ['b', 'h', 'j', 'm'], o: ['i', 'k', 'l', 'p'], p: ['o', 'l'],
  q: ['w', 'a'], r: ['e', 'd', 'f', 't'], s: ['a', 'w', 'e', 'd', 'x', 'z'],
  t: ['r', 'f', 'g', 'y'], u: ['y', 'h', 'j', 'i'], v: ['c', 'f', 'g', 'b'],
  w: ['q', 'a', 's', 'e'], x: ['z', 's', 'd', 'c'], y: ['t', 'g', 'h', 'u'], z: ['a', 's', 'x'],
};

const AZERTY_NEIGHBORS: Record<string, string[]> = {
  a: ['z', 'q'], b: ['v', 'g', 'h', 'n'], c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'], e: ['z', 's', 'd', 'r'], f: ['d', 'r', 't', 'g', 'v', 'c'],
  g: ['f', 't', 'y', 'h', 'b', 'v'], h: ['g', 'y', 'u', 'j', 'n', 'b'], i: ['u', 'j', 'k', 'o'],
  j: ['h', 'u', 'i', 'k', 'n'], k: ['j', 'i', 'o', 'l'], l: ['k', 'o', 'p', 'm'],
  m: ['l', 'p'], n: ['b', 'h', 'j'], o: ['i', 'k', 'l', 'p'], p: ['o', 'l', 'm'],
  q: ['a', 'z', 's', 'w'], r: ['e', 'd', 'f', 't'], s: ['q', 'z', 'e', 'd', 'x', 'w'],
  t: ['r', 'f', 'g', 'y'], u: ['y', 'h', 'j', 'i'], v: ['c', 'f', 'g', 'b'],
  w: ['q', 's', 'x'], x: ['w', 's', 'd', 'c'], y: ['t', 'g', 'h', 'u'], z: ['a', 'q', 's', 'e'],
};

function injectTypoWithRng(word: string, isFr: boolean, rng: () => number) {
  if (word.length < 3) return null;
  const neighbors = isFr ? AZERTY_NEIGHBORS : QWERTY_NEIGHBORS;
  const rand = rng();

  if (isFr && rand < 0.10) {
    const folded = fold(word);
    if (folded !== word) return { noisy: folded, distance: 1 };
  }

  if (rand < 0.35 && word.length >= 4) {
    const idx = 1 + Math.floor(rng() * (word.length - 2));
    const chars = word.split('');
    const temp = chars[idx]!;
    chars[idx] = chars[idx + 1]!;
    chars[idx + 1] = temp;
    const noisy = chars.join('');
    if (noisy !== word) return { noisy, distance: 1 };
  }

  if (rand < 0.65) {
    const idx = 1 + Math.floor(rng() * (word.length - 1));
    const char = word[idx]!.toLowerCase();
    const list = neighbors[char];
    if (list && list.length > 0) {
      const sub = list[Math.floor(rng() * list.length)]!;
      const noisy = word.slice(0, idx) + sub + word.slice(idx + 1);
      return { noisy, distance: 1 };
    }
  }

  if (rand < 0.85 && word.length >= 4) {
    const idx = 1 + Math.floor(rng() * (word.length - 1));
    const noisy = word.slice(0, idx) + word.slice(idx + 1);
    return { noisy, distance: 1 };
  }

  if (rand < 0.95 && word.length >= 4) {
    const idx = 1 + Math.floor(rng() * (word.length - 1));
    const char = word[idx]!;
    const noisy = word.slice(0, idx) + char + word.slice(idx);
    return { noisy, distance: 1 };
  }

  if (word.length >= 5) {
    const idx1 = 1;
    const idx2 = word.length - 2;
    const char1 = word[idx1]!.toLowerCase();
    const list1 = neighbors[char1] || ['e', 's', 'a'];
    const sub1 = list1[Math.floor(rng() * list1.length)]!;
    const intermediate = word.slice(0, idx1) + sub1 + word.slice(idx1 + 1);
    const noisy = intermediate.slice(0, idx2) + intermediate.slice(idx2 + 1);
    return { noisy, distance: 2 };
  }

  return null;
}

const tatoebaRaw = JSON.parse(fs.readFileSync('data/raw/tatoeba-sentences.json', 'utf-8'));
const enTatoeba = Object.entries(tatoebaRaw.en as Record<string, string>);
const frTatoeba = Object.entries(tatoebaRaw.fr as Record<string, string>);

const devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];
for (const [id, text] of enTatoeba) {
  if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'en' });
}
for (const [id, text] of frTatoeba) {
  if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'fr' });
}

function evaluateDevOnEngine(engine: any) {
  const rng = createMulberry32(SEED);
  let cleanTokens = 0;
  let cleanFp = 0;
  let injected = 0;
  let d1Injected = 0;
  let d1Recovered = 0;
  let replacements = 0;
  let truePositives = 0;

  // Clean pass
  for (const item of devCorpus) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];
    for (const rawToken of rawTokens) {
      if (rawToken.length < 2) continue;
      cleanTokens++;
      const decision = engine.analyze({ token: rawToken, boundary: ' ', leftContext, langHint: item.lang });
      if (decision.action === 'replace' && decision.replacement.toLowerCase() !== rawToken.toLowerCase()) {
        cleanFp++;
      }
      leftContext.push(rawToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  // Noisy pass
  for (const item of devCorpus) {
    const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];
    for (const token of rawTokens) {
      if (token.length < 3) continue;
      const inject = rng() < 0.083;
      let evalToken = token;
      let typoMeta: any = null;
      if (inject) {
        typoMeta = injectTypoWithRng(token, item.lang === 'fr', rng);
        if (typoMeta) {
          evalToken = typoMeta.noisy;
          injected++;
          if (typoMeta.distance === 1) d1Injected++;
        }
      }
      const decision = engine.analyze({ token: evalToken, boundary: ' ', leftContext, langHint: item.lang });
      if (decision.action === 'replace') {
        replacements++;
        const rep = decision.replacement.toLowerCase();
        const exp = token.toLowerCase();
        if (typoMeta && rep === exp) {
          truePositives++;
          if (typoMeta.distance === 1) d1Recovered++;
        }
      }
      leftContext.push(evalToken);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  const cleanFpr = (cleanFp / cleanTokens) * 100;
  const appliedPrecision = (truePositives / (replacements || 1)) * 100;
  const recallD1 = (d1Recovered / (d1Injected || 1)) * 100;
  const recallOverall = (truePositives / (injected || 1)) * 100;

  return { cleanTokens, cleanFp, cleanFpr, appliedPrecision, recallD1, recallOverall };
}

const tiers = [26500, 40000, 60000];

console.log('Starting Candidate Vocabulary Size Sweep (C2)...');
const results: any[] = [];

for (const limit of tiers) {
  console.log(`\n================== BUILDING DATA LIMIT ${limit} ==================`);
  execSync(`pnpm tsx scripts/build-data.ts --limit ${limit}`, { stdio: 'inherit' });

  const enStat = fs.statSync('public/dict/en.bin');
  const frStat = fs.statSync('public/dict/fr.bin');
  const totalPkgMb = (enStat.size + frStat.size) / (1024 * 1024);

  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');

  const memBefore = process.memoryUsage().heapUsed;
  const engine = createEngine({ en: enBuf, fr: frBuf });
  const memDeltaMb = (process.memoryUsage().heapUsed - memBefore) / (1024 * 1024);

  console.log(`Evaluating Dev Split for Limit ${limit}...`);
  const metrics = evaluateDevOnEngine(engine);
  results.push({ limit, totalPkgMb, memDeltaMb, ...metrics });
}

console.log('\n========================================================================================');
console.log('                 C2: CANDIDATE VOCABULARY SIZE SWEEP (DEV SPLIT)                         ');
console.log('========================================================================================');
console.log('Limit (N)'.padEnd(12) + 'Pkg Size'.padEnd(12) + 'Heap Δ'.padEnd(10) + 'Clean FPR'.padEnd(12) + 'Precision'.padEnd(12) + 'Recall D1'.padEnd(12) + 'Overall Rec');
console.log('-'.repeat(80));
for (const r of results) {
  console.log(
    `${String(r.limit).padEnd(12)}` +
    `${r.totalPkgMb.toFixed(2)} MB`.padEnd(12) +
    `${r.memDeltaMb.toFixed(2)} MB`.padEnd(10) +
    `${r.cleanFpr.toFixed(3)}%`.padEnd(12) +
    `${r.appliedPrecision.toFixed(2)}%`.padEnd(12) +
    `${r.recallD1.toFixed(2)}%`.padEnd(12) +
    `${r.recallOverall.toFixed(2)}%`
  );
}
console.log('========================================================================================\n');
