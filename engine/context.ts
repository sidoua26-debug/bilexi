/**
 * engine/context.ts
 * Compact, zero-dependency, binary-backed n-gram contextual scoring model.
 * Backed by sorted FNV-1a uint32 hash arrays with O(log N) binary search.
 */

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;

function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  const utf8 = textEncoder ? textEncoder.encode(str) : Buffer.from(str, 'utf-8');
  for (let i = 0; i < utf8.length; i++) {
    h = (Math.imul(h ^ utf8[i]!, 16777619) >>> 0);
  }
  return h;
}

export interface ContextModelViews {
  enCount: number;
  frCount: number;
  enHashes: Uint32Array;
  enWeights: Uint8Array;
  frHashes: Uint32Array;
  frWeights: Uint8Array;
}

export function parseContextModel(buffer: ArrayBuffer | Uint8Array): ContextModelViews {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let pos = 0;
  const magic = dataView.getUint32(pos, true); pos += 4;
  if (magic !== 0x4e47524d) {
    throw new Error(`Invalid context model format magic: 0x${magic.toString(16)}`);
  }
  const version = dataView.getUint32(pos, true); pos += 4;
  if (version !== 1) {
    throw new Error(`Unsupported context model version: ${version}`);
  }

  const enCount = dataView.getUint32(pos, true); pos += 4;
  const frCount = dataView.getUint32(pos, true); pos += 4;

  const baseOffset = bytes.byteOffset + pos;
  const rawBuf = bytes.buffer;

  const enHashes = new Uint32Array(rawBuf, baseOffset, enCount);
  const enWeights = new Uint8Array(rawBuf, baseOffset + enCount * 4, enCount);

  const frHashesOffset = baseOffset + enCount * 5;
  const frHashes = new Uint32Array(rawBuf, frHashesOffset, frCount);
  const frWeights = new Uint8Array(rawBuf, frHashesOffset + frCount * 4, frCount);

  return {
    enCount,
    frCount,
    enHashes,
    enWeights,
    frHashes,
    frWeights,
  };
}

export class ContextModel {
  private views: ContextModelViews | null = null;

  constructor(buffer?: ArrayBuffer | Uint8Array) {
    if (buffer) {
      this.load(buffer);
    }
  }

  load(buffer: ArrayBuffer | Uint8Array): void {
    try {
      this.views = parseContextModel(buffer);
    } catch (e) {
      console.warn('[ContextModel] Failed to parse binary model:', e);
      this.views = null;
    }
  }

  private binarySearch(hashes: Uint32Array, target: number): number {
    let low = 0;
    let high = hashes.length - 1;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      const val = hashes[mid]!;
      if (val === target) {
        return mid;
      } else if (val < target) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return -1;
  }

  /**
   * Returns a normalized contextual boost in range [0, 4.0]
   * based on the probability of (prevWord, candidateWord).
   */
  getBigramBoost(prevWord: string, candidate: string, lang: 'en' | 'fr'): number {
    if (!this.views) return 0;
    const cleanPrev = prevWord.toLowerCase().replace(/^[^\wàâäéèêëîïôöùûüçœæ'-]+|[^\wàâäéèêëîïôöùûüçœæ'-]+$/g, '');
    const cleanCand = candidate.toLowerCase().replace(/^[^\wàâäéèêëîïôöùûüçœæ'-]+|[^\wàâäéèêëîïôöùûüçœæ'-]+$/g, '');
    if (!cleanPrev || !cleanCand) return 0;

    const pairKey = `${cleanPrev} ${cleanCand}`;
    const hash = fnv1a32(pairKey);

    const isFr = lang === 'fr';
    const hashes = isFr ? this.views.frHashes : this.views.enHashes;
    const weights = isFr ? this.views.frWeights : this.views.enWeights;

    const idx = this.binarySearch(hashes, hash);
    if (idx === -1) return 0;

    const rawCount = weights[idx]!;
    // Logarithmic scale: 1 -> 0.6, 5 -> 1.5, 20 -> 2.5, 100+ -> 3.5
    return Math.min(Math.log2(rawCount + 1) * 0.75, 4.0);
  }
}
