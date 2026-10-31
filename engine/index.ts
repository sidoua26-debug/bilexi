/**
 * Binary Typed-Array Symmetric-Delete Index & Bloom Filter Loader
 */

import { hashString, fold } from './normalize';

export interface BinaryIndexViews {
  wordCount: number;
  deleteCount: number;
  bloomFilter: Uint8Array;
  bloomK: number;
  stringOffsets: Uint32Array;
  frequencies: Uint8Array;
  stringPool: Uint8Array;
  deleteHashes: Uint32Array;
  deleteWordIndices: Uint16Array | Uint32Array;
}

export function parseBinaryIndex(buffer: ArrayBuffer | Uint8Array): BinaryIndexViews {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let pos = 0;
  const magic = dataView.getUint32(pos, true); pos += 4;
  if (magic !== 0x55414942) {
    throw new Error(`Invalid binary dictionary format magic: 0x${magic.toString(16)}`);
  }

  const version = dataView.getUint32(pos, true); pos += 4;
  if (version !== 1 && version !== 2) {
    throw new Error(`Unsupported binary dictionary version: ${version}`);
  }

  const wordCount = dataView.getUint32(pos, true); pos += 4;
  const deleteCount = dataView.getUint32(pos, true); pos += 4;
  const bloomBytes = dataView.getUint32(pos, true); pos += 4;
  const bloomK = dataView.getUint32(pos, true); pos += 4;
  const stringPoolBytes = dataView.getUint32(pos, true); pos += 4;
  const bloomOffset = dataView.getUint32(pos, true); pos += 4;
  const stringOffsetsOffset = dataView.getUint32(pos, true); pos += 4;
  const frequenciesOffset = dataView.getUint32(pos, true); pos += 4;
  const stringPoolOffset = dataView.getUint32(pos, true); pos += 4;
  const deleteHashesOffset = dataView.getUint32(pos, true); pos += 4;
  const deleteIndicesOffset = dataView.getUint32(pos, true); pos += 4;

  const baseOffset = bytes.byteOffset;
  const rawBuf = bytes.buffer;

  const bloomFilter = new Uint8Array(rawBuf, baseOffset + bloomOffset, bloomBytes);
  const stringOffsets = new Uint32Array(rawBuf, baseOffset + stringOffsetsOffset, wordCount);
  const frequencies = new Uint8Array(rawBuf, baseOffset + frequenciesOffset, wordCount);
  const stringPool = new Uint8Array(rawBuf, baseOffset + stringPoolOffset, stringPoolBytes);
  const deleteHashes = new Uint32Array(rawBuf, baseOffset + deleteHashesOffset, deleteCount);
  if (version === 2 && wordCount > 65535) {
    throw new Error(`Invalid binary dictionary: wordCount ${wordCount} exceeds Uint16Array maximum (65535) for version 2`);
  }

  const deleteWordIndices =
    version === 2
      ? new Uint16Array(rawBuf, baseOffset + deleteIndicesOffset, deleteCount)
      : new Uint32Array(rawBuf, baseOffset + deleteIndicesOffset, deleteCount);

  return {
    wordCount,
    deleteCount,
    bloomFilter,
    bloomK: bloomK || 8,
    stringOffsets,
    frequencies,
    stringPool,
    deleteHashes,
    deleteWordIndices,
  };
}

const textDecoder = new TextDecoder('utf-8');

export class LanguageIndex {
  public views: BinaryIndexViews;
  private wordCache = new Map<number, string>();
  private wordSet: Set<string> | null = null;
  private bloomBits: number;

  constructor(views: BinaryIndexViews) {
    this.views = views;
    this.bloomBits = views.bloomFilter.byteLength * 8;
  }

  hasExactWord(word: string): boolean {
    if (!this.wordSet) {
      this.wordSet = new Set<string>();
      for (let i = 0; i < this.views.wordCount; i++) {
        this.wordSet.add(this.getWord(i).toLowerCase());
      }
    }
    const lower = word.toLowerCase();
    return this.wordSet.has(lower);
  }

  getWord(index: number): string {
    const cached = this.wordCache.get(index);
    if (cached !== undefined) return cached;

    const offset = this.views.stringOffsets[index]!;
    const nextOffset =
      index < this.views.wordCount - 1
        ? this.views.stringOffsets[index + 1]!
        : this.views.stringPool.byteLength;

    const wordBytes = this.views.stringPool.subarray(offset, nextOffset);
    const word = textDecoder.decode(wordBytes);
    this.wordCache.set(index, word);
    return word;
  }

  getFrequency(index: number): number {
    return this.views.frequencies[index]!;
  }

  private testBloom(str: string): boolean {
    const bitCount = this.bloomBits;
    const h1 = hashString(str);
    let h2 = h1 ^ (h1 >>> 16);
    h2 = Math.imul(h2, 0x85ebca6b);
    h2 = h2 ^ (h2 >>> 13);
    h2 = Math.imul(h2, 0xc2b2ae35);
    h2 = (h2 ^ (h2 >>> 16)) >>> 0;
    if (h2 === 0) h2 = 1;

    const bf = this.views.bloomFilter;
    const k = this.views.bloomK || 8;
    for (let i = 0; i < k; i++) {
      const bit = ((h1 + Math.imul(i, h2)) >>> 0) % bitCount;
      if ((bf[bit >> 3]! & (1 << (bit & 7))) === 0) return false;
    }

    return true;
  }

  /**
   * Fast Bloom filter test for valid known forms
   */
  isKnownWord(word: string): boolean {
    const lower = word.toLowerCase();
    if (this.testBloom(lower)) return true;
    if (lower.includes('’')) {
      return this.testBloom(lower.replace(/’/g, "'"));
    }
    if (lower.includes("'")) {
      return this.testBloom(lower.replace(/'/g, '’'));
    }
    return false;
  }

  /**
   * Lookup candidate words matching symmetric deletes
   */
  lookupCandidates(query: string): Array<{ word: string; frequency: number }> {
    const candidates = new Map<number, { word: string; frequency: number }>();
    const foldedQuery = fold(query.toLowerCase());

    // Generate deletes for query (prefix 6)
    const deletes = new Set<string>();
    const prefix = foldedQuery.length > 6 ? foldedQuery.slice(0, 6) : foldedQuery;
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
    deletes.add(prefix);

    const hashes = this.views.deleteHashes;
    const indices = this.views.deleteWordIndices;
    const len = hashes.length;

    for (const del of deletes) {
      const h = hashString(del);
      let low = 0;
      let high = len - 1;
      let matchIdx = -1;

      while (low <= high) {
        const mid = (low + high) >>> 1;
        const midVal = hashes[mid]!;
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
        let start = matchIdx;
        while (start > 0 && hashes[start - 1] === h) start--;
        let end = matchIdx;
        while (end < len - 1 && hashes[end + 1] === h) end++;

        for (let i = start; i <= end; i++) {
          const wIdx = indices[i]!;
          if (!candidates.has(wIdx)) {
            candidates.set(wIdx, {
              word: this.getWord(wIdx),
              frequency: this.getFrequency(wIdx),
            });
          }
        }
      }
    }

    return Array.from(candidates.values());
  }
}
