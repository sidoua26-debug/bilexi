import fs from 'node:fs';
import path from 'node:path';

// Compute Damerau-Levenshtein distance (optimal string alignment or restricted edit distance)
function damerauLevenshtein(a: string, b: string): number {
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    d[i] = [];
    d[i][0] = i;
  }
  for (let j = 0; j <= b.length; j++) {
    d[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,      // deletion
        d[i][j - 1] + 1,      // insertion
        d[i - 1][j - 1] + cost // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return d[a.length][b.length];
}

function foldAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe').replace(/’/g, "'");
}

const goldenPath = path.resolve('e2e/golden/appendix-a.json');
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));

console.log(`Original Fixes EN: ${golden.fixesEn.length}`);
console.log(`Original Fixes FR: ${golden.fixesFr.length}`);
console.log(`Original Rules EN: ${golden.rulesEn.length}`);
console.log(`Original Must Stay: ${golden.mustStayUnchanged.length}`);

// Audit every fix in fixesEn and fixesFr
function auditList(list: any[], name: string) {
  console.log(`\n--- Auditing ${name} ---`);
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const typed = Array.isArray(item) ? item[0] : item.typed;
    const expected = Array.isArray(item) ? item[1] : item.expected;
    
    const foldedTyped = foldAccents(typed.toLowerCase());
    const foldedExpected = foldAccents(expected.toLowerCase());
    
    const dlRaw = damerauLevenshtein(typed, expected);
    const dlFolded = damerauLevenshtein(foldedTyped, foldedExpected);
    const isAccentOnly = dlFolded === 0 && dlRaw > 0;
    const isExact = typed === expected;

    if (isExact) {
      console.log(`[EXACT EQUAL] ${typed} === ${expected}`);
    } else if (dlFolded >= 3) {
      console.log(`[STRETCH (d>=3)] ${typed} -> ${expected} (dlRaw: ${dlRaw}, dlFolded: ${dlFolded})`);
    }
  }
}

auditList(golden.fixesEn, 'fixesEn');
auditList(golden.fixesFr, 'fixesFr');
