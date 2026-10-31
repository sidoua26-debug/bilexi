import fs from 'node:fs';
import path from 'node:path';
import { parseBinaryIndex, LanguageIndex } from '../engine/index';

// Seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 42;
console.log(`=== Testing Bloom Filter False Positive Rate (Seed: ${SEED}) ===`);
const rng = mulberry32(SEED);

const enBuffer = fs.readFileSync(path.resolve('public/dict/en.bin'));
const frBuffer = fs.readFileSync(path.resolve('public/dict/fr.bin'));

const enIndex = new LanguageIndex(parseBinaryIndex(enBuffer));
const frIndex = new LanguageIndex(parseBinaryIndex(frBuffer));

console.log(`English Dictionary: ${enIndex.views.wordCount} words, Bloom bits: ${enIndex.views.bloomFilter.byteLength * 8}, k: ${enIndex.views.bloomK}`);
console.log(`French Dictionary: ${frIndex.views.wordCount} words, Bloom bits: ${frIndex.views.bloomFilter.byteLength * 8}, k: ${frIndex.views.bloomK}`);

// Benchmark typo non-words check
const benchmarkTypos = [
  'wierd',
  'teh',
  'becuase',
  'definately',
  'exmaple',
  'seperate',
  'untill',
  'occured',
  'tommorow',
  'recieve',
  'mispelled',
  'beleive',
  'flim',
  'adress',
  'dificult',
  'tress',
];

console.log('\n--- Checking Common Typos Against Bloom Filters ---');
for (const typo of benchmarkTypos) {
  const enMatch = enIndex.isKnownWord(typo);
  const frMatch = frIndex.isKnownWord(typo);
  console.log(`  typo '${typo}': EN=${enMatch}, FR=${frMatch}`);
}

// Generate 100,000 random non-words
const NUM_TESTS = 100000;
const chars = 'abcdefghijklmnopqrstuvwxyz';

function generateRandomString(len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(rng() * chars.length)];
  }
  return s;
}

// Test on random strings of length 5 to 10
let enCollisions = 0;
let frCollisions = 0;
let testedWords = 0;

for (let i = 0; i < NUM_TESTS; i++) {
  const len = 5 + Math.floor(rng() * 6); // length 5..10
  const word = 'z' + generateRandomString(len - 2) + 'x';
  
  // Verify it's not actually an exact word
  if (enIndex.hasExactWord(word) || frIndex.hasExactWord(word)) {
    continue;
  }
  
  testedWords++;
  if (enIndex.isKnownWord(word)) enCollisions++;
  if (frIndex.isKnownWord(word)) frCollisions++;
}

const enFpr = (enCollisions / testedWords) * 100;
const frFpr = (frCollisions / testedWords) * 100;

console.log(`\n--- Empirical False Positive Rate (100,000 non-words) ---`);
console.log(`Tested valid non-words: ${testedWords}`);
console.log(`English Bloom Collisions: ${enCollisions} / ${testedWords} (${enFpr.toFixed(4)}%) -> Target <= 0.5%: ${enFpr <= 0.5 ? 'PASS' : 'FAIL'}`);
console.log(`French Bloom Collisions:  ${frCollisions} / ${testedWords} (${frFpr.toFixed(4)}%) -> Target <= 0.5%: ${frFpr <= 0.5 ? 'PASS' : 'FAIL'}`);
