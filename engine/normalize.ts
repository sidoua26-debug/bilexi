/**
 * Unicode normalization and accent folding
 */

export function normalize(str: string): string {
  return str.normalize('NFC');
}

/**
 * fold(): NFD minus marks, œ→oe, æ→ae, ß→ss, ’→'
 */
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

/**
 * FNV-1a 32-bit hash for fast integer keys
 */
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
