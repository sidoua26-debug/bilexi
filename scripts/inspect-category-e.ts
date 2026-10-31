import fs from 'node:fs';
import { createEngine } from '../engine/engine';
import { loadCorpora, DEFAULT_SEED } from './lib/eval-harness';

const data = JSON.parse(fs.readFileSync('evidence/v0.5.0/french-heldout-bad-replacements.json', 'utf8'));
const enBuf = fs.readFileSync('public/dict/en.bin');
const frBuf = fs.readFileSync('public/dict/fr.bin');
const ngBuf = fs.readFileSync('public/dict/ngram.bin');
const engine = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });

const { test } = loadCorpora('.');

console.log("Analyzing Category E items in context...\n");

for (const d of data) {
  const orig = d.original;
  const noisy = d.noisy;
  const rep = d.replacement;

  // Category E filter
  if (!(
    (orig.length >= 5 && noisy.length >= 5) &&
    (orig.slice(0, 3) === rep.slice(0, 3) || orig.toLowerCase() === rep.toLowerCase())
  )) continue;

  const sent = test.find(s => s.id === d.sentenceId);
  const leftCtx = sent ? sent.text.slice(0, sent.text.indexOf(orig)).trim().split(/\s+/).slice(-5) : [];

  const dec = engine.analyze({
    token: noisy,
    boundary: ' ',
    leftContext: leftCtx,
    langHint: undefined,
  });

  const alts = dec.alternatives || [];
  const runnerUp = alts[0];
  const margin = (dec.score !== undefined && runnerUp?.score !== undefined) ? (dec.score - runnerUp.score) : null;

  console.log(`Sent #${d.sentenceId}: orig="${orig}" noisy="${noisy}" -> rep="${rep}" (conf=${dec.confidence.toFixed(2)}, score=${dec.score?.toFixed(2)}, margin=${margin?.toFixed(2)})`);
  console.log(`  Top alternatives:`, alts.slice(0, 3).map(a => `${a.word} (sc=${a.score?.toFixed(2)})`).join(', '));
}
