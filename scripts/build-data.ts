/**
 * Offline Data Pipeline: scripts/build-data.ts
 * Generates public/dict/en.bin, public/dict/fr.bin, and public/dict/dictionary-manifest.json
 * Uses real frequency corpora: HermitDave FrequencyWords and Lexique 3.83
 * Usage: pnpm tsx scripts/build-data.ts [--limit 40000]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import dictionaryEn from 'dictionary-en';
import dictionaryFr from 'dictionary-fr';
// @ts-expect-error - nspell lacks bundled types
import nspell from 'nspell';

const OUT_DIR = path.resolve('public/dict');
fs.mkdirSync(OUT_DIR, { recursive: true });

// Parse command line arguments for candidate limit
const args = process.argv.slice(2);
let CANDIDATE_LIMIT = 26500;
const limitIdx = args.indexOf('--limit');
if (limitIdx !== -1 && args[limitIdx + 1]) {
  CANDIDATE_LIMIT = parseInt(args[limitIdx + 1]!, 10) || 26500;
}

// Magic number 'BIAU' in little endian (0x55414942)
const MAGIC_NUMBER = 0x55414942;
const FORMAT_VERSION = 2; // Version 2 uses Uint16Array for delete word indices

// FNV-1a 32-bit hash
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// 8-hash bloom filter using Kirsch-Mitzenmacher optimization: gi(x) = h1 + i * h2
export function getBloomBitIndices(str: string, bitCount: number, k = 8): number[] {
  const h1 = hashString(str);
  let h2 = h1 ^ (h1 >>> 16);
  h2 = Math.imul(h2, 0x85ebca6b);
  h2 = h2 ^ (h2 >>> 13);
  h2 = Math.imul(h2, 0xc2b2ae35);
  h2 = (h2 ^ (h2 >>> 16)) >>> 0;
  if (h2 === 0) h2 = 1;

  const indices: number[] = new Array(k);
  for (let i = 0; i < k; i++) {
    indices[i] = ((h1 + Math.imul(i, h2)) >>> 0) % bitCount;
  }
  return indices;
}

// Accent folding: NFD minus combining marks, ligatures
export function fold(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'Oe')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'Ae')
    .replace(/ß/g, 'ss')
    .replace(/’/g, "'");
}

// Symmetric deletes: distance 1 for len 4, distance 2 for len >= 5 (prefix 6)
function getDeletes(word: string, prefixLength = 6): Set<string> {
  const deletes = new Set<string>();
  const prefix = word.length > prefixLength ? word.slice(0, prefixLength) : word;
  const maxDistance = prefix.length <= 4 ? 1 : 2;

  function recurse(w: string, d: number) {
    if (d > 0) deletes.add(w);
    if (d === maxDistance || w.length <= 1) return;
    for (let i = 0; i < w.length; i++) {
      const del = w.slice(0, i) + w.slice(i + 1);
      recurse(del, d + 1);
    }
  }

  recurse(prefix, 0);
  return deletes;
}

// Clean words from Hunspell buffer
function parseHunspellDic(dicBuffer: Buffer | Uint8Array): string[] {
  const content = Buffer.from(dicBuffer).toString('utf-8');
  const lines = content.split('\n');
  const words: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]?.trim();
    if (!raw) continue;
    const slashIdx = raw.indexOf('/');
    const word = (slashIdx >= 0 ? raw.slice(0, slashIdx) : raw).trim();
    if (word && /^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]{2,25}$/.test(word)) {
      words.push(word);
    }
  }
  return words;
}

// Real Frequency Loaders
function loadRealFrequenciesEn(): Map<string, number> {
  const filePath = path.resolve('data/raw/en_50k.txt');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Raw data missing at ${filePath}. Run pnpm fetch:data first.`);
  }

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  let totalOccurrences = 0;
  const rawCounts = new Map<string, number>();

  for (const line of lines) {
    const parts = line.trim().split(' ');
    const word = parts[0]?.trim();
    const count = parseInt(parts[1] || '0', 10);
    if (word && count > 0) {
      rawCounts.set(word.toLowerCase(), count);
      totalOccurrences += count;
    }
  }

  const cpmMap = new Map<string, number>();
  for (const [word, count] of rawCounts) {
    const cpm = (count / totalOccurrences) * 1_000_000;
    cpmMap.set(word, cpm);
  }

  return cpmMap;
}

function loadRealFrequenciesFr(): Map<string, number> {
  const cpmMap = new Map<string, number>();

  // 1. Load Lexique 3.83 (already counts per million)
  const lexiquePath = path.resolve('data/raw/Lexique383.tsv');
  if (fs.existsSync(lexiquePath)) {
    const lines = fs.readFileSync(lexiquePath, 'utf-8').split('\n');
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i]!.split('\t');
      const ortho = cols[0]?.trim();
      if (!ortho) continue;
      const fFilms = parseFloat(cols[8] || '0') || 0;
      const fLivres = parseFloat(cols[9] || '0') || 0;
      const freq = Math.max(fFilms, fLivres);
      const lower = ortho.toLowerCase();
      const existing = cpmMap.get(lower) || 0;
      if (freq > existing) cpmMap.set(lower, freq);
      if (lower.includes('oe') && !lower.includes('œ')) {
        const lig = lower.replace(/oe/g, 'œ');
        const exLig = cpmMap.get(lig) || 0;
        if (freq > exLig) cpmMap.set(lig, freq);
      }
    }
  }

  // 2. Load HermitDave French (normalized to counts per million)
  const hdPath = path.resolve('data/raw/fr_50k.txt');
  if (fs.existsSync(hdPath)) {
    const lines = fs.readFileSync(hdPath, 'utf-8').split('\n');
    let totalOccurrences = 0;
    const rawCounts = new Map<string, number>();

    for (const line of lines) {
      const parts = line.trim().split(' ');
      const word = parts[0]?.trim();
      const count = parseInt(parts[1] || '0', 10);
      if (word && count > 0) {
        rawCounts.set(word.toLowerCase(), count);
        totalOccurrences += count;
      }
    }

    if (totalOccurrences > 0) {
      for (const [word, count] of rawCounts) {
        const cpm = (count / totalOccurrences) * 1_000_000;
        const existing = cpmMap.get(word) || 0;
        if (cpm > existing) cpmMap.set(word, cpm);
      }
    }
  }

  return cpmMap;
}

const NOISE_FILTER_EN = new Set([
  'millenium', // Common misspelling for millennium
]);

const NOISE_FILTER_FR = new Set([
  'millenium', // Misspelling of millénium
  'jaime',     // Uncontracted j'aime
  'jetais',    // Uncontracted j'étais
  'dun',       // Uncontracted d'un
  'daccord',   // Uncontracted d'accord
  'dabord',    // Uncontracted d'abord
  'lecole',    // Uncontracted l'école
  'jusqua',    // Uncontracted jusqu'à
  'lhomme',    // Uncontracted l'homme
  'jattends',  // Uncontracted j'attends
  'mappelle',  // Uncontracted m'appelle
  'nest',      // Uncontracted n'est
]);

function loadLexiqueWords(speller?: { correct: (w: string) => boolean }): Set<string> {
  const words = new Set<string>();
  const lexiquePath = path.resolve('data/raw/Lexique383.tsv');
  if (fs.existsSync(lexiquePath)) {
    const lines = fs.readFileSync(lexiquePath, 'utf-8').split('\n');
    for (let i = 1; i < lines.length; i++) {
      const ortho = lines[i]!.split('\t')[0]?.trim();
      if (ortho && /^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]{2,25}$/.test(ortho)) {
        const lower = ortho.toLowerCase();
        if (NOISE_FILTER_FR.has(lower)) continue;
        if (speller && lower.includes('oe') && !lower.includes('œ')) {
          const withOe = lower.replace(/oe/g, 'œ');
          if (speller.correct(withOe)) {
            words.add(withOe);
            if (withOe.includes("'")) words.add(withOe.replace(/'/g, '’'));
            if (withOe.includes('’')) words.add(withOe.replace(/’/g, "'"));
            continue;
          }
        }
        words.add(lower);
        if (lower.includes("'")) words.add(lower.replace(/'/g, '’'));
        if (lower.includes('’')) words.add(lower.replace(/’/g, "'"));
      }
    }
  }
  return words;
}

const SUBJUNCTIVE_IMPERFECT_EXCEPTIONS = new Set([
  'fût', 'eût', 'plût', 'vît', 'sût', 'mît', 'prît', 'tînt', 'vînt', 'pût', 'dût'
]);

const HOMOGRAPH_REFORM_EXCEPTIONS = new Set([
  'dû', 'dûs', 'dûment',
  'mûr', 'mûre', 'mûrs', 'mûres', 'mûrement',
  'sûr', 'sûre', 'sûrs', 'sûres', 'sûreté', 'sûrement',
  'jeûne', 'jeûnes', 'jeûner', 'jeûneur',
  'croît', 'croître'
]);

/**
 * Identifies verified modern French orthographic-reform variants (Académie française, 1990).
 * Rule 4: Circumflex removed from i and u (except where distinguishing homographs).
 * Rule 2: Inverted accent in future/conditional for verbs in -é...er (préférerais -> préfèrerais).
 * Rule 3: Ligatures and loanword assimilated forms.
 */
