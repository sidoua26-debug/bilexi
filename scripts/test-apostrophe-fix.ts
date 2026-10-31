import fs from 'fs';
import path from 'path';
import { createEngine } from '../engine/engine';
import { fold, hashString } from '../engine/normalize';
import { weightedDistance } from '../engine/distance';

const ENGLISH_CONTRACTIONS = [
  "don't", "doesn't", "didn't", "won't", "can't", "couldn't", "shouldn't", "wouldn't",
  "isn't", "aren't", "wasn't", "weren't", "hasn't", "haven't", "hadn't",
  "i'm", "i've", "i'll", "i'd",
  "you're", "you've", "you'll", "you'd",
  "he's", "he'll", "he'd",
  "she's", "she'll", "she'd",
  "it's", "it'll",
  "we're", "we've", "we'll", "we'd",
  "they're", "they've", "they'll", "they'd",
  "that's", "what's", "who's", "there's", "here's", "where's", "how's",
  "let's",
];

const testTokens = [
  { noisy: "cna't", expected: "can't" },
  { noisy: "do't", expected: "don't" },
  { noisy: "wont'", expected: "won't" },
  { noisy: "wno't", expected: "won't" },
  { noisy: "theer's", expected: "there's" },
  { noisy: "prosectuor's", expected: "prosecutor's" },
  { noisy: "fahter's", expected: "father's" },
  { noisy: "I'ts", expected: "It's" },
  { noisy: "Tha'ts", expected: "That's" },
  { noisy: "Yo'ure", expected: "You're" },
  { noisy: "I'l", expected: "I'll" },
  { noisy: "I'n", expected: "I'm" },
];

for (const { noisy, expected } of testTokens) {
  let best = '';
  let bestDist = 99;
  for (const c of ENGLISH_CONTRACTIONS) {
    const d = weightedDistance(noisy.toLowerCase(), c, { layout: 'qwerty' });
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  console.log(`Noisy '${noisy}' -> nearest contraction '${best}' (dist: ${bestDist.toFixed(2)}) | expected: '${expected}'`);
}
