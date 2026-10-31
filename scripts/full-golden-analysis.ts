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

function foldAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe').replace(/’/g, "'");
}

const goldenPath = path.resolve('e2e/golden/appendix-a.json');
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));

function analyze(list: [string, string][], name: string) {
  console.log(`\n================= ${name} (${list.length} cases) =================`);
  const seen = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const [typed, expected] = list[i];
    const key = `${typed} -> ${expected}`;
    const isDup = seen.has(key);
    seen.add(key);

    const fTyped = foldAccents(typed.toLowerCase());
    const fExpected = foldAccents(expected.toLowerCase());
    const dlRaw = damerauLevenshtein(typed, expected);
    const dlFolded = damerauLevenshtein(fTyped, fExpected);
    const isAccentOnly = dlFolded === 0 && dlRaw > 0;
    const isElision = expected.includes("'") || expected.includes("’");
    const isExact = typed === expected;

    let group = '';
    if (isExact) group = 'EXACT/MUST-STAY';
    else if (isAccentOnly) group = 'accent-only';
    else if (isElision) group = 'elision';
    else if (dlFolded === 1) group = 'distance-1';
    else if (dlFolded === 2) group = 'distance-2';
    else if (dlFolded >= 3) group = 'stretch';

    console.log(`${i+1}. [${typed}] -> [${expected}] | dlFolded: ${dlFolded}, dlRaw: ${dlRaw} | Group: ${group} ${isDup ? '(DUPLICATE)' : ''}`);
  }
}

analyze(golden.fixesEn, 'fixesEn');
analyze(golden.fixesFr, 'fixesFr');