export function identify1990ReformVariants(baseWords: Set<string>): Map<string, string> {
  const variants = new Map<string, string>();

  for (const word of baseWords) {
    const lower = word.toLowerCase();

    // 1. Circumflex on i and u (Règle 4: suppression de l'accent circonflexe sur i et u sauf homographes)
    if (/[îû]/.test(lower) && !SUBJUNCTIVE_IMPERFECT_EXCEPTIONS.has(lower) && !HOMOGRAPH_REFORM_EXCEPTIONS.has(lower)) {
      const simplified = lower.replace(/î/g, 'i').replace(/û/g, 'u');
      if (simplified !== lower && /^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]+$/.test(simplified)) {
        variants.set(simplified, lower);
      }
    }

    // 2. Inverted accent in future/conditional for verbs in -é...er (Règle 2)
    if (/é[a-z]{1,4}er(?:ai|as|a|ons|ez|ont|ais|ait|aient|ions|iez)/.test(lower)) {
      const inverted = lower.replace(/é([a-z]{1,4}er(?:ai|as|a|ons|ez|ont|ais|ait|aient|ions|iez).*)/, 'è$1');
      if (inverted !== lower && /^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]+$/.test(inverted)) {
        variants.set(inverted, lower);
      }
    }
    if (lower === 'événement') variants.set('évènement', lower);
    if (lower === 'événements') variants.set('évènements', lower);
    if (lower === 'allégrement') variants.set('allègrement', lower);

    // 3. Ensure ligatured forms (œ) are valid when unligatured exists
    if (lower.includes('oe') && !lower.includes('œ')) {
      variants.set(lower.replace(/oe/g, 'œ'), lower);
    }

    // 4. Common hyphenation / compound reform forms
    if (lower === 'week-end') variants.set('weekend', lower);
    if (lower === 'week-ends') variants.set('weekends', lower);
  }

  return variants;
}

