/**
 * Benchmark 3 index structures on real EN/FR dictionary data:
 * 1. Custom Typed-Array Binary SymSpell (Hashed 32-bit deletes + typed arrays)
 * 2. In-Memory Map SymSpell (Standard JS Map<string, number[]>)
 * 3. Bounded Edit-Distance Trie
 */

import dictionaryEn from 'dictionary-en';
import dictionaryFr from 'dictionary-fr';

// --- Helper: Extract clean words from Hunspell .dic files ---
function extractWords(dicBuffer: Buffer | Uint8Array, maxCount = 60000): string[] {
  const content = Buffer.from(dicBuffer).toString('utf-8');
  const lines = content.split('\n');
  const wordSet = new Set<string>();

  for (let i = 1; i < lines.length && wordSet.size < maxCount; i++) {
    const raw = lines[i]?.trim();
    if (!raw) continue;
    // Strip Hunspell flags (e.g. "word/AB")
    const slashIdx = raw.indexOf('/');
    const word = (slashIdx >= 0 ? raw.slice(0, slashIdx) : raw).toLowerCase();
    // Keep clean alphabetic tokens of length 3..20
    if (/^[a-zàâäéèêëîïôöùûüçœæ'-]{3,20}$/.test(word)) {
      wordSet.add(word);
    }
  }
  return Array.from(wordSet);
}

// Simple FNV-1a 32-bit hash
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Generate symmetric deletes up to maxDistance (prefix 7)
function getDeletes(word: string, maxDistance = 2, prefixLength = 7): Set<string> {
  const deletes = new Set<string>();
  const prefix = word.length > prefixLength ? word.slice(0, prefixLength) : word;

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

// =========================================================================
// 1. Custom Typed-Array Binary SymSpell
// =========================================================================
class TypedArraySymSpell {
  public words: string[];
  public deleteHashes: Uint32Array; // sorted
  public wordIndices: Uint32Array; // matching entries

  constructor(words: string[]) {
    this.words = words;
    const pairs: Array<{ hash: number; wordIdx: number }> = [];

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const word = words[wIdx]!;
      const dels = getDeletes(word, 2, 7);
      for (const del of dels) {
        pairs.push({ hash: hashString(del), wordIdx: wIdx });
      }
    }

    // Sort by delete hash for binary search
    pairs.sort((a, b) => a.hash - b.hash);

    this.deleteHashes = new Uint32Array(pairs.length);
    this.wordIndices = new Uint32Array(pairs.length);
    for (let i = 0; i < pairs.length; i++) {
      this.deleteHashes[i] = pairs[i]!.hash;
      this.wordIndices[i] = pairs[i]!.wordIdx;
    }
  }

  lookup(query: string): string[] {
    const candidates = new Set<string>();
    const queryDeletes = getDeletes(query, 2, 7);
    queryDeletes.add(query.length > 7 ? query.slice(0, 7) : query);

    for (const del of queryDeletes) {
      const h = hashString(del);
      let low = 0;
      let high = this.deleteHashes.length - 1;
      let matchIdx = -1;

      while (low <= high) {
        const mid = (low + high) >>> 1;
        const midVal = this.deleteHashes[mid]!;
        if (midVal === h) {
          matchIdx = mid;
          break;
        } else if (midVal < h) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (matchIdx !== -1) {
        // Collect all matching identical hashes left and right
        let start = matchIdx;
        while (start > 0 && this.deleteHashes[start - 1] === h) start--;
        let end = matchIdx;
        while (end < this.deleteHashes.length - 1 && this.deleteHashes[end + 1] === h) end++;

        for (let i = start; i <= end; i++) {
          const w = this.words[this.wordIndices[i]!]!;
          candidates.add(w);
        }
      }
    }
    return Array.from(candidates);
  }
}

// =========================================================================
// 2. In-Memory Map SymSpell Baseline (mnemonist style)
// =========================================================================
class MapSymSpell {
  public words: string[];
  public deleteMap: Map<string, number[]>;

  constructor(words: string[]) {
    this.words = words;
    this.deleteMap = new Map();

    for (let wIdx = 0; wIdx < words.length; wIdx++) {
      const word = words[wIdx]!;
      const dels = getDeletes(word, 2, 7);
      for (const del of dels) {
        let list = this.deleteMap.get(del);
        if (!list) {
          list = [];
          this.deleteMap.set(del, list);
        }
        list.push(wIdx);
      }
    }
  }

  lookup(query: string): string[] {
    const candidates = new Set<string>();
    const queryDeletes = getDeletes(query, 2, 7);
    queryDeletes.add(query.length > 7 ? query.slice(0, 7) : query);

    for (const del of queryDeletes) {
      const list = this.deleteMap.get(del);
      if (list) {
        for (const idx of list) {
          candidates.add(this.words[idx]!);
        }
      }
    }
    return Array.from(candidates);
  }
}

// =========================================================================
// 3. Bounded Edit-Distance Trie
// =========================================================================
interface TrieNode {
  char?: string;
  word?: string;
  children: Map<string, TrieNode>;
}

class BoundedTrie {
  public root: TrieNode = { children: new Map() };

  constructor(words: string[]) {
    for (const word of words) {
      let node = this.root;
      for (const ch of word) {
        let child = node.children.get(ch);
        if (!child) {
          child = { char: ch, children: new Map() };
          node.children.set(ch, child);
        }
        node = child;
      }
      node.word = word;
    }
  }

  lookup(query: string, maxDist = 2): string[] {
    const results: string[] = [];
    const currentRow: number[] = [];
    for (let i = 0; i <= query.length; i++) currentRow[i] = i;

    for (const [ch, child] of this.root.children) {
      this.searchRecursive(child, ch, query, currentRow, results, maxDist);
    }
    return results;
  }

  private searchRecursive(
    node: TrieNode,
    ch: string,
    query: string,
    prevRow: number[],
    results: string[],
    maxDist: number
  ) {
    const columns = query.length + 1;
    const currentRow = [prevRow[0]! + 1];

    for (let c = 1; c < columns; c++) {
      const insertCost = currentRow[c - 1]! + 1;
      const deleteCost = prevRow[c]! + 1;
      const replaceCost = prevRow[c - 1]! + (query[c - 1] === ch ? 0 : 1);
      currentRow[c] = Math.min(insertCost, deleteCost, replaceCost);
    }

    if (currentRow[columns - 1]! <= maxDist && node.word) {
      results.push(node.word);
    }

    let minRowVal = Infinity;
    for (const val of currentRow) {
      if (val < minRowVal) minRowVal = val;
    }

    if (minRowVal <= maxDist) {
      for (const [nextCh, child] of node.children) {
        this.searchRecursive(child, nextCh, query, currentRow, results, maxDist);
      }
    }
  }
}

// =========================================================================
// Benchmark Runner
// =========================================================================
async function runSpikeBenchmark() {
  console.log('Loading real English and French dictionary corpora...');
  const enWords = extractWords(dictionaryEn.dic, 35000);
  const frWords = extractWords(dictionaryFr.dic, 35000);
  const combinedWords = Array.from(new Set([...enWords, ...frWords]));
  console.log(`Corpus size: ${combinedWords.length} words (EN: ${enWords.length}, FR: ${frWords.length})`);

  const testQueries = [
    'teh', 'recieve', 'seperate', 'occured', 'wierd', 'thier', 'becuase',
    'untill', 'freind', 'beleive', 'adress', 'accomodate', 'goverment',
    'tommorow', 'tje', 'ecole', 'tres', 'deja', 'apres', 'francais',
    'necessaire', 'oeuvre', 'coeur', 'bonjuor', 'beaucuop', 'cest', 'jai'
  ];

  const results: Array<{
    name: string;
    coldLoadMs: number;
    heapMb: number;
    p50Ms: number;
    p95Ms: number;
    sampleCandidates: number;
  }> = [];

  // Structure 1: Typed-Array SymSpell
  {
    if (global.gc) global.gc();
    const heapBefore = process.memoryUsage().heapUsed;
    const t0 = performance.now();
    const index = new TypedArraySymSpell(combinedWords);
    const coldLoadMs = performance.now() - t0;
    const heapAfter = process.memoryUsage().heapUsed;
    const heapMb = (heapAfter - heapBefore) / (1024 * 1024);

    // Warm up
    for (const q of testQueries) index.lookup(q);

    // Latency benchmark over 10,000 lookups
    const latencies: number[] = [];
    const count = 10000;
    let sampleCandidates = 0;
    for (let i = 0; i < count; i++) {
      const q = testQueries[i % testQueries.length]!;
      const q0 = performance.now();
      const res = index.lookup(q);
      latencies.push(performance.now() - q0);
      if (i < testQueries.length) sampleCandidates += res.length;
    }
    latencies.sort((a, b) => a - b);
    const p50Ms = latencies[Math.floor(count * 0.50)]!;
    const p95Ms = latencies[Math.floor(count * 0.95)]!;

    results.push({
      name: 'TypedArray SymSpell (Hashed)',
      coldLoadMs,
      heapMb: Math.max(0, heapMb),
      p50Ms,
      p95Ms,
      sampleCandidates: Math.round(sampleCandidates / testQueries.length),
    });
  }

  // Structure 2: Map SymSpell (Baseline)
  {
    if (global.gc) global.gc();
    const heapBefore = process.memoryUsage().heapUsed;
    const t0 = performance.now();
    const index = new MapSymSpell(combinedWords);
    const coldLoadMs = performance.now() - t0;
    const heapAfter = process.memoryUsage().heapUsed;
    const heapMb = (heapAfter - heapBefore) / (1024 * 1024);

    // Warm up
    for (const q of testQueries) index.lookup(q);

    const latencies: number[] = [];
    const count = 10000;
    let sampleCandidates = 0;
    for (let i = 0; i < count; i++) {
      const q = testQueries[i % testQueries.length]!;
      const q0 = performance.now();
      const res = index.lookup(q);
      latencies.push(performance.now() - q0);
      if (i < testQueries.length) sampleCandidates += res.length;
    }
    latencies.sort((a, b) => a - b);
    const p50Ms = latencies[Math.floor(count * 0.50)]!;
    const p95Ms = latencies[Math.floor(count * 0.95)]!;

    results.push({
      name: 'Map<string, number[]> SymSpell',
      coldLoadMs,
      heapMb: Math.max(0, heapMb),
      p50Ms,
      p95Ms,
      sampleCandidates: Math.round(sampleCandidates / testQueries.length),
    });
  }

  // Structure 3: Bounded Edit-Distance Trie
  {
    if (global.gc) global.gc();
    const heapBefore = process.memoryUsage().heapUsed;
    const t0 = performance.now();
    const index = new BoundedTrie(combinedWords);
    const coldLoadMs = performance.now() - t0;
    const heapAfter = process.memoryUsage().heapUsed;
    const heapMb = (heapAfter - heapBefore) / (1024 * 1024);

    // Warm up
    for (const q of testQueries) index.lookup(q);

    const latencies: number[] = [];
    const count = 1000; // Trie is slower, 1,000 runs gives accurate metric
    let sampleCandidates = 0;
    for (let i = 0; i < count; i++) {
      const q = testQueries[i % testQueries.length]!;
      const q0 = performance.now();
      const res = index.lookup(q, 2);
      latencies.push(performance.now() - q0);
      if (i < testQueries.length) sampleCandidates += res.length;
    }
    latencies.sort((a, b) => a - b);
    const p50Ms = latencies[Math.floor(count * 0.50)]!;
    const p95Ms = latencies[Math.floor(count * 0.95)]!;

    results.push({
      name: 'Bounded Edit-Distance Trie',
      coldLoadMs,
      heapMb: Math.max(0, heapMb),
      p50Ms,
      p95Ms,
      sampleCandidates: Math.round(sampleCandidates / testQueries.length),
    });
  }

  // Print results
  console.log('\n### Index Benchmark Results (Real EN+FR Dictionaries: ~60,000 words)\n');
  console.log('| Index Structure | Cold Load (ms) | Heap Delta (MB) | p50 Lookup (ms) | p95 Lookup (ms) | Avg Candidates |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- |');
  for (const r of results) {
    console.log(`| ${r.name} | ${r.coldLoadMs.toFixed(1)} ms | ${r.heapMb.toFixed(1)} MB | ${r.p50Ms.toFixed(3)} ms | ${r.p95Ms.toFixed(3)} ms | ${r.sampleCandidates} |`);
  }
}

runSpikeBenchmark().catch(console.error);
