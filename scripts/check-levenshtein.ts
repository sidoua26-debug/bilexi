import fs from 'node:fs';
import path from 'node:path';

// Standard Levenshtein (insert, delete, substitute)
function levenshtein(a: string, b: string): number {
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    d[i] = [i];
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
    }
  }
  return d[a.length][b.length];
}

const pairs = [
  ['developpent', 'développement'],
  ['differament', 'différemment'],
  ['intellectuelment', 'intellectuellement'],
  ['naturelment', 'naturellement'],
  ['courageuxment', 'courageusement'],
  ['malheureusment', 'malheureusement'],
  ['particulierment', 'particulièrement'],
  ['vraisemblablment', 'vraisemblablement']
];

for (const [t, e] of pairs) {
  const fT = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const fE = e.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  console.log(`'${t}' -> '${e}' | lev(raw): ${levenshtein(t, e)}, lev(folded): ${levenshtein(fT, fE)}`);
}