interface CompiledLanguageData {
  words: string[];
  frequencies: Uint8Array;
  bloomFilter: Uint8Array;
  deleteHashes: Uint32Array;
  deleteWordIndices: Uint16Array;
  stringPool: Buffer;
  stringOffsets: Uint32Array;
}

function compileLanguage(lang: 'en' | 'fr', limit: number): CompiledLanguageData {
  console.log(`\nCompiling ${lang.toUpperCase()} Lexicon (Candidate Target: ${limit})...`);

  const speller = lang === 'en'
    ? nspell(dictionaryEn.aff, dictionaryEn.dic)
    : nspell(dictionaryFr.aff, dictionaryFr.dic);

  const rawDicWords = lang === 'en'
    ? parseHunspellDic(dictionaryEn.dic)
    : parseHunspellDic(dictionaryFr.dic);

  // 1. Extract ALL valid forms for complete validity (A2)
  const expandedKeys = Object.keys(speller.data);
  const validFormsSet = new Set<string>();
  const noiseFilter = lang === 'en' ? NOISE_FILTER_EN : NOISE_FILTER_FR;

  for (const k of expandedKeys) {
    if (k.length >= 2 && k.length <= 25 && /^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]+$/.test(k)) {
      const lower = k.toLowerCase();
      if (noiseFilter.has(lower)) continue;
      // In French, skip synthetic nspell elision combinations (3M+ duplicates)
      if (
        lang === 'fr' &&
        /^(l'|d'|qu'|j'|c'|m'|t'|s'|n'|l’|d’|qu’|j’|c’|m’|t’|s’|n’)/i.test(k) &&
        !["c'est", "c’est", "d'accord", "d’accord", "aujourd'hui", "aujourd’hui"].includes(k)
      ) {
        continue;
      }
      validFormsSet.add(lower);
      if (lower.includes("'")) validFormsSet.add(lower.replace(/'/g, '’'));
      if (lower.includes('’')) validFormsSet.add(lower.replace(/’/g, "'"));
    }
  }

  for (const rawW of rawDicWords) {
    const lower = rawW.toLowerCase();
    if (noiseFilter.has(lower)) continue;
    validFormsSet.add(lower);
    if (lower.includes("'")) validFormsSet.add(lower.replace(/'/g, '’'));
    if (lower.includes('’')) validFormsSet.add(lower.replace(/’/g, "'"));
  }

  // In French, add all Lexique words to validFormsSet
  if (lang === 'fr') {
    const lexiqueWords = loadLexiqueWords(speller);
    for (const w of lexiqueWords) {
      if (!noiseFilter.has(w)) {
        validFormsSet.add(w);
      }
    }

    // Add verified 1990 modern orthographic-reform variants (Académie française)
    const reformVariants = identify1990ReformVariants(validFormsSet);
    for (const [variant] of reformVariants) {
      if (!noiseFilter.has(variant)) {
        validFormsSet.add(variant);
      }
    }
  }

  console.log(`- Validity Set (Bloom filter): ${validFormsSet.size} forms (complete & independent of N)`);

  // Load real frequency corpora (A1)
  const realCpmMap = lang === 'en' ? loadRealFrequenciesEn() : loadRealFrequenciesFr();

  // 2. Score candidates by real frequency
  // Map words to quantized log-frequency: 1..255
  // score = min(255, max(1, round(log(cpm + 1) * 20)))
  const scoredCandidateMap = new Map<string, number>();

  for (const [word, cpm] of realCpmMap) {
    if (word.length < 2 || word.length > 25) continue;
    if (!/^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]+$/.test(word)) continue;
    if (noiseFilter.has(word)) continue;

    // Candidates MUST be valid forms (Hunspell-expanded or Lexique)
    if (!validFormsSet.has(word)) {
      continue;
    }

    const quantScore = Math.min(255, Math.max(1, Math.round(Math.log(cpm + 1) * 20) + 1));
    scoredCandidateMap.set(word, quantScore);
  }

  // 2b. English lemma propagation: base words in rawDicWords inherit frequency from inflections
  if (lang === 'en') {
    for (const rawW of rawDicWords) {
      const lower = rawW.toLowerCase();
      if (noiseFilter.has(lower) || !validFormsSet.has(lower)) continue;
      if (!scoredCandidateMap.has(lower)) {
        const inflections = [
          lower + 's',
          lower + 'es',
          lower + 'ed',
          lower + 'd',
          lower + 'ing',
          lower.slice(0, -1) + 'ing',
        ];
        let maxInflectScore = 0;
        for (const inf of inflections) {
          const s = scoredCandidateMap.get(inf) || 0;
          if (s > maxInflectScore) maxInflectScore = s;
        }
        if (maxInflectScore > 0) {
          scoredCandidateMap.set(lower, Math.max(28, maxInflectScore));
        }
      }
    }
  }

  // 2c. French adverb morphology propagation: regular -ment adverbs inherit from adjective base
  if (lang === 'fr') {
    for (const [word, score] of Array.from(scoredCandidateMap.entries())) {
      if (word.endsWith('ment') && word.length > 6) {
        const stem = word.slice(0, -4);
        const stemScore = scoredCandidateMap.get(stem) || scoredCandidateMap.get(stem + 'e') || 0;
        if (stemScore > score) {
          const boosted = Math.max(score, Math.round(stemScore * 0.75));
          scoredCandidateMap.set(word, boosted);
        }
      }
    }

    // 2d. French 1990 reform frequency propagation:
    // If a verified reform variant is not in the frequency corpus, inherit proportional frequency from traditional source
    const reformVariants = identify1990ReformVariants(validFormsSet);
    for (const [variant, traditional] of reformVariants) {
      if (!scoredCandidateMap.has(variant) && scoredCandidateMap.has(traditional)) {
        const tradScore = scoredCandidateMap.get(traditional)!;
        scoredCandidateMap.set(variant, Math.max(28, Math.round(tradScore * 0.85)));
      }
    }
  }

  // Ensure high-confidence valid forms have at least baseline frequency
  for (const w of validFormsSet) {
    if (!scoredCandidateMap.has(w)) {
      scoredCandidateMap.set(w, 2); // baseline frequency
    }
  }

  // Sort candidates by real frequency descending and take top N
  const sortedEntries = Array.from(scoredCandidateMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.min(limit, 65535)); // fit within uint16

  const words = sortedEntries.map((e) => e[0]);
  const frequencies = new Uint8Array(words.length);
  for (let i = 0; i < words.length; i++) {
    frequencies[i] = sortedEntries[i]![1];
  }

  console.log(`- Candidate Vocabulary: ${words.length} forms (top N by real frequency)`);

  // 3. Complete Validity Bloom Filter (A2)
  // EN: 2,500,000 bits (~312 KB), FR: 5,500,000 bits (~687 KB)
  const BLOOM_BITS = lang === 'en' ? 2500000 : 5500000;
  const bloomFilter = new Uint8Array(Math.ceil(BLOOM_BITS / 8));

  for (const validW of validFormsSet) {
    const bits = getBloomBitIndices(validW, BLOOM_BITS, 8);
    for (const bit of bits) {
      bloomFilter[bit >> 3]! |= (1 << (bit & 7));
    }
  }

  // 4. String Pool Packing
  const stringPoolBuffers: Buffer[] = [];
  const stringOffsets = new Uint32Array(words.length);
  let currentOffset = 0;

  for (let i = 0; i < words.length; i++) {
    stringOffsets[i] = currentOffset;
    const buf = Buffer.from(words[i]!, 'utf-8');
    stringPoolBuffers.push(buf);
    currentOffset += buf.length;
  }
  const stringPool = Buffer.concat(stringPoolBuffers);

  // 5. Symmetric Delete Index
  console.log(`- Generating symmetric delete index (prefix 6, d=1 for len 4, d=2 for len 5+)...`);
  const pairs: Array<{ hash: number; wordIdx: number }> = [];

  for (let wIdx = 0; wIdx < words.length; wIdx++) {
    const word = words[wIdx]!;
    const foldedWord = fold(word.toLowerCase());

    const dels = getDeletes(foldedWord, 6);
    dels.add(foldedWord.length > 6 ? foldedWord.slice(0, 6) : foldedWord);

    for (const del of dels) {
      pairs.push({ hash: hashString(del), wordIdx: wIdx });
    }
  }

  console.log(`- Sorting ${pairs.length} delete entries...`);
  pairs.sort((a, b) => a.hash - b.hash);

  const deleteHashes = new Uint32Array(pairs.length);
  const deleteWordIndices = new Uint16Array(pairs.length);

  for (let i = 0; i < pairs.length; i++) {
    deleteHashes[i] = pairs[i]!.hash;
    deleteWordIndices[i] = pairs[i]!.wordIdx;
  }

  return {
    words,
    frequencies,
    bloomFilter,
    deleteHashes,
    deleteWordIndices,
    stringPool,
    stringOffsets,
  };
}

function writeBinaryFile(filePath: string, data: CompiledLanguageData): { sizeBytes: number; breakdown: Record<string, number> } {
  const HEADER_SIZE = 64; // 16 uint32 fields
  const wordCount = data.words.length;
  if (FORMAT_VERSION === 2 && wordCount > 65535) {
    throw new Error(`wordCount ${wordCount} exceeds Uint16Array maximum 65535 for format version 2`);
  }
  const deleteCount = data.deleteHashes.length;
  const bloomBytes = data.bloomFilter.byteLength;
  const stringPoolBytes = data.stringPool.byteLength;

  function align4(n: number): number {
    return (n + 3) & ~3;
  }

  const bloomOffset = HEADER_SIZE;
  const stringOffsetsOffset = align4(bloomOffset + bloomBytes);
  const frequenciesOffset = align4(stringOffsetsOffset + wordCount * 4);
  const stringPoolOffset = align4(frequenciesOffset + wordCount);
  const deleteHashesOffset = align4(stringPoolOffset + stringPoolBytes);
  const deleteIndicesOffset = align4(deleteHashesOffset + deleteCount * 4);
  // Version 2 uses Uint16Array for deleteWordIndices (2 bytes per index)
  const totalFileSize = align4(deleteIndicesOffset + deleteCount * 2);

  const buffer = Buffer.alloc(totalFileSize);

  // Write Header
  let pos = 0;
  buffer.writeUInt32LE(MAGIC_NUMBER, pos); pos += 4;
  buffer.writeUInt32LE(FORMAT_VERSION, pos); pos += 4;
  buffer.writeUInt32LE(wordCount, pos); pos += 4;
  buffer.writeUInt32LE(deleteCount, pos); pos += 4;
  buffer.writeUInt32LE(bloomBytes, pos); pos += 4;
  buffer.writeUInt32LE(8, pos); pos += 4; // bloomK = 8
  buffer.writeUInt32LE(stringPoolBytes, pos); pos += 4;
  buffer.writeUInt32LE(bloomOffset, pos); pos += 4;
  buffer.writeUInt32LE(stringOffsetsOffset, pos); pos += 4;
  buffer.writeUInt32LE(frequenciesOffset, pos); pos += 4;
  buffer.writeUInt32LE(stringPoolOffset, pos); pos += 4;
  buffer.writeUInt32LE(deleteHashesOffset, pos); pos += 4;
  buffer.writeUInt32LE(deleteIndicesOffset, pos); pos += 4;

  // Write Sections
  Buffer.from(data.bloomFilter.buffer).copy(buffer, bloomOffset);
  Buffer.from(data.stringOffsets.buffer).copy(buffer, stringOffsetsOffset);
  Buffer.from(data.frequencies.buffer).copy(buffer, frequenciesOffset);
  data.stringPool.copy(buffer, stringPoolOffset);
  Buffer.from(data.deleteHashes.buffer).copy(buffer, deleteHashesOffset);
  Buffer.from(data.deleteWordIndices.buffer).copy(buffer, deleteIndicesOffset);

  fs.writeFileSync(filePath, buffer);
  const sizeMb = buffer.byteLength / (1024 * 1024);

  const breakdown = {
    header: HEADER_SIZE,
    bloomFilter: bloomBytes,
    stringOffsets: wordCount * 4,
    frequencies: wordCount,
    stringPool: stringPoolBytes,
    deleteHashes: deleteCount * 4,
    deleteWordIndices: deleteCount * 2,
    total: buffer.byteLength,
  };

  console.log(`Saved ${filePath}: ${sizeMb.toFixed(2)} MB (${buffer.byteLength} bytes)`);
  console.log(`  - Header: ${(breakdown.header / 1024).toFixed(1)} KB`);
  console.log(`  - Bloom Filter: ${(breakdown.bloomFilter / 1024).toFixed(1)} KB`);
  console.log(`  - Word Strings + Offsets: ${((breakdown.stringPool + breakdown.stringOffsets) / 1024).toFixed(1)} KB`);
  console.log(`  - Frequencies: ${(breakdown.frequencies / 1024).toFixed(1)} KB`);
  console.log(`  - Delete Hashes (uint32): ${(breakdown.deleteHashes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  - Delete Indices (uint16): ${(breakdown.deleteWordIndices / (1024 * 1024)).toFixed(2)} MB`);

  return { sizeBytes: buffer.byteLength, breakdown };
}

async function main() {
  console.log('=== Building Honest Bilingual Autocorrect Binary Data ===');
  console.log(`Candidate Limit per Language: ${CANDIDATE_LIMIT}`);

  const enData = compileLanguage('en', CANDIDATE_LIMIT);
  const enPath = path.join(OUT_DIR, 'en.bin');
  const enInfo = writeBinaryFile(enPath, enData);

  const frData = compileLanguage('fr', CANDIDATE_LIMIT);
  const frPath = path.join(OUT_DIR, 'fr.bin');
  const frInfo = writeBinaryFile(frPath, frData);

  const totalBytes = enInfo.sizeBytes + frInfo.sizeBytes;
  const totalMb = totalBytes / (1024 * 1024);

  // Compute checksums and write manifest.json
  const enBuffer = fs.readFileSync(enPath);
  const frBuffer = fs.readFileSync(frPath);

  const manifest = {
    version: FORMAT_VERSION,
    buildTime: new Date().toISOString(),
    candidateLimit: CANDIDATE_LIMIT,
    languages: {
      en: {
        file: 'en.bin',
        words: enData.words.length,
        deletes: enData.deleteHashes.length,
        bloomBits: enData.bloomFilter.byteLength * 8,
        bloomK: 8,
        bloomTargetFpr: 0.005,
        sizeBytes: enBuffer.byteLength,
        sha256: crypto.createHash('sha256').update(enBuffer).digest('hex'),
        license: 'MIT and BSD',
        breakdown: enInfo.breakdown,
      },
      fr: {
        file: 'fr.bin',
        words: frData.words.length,
        deletes: frData.deleteHashes.length,
        bloomBits: frData.bloomFilter.byteLength * 8,
        bloomK: 8,
        bloomTargetFpr: 0.005,
        sizeBytes: frBuffer.byteLength,
        sha256: crypto.createHash('sha256').update(frBuffer).digest('hex'),
        license: 'MPL-2.0 and CC-BY-SA-4.0',
        breakdown: frInfo.breakdown,
      },
    },
    totalSizeBytes: totalBytes,
    totalSizeMb: parseFloat(totalMb.toFixed(2)),
  };

  const manifestPath = path.join(OUT_DIR, 'dictionary-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nSaved ${manifestPath}`);
  console.log(`====================================================`);
  console.log(`TOTAL UNPACKED DICTIONARY SIZE: ${totalMb.toFixed(2)} MB (Target: <= 8.0 MB)`);
  console.log(`====================================================`);
}

main().catch(console.error);
