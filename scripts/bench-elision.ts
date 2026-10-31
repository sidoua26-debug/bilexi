/**
 * scripts/bench-elision.ts
 * Benchmark French elision restoration on Tatoeba sentences.
 * Tests removing apostrophes from French sentences and measuring precision and recall
 * of elision restoration, and confirms no regression on must-stay words.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine';
import { hashString } from '../engine/normalize';

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

const rng = createMulberry32(SEED);

const enBuf = fs.readFileSync('public/dict/en.bin');
const frBuf = fs.readFileSync('public/dict/fr.bin');
const engine = createEngine({ en: enBuf, fr: frBuf }, { languageMode: 'auto', sensitivity: 'balanced' });

// Load French Tatoeba sentences
const tatoebaRaw = JSON.parse(fs.readFileSync('data/raw/tatoeba-sentences.json', 'utf-8'));
const frTatoeba = Object.entries(tatoebaRaw.fr as Record<string, string>);

const devSentences: Array<{ id: string; text: string }> = [];
const testSentences: Array<{ id: string; text: string }> = [];

for (const [id, text] of frTatoeba) {
  if (hashString(id) % 10 < 6) devSentences.push({ id, text });
  else testSentences.push({ id, text });
}

function evaluateElisionSplit(sentences: Array<{ id: string; text: string }>) {
  let totalElisions = 0;
  let restoredExact = 0;
  let falseElisionReplacements = 0;
  let totalTested = 0;

  for (const s of sentences) {
    const tokens = s.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
    const leftContext: string[] = [];

    for (const token of tokens) {
      if (token.length < 3) continue;

      // Detect if token contains an elision: e.g. j'espère, l'homme, d'accord, qu'il
      const hasApos = token.includes("'") || token.includes('’');
      if (hasApos && /^(l|d|j|n|m|t|s|c|qu|jusqu|lorsqu|puisqu)['’][a-zàâäéèêëîïôöùûüœæh]/i.test(token)) {
        totalElisions++;
        // Strip apostrophe
        const stripped = token.replace(/['’]/g, '');
        totalTested++;

        const dec = engine.analyze({
          token: stripped,
          boundary: ' ',
          leftContext,
          langHint: 'fr',
        });

        if (dec.action === 'replace') {
          const normRep = dec.replacement.toLowerCase().replace(/’/g, "'");
          const normExp = token.toLowerCase().replace(/’/g, "'");
          if (normRep === normExp) {
            restoredExact++;
          } else {
            falseElisionReplacements++;
          }
        }
      }

      leftContext.push(token);
      if (leftContext.length > 8) leftContext.shift();
    }
  }

  const recall = (restoredExact / (totalElisions || 1)) * 100;
  const precision = (restoredExact / (restoredExact + falseElisionReplacements || 1)) * 100;

  return { totalElisions, restoredExact, falseElisionReplacements, recall, precision };
}

console.log('========================================================================================');
console.log('             TASK S1: FRENCH ELISION RESTORATION BENCHMARK (TATOEBA)                    ');
console.log('========================================================================================');

const devRes = evaluateElisionSplit(devSentences);
console.log(`Dev Split (${devSentences.length} sentences):`);
console.log(`  - Total stripped elisions tested: ${devRes.totalElisions}`);
console.log(`  - Correctly restored:              ${devRes.restoredExact}`);
console.log(`  - False replacements:              ${devRes.falseElisionReplacements}`);
console.log(`  - Elision Recall:                  ${devRes.recall.toFixed(2)}%`);
console.log(`  - Elision Precision:               ${devRes.precision.toFixed(2)}%\n`);

const testRes = evaluateElisionSplit(testSentences);
console.log(`Held-out Test Split (${testSentences.length} sentences):`);
console.log(`  - Total stripped elisions tested: ${testRes.totalElisions}`);
console.log(`  - Correctly restored:              ${testRes.restoredExact}`);
console.log(`  - False replacements:              ${testRes.falseElisionReplacements}`);
console.log(`  - Elision Recall:                  ${testRes.recall.toFixed(2)}%`);
console.log(`  - Elision Precision:               ${testRes.precision.toFixed(2)}%\n`);

// Must-stay words verification
console.log('Checking Must-Stay words:');
const mustStayWords = ['sa', 'ma', 'ta', 'te', 'se', 'ne', 'je', 'de', 'le', 'la', 'mes', 'tes', 'dune', 'sans'];
let mustStayPassed = true;
for (const w of mustStayWords) {
  const dec = engine.analyze({ token: w, boundary: ' ', leftContext: [] });
  if (dec.action === 'replace') {
    console.error(`  FAIL: must-stay word '${w}' was replaced with '${dec.replacement}'!`);
    mustStayPassed = false;
  } else {
    console.log(`  PASS: '${w}' -> untouched (${dec.reason})`);
  }
}
console.log(`\nMust-stay words check: ${mustStayPassed ? 'ALL PASSED' : 'FAILED'}`);
console.log('========================================================================================\n');
