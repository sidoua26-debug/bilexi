import fs from 'node:fs';
import path from 'node:path';

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
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

const goldenPath = path.resolve('e2e/golden/appendix-a.json');
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));

for (const [t, e, m] of [...golden.fixesEn, ...golden.fixesFr]) {
  const dRaw = damerauLevenshtein(t, e);
  if (dRaw >= 3) {
    console.log(`dRaw >= 3: '${t}' -> '${e}' | dRaw: ${dRaw}, dFolded: ${m.dlFolded}`);
  }
}
