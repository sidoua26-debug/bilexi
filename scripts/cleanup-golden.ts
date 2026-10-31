import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

function normalizeApos(str: string): string {
  return str.replace(/’/g, "'");
}

const goldenPath = path.resolve('e2e/golden/appendix-a.json');
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8'));

interface Meta {
  dlRaw: number;
  dlFolded: number;
  group: 'accent-only' | 'distance-1' | 'distance-2' | 'stretch' | 'elision';
}

const stretchCases: Array<[string, string, Meta]> = [];
const removals: Array<{ token: string; reason: string }> = [];

function processFixes(fixes: any[], lang: 'en' | 'fr'): Array<[string, string, Meta]> {
  const result: Array<[string, string, Meta]> = [];
  const seen = new Set<string>();

  for (const item of fixes) {
    const rawTyped = Array.isArray(item) ? item[0] : item.typed;
    const rawExpected = Array.isArray(item) ? item[1] : item.expected;
    const typed = normalizeApos(rawTyped);
    const expected = normalizeApos(rawExpected);

    // 1. Remove/relabel identical cases
    if (typed === expected) {
      removals.push({ token: typed, reason: `Identical typed and expected ('${typed}' === '${expected}'). Relocated to mustStayUnchanged.` });
      if (!golden.mustStayUnchanged.includes(typed)) {
        golden.mustStayUnchanged.push(typed);
      }
      continue;
    }

    // 2. Remove duplicates
    const key = `${typed}->${expected}`;
    if (seen.has(key)) {
      removals.push({ token: typed, reason: `Duplicate scenario '${key}' removed.` });
      continue;
    }
    seen.add(key);

    const fTyped = foldAccents(typed.toLowerCase());
    const fExpected = foldAccents(expected.toLowerCase());
    const dlRaw = damerauLevenshtein(typed, expected);
    const dlFolded = damerauLevenshtein(fTyped, fExpected);

    let group: 'accent-only' | 'distance-1' | 'distance-2' | 'stretch' | 'elision';
    if (dlRaw >= 3) {
      group = 'stretch';
    } else if (expected.includes("'")) {
      group = 'elision';
    } else if (dlFolded === 0 && dlRaw > 0) {
      group = 'accent-only';
    } else if (dlFolded === 1) {
      group = 'distance-1';
    } else if (dlFolded === 2) {
      group = 'distance-2';
    } else {
      group = 'stretch';
    }

    const meta: Meta = { dlRaw, dlFolded, group };

    if (group === 'stretch') {
      stretchCases.push([typed, expected, meta]);
      removals.push({ token: typed, reason: `True distance ${dlRaw} >= 3 (folded: ${dlFolded}). Reclassified to separate stretch group.` });
      continue;
    }

    result.push([typed, expected, meta]);
  }

  return result;
}

const cleanedFixesEn = processFixes(golden.fixesEn, 'en');
const cleanedFixesFr = processFixes(golden.fixesFr, 'fr');

// Ensure straight apostrophes in rulesEn and mixed
golden.rulesEn = golden.rulesEn.map(([t, e]: [string, string]) => [normalizeApos(t), normalizeApos(e)]);
golden.mixed = golden.mixed.map((m: any) => ({ ...m, typed: normalizeApos(m.typed), expected: normalizeApos(m.expected) }));

// Deduplicate mustStayUnchanged
const uniqueMustStay: string[] = [];
const seenStay = new Set<string>();
for (const w of golden.mustStayUnchanged) {
  const norm = normalizeApos(w);
  if (!seenStay.has(norm)) {
    seenStay.add(norm);
    uniqueMustStay.push(norm);
  }
}
golden.mustStayUnchanged = uniqueMustStay;

// Add stretchCases to golden file
const newGolden = {
  description: "Verbatim Appendix A Golden Scenarios from docs/SPEC.md (T2 Owner-Authorised Cleanup)",
  version: 4,
  fixesEn: cleanedFixesEn,
  fixesFr: cleanedFixesFr,
  stretchCases,
  rulesEn: golden.rulesEn,
  mixed: golden.mixed,
  mustStayUnchanged: golden.mustStayUnchanged,
  behaviours: golden.behaviours,
  ineligible: golden.ineligible,
};

fs.writeFileSync(goldenPath, JSON.stringify(newGolden, null, 2) + '\n', 'utf-8');

const hash = crypto.createHash('sha256').update(fs.readFileSync(goldenPath)).digest('hex');

console.log('=== CLEANUP REPORT ===');
console.log(`Removals / Reclassifications (${removals.length}):`);
for (const r of removals) {
  console.log(`- ${r.token}: ${r.reason}`);
}
console.log(`\nNew Counts:`);
console.log(`- fixesEn: ${cleanedFixesEn.length}`);
console.log(`- fixesFr: ${cleanedFixesFr.length}`);
console.log(`- stretchCases: ${stretchCases.length}`);
console.log(`- mustStayUnchanged: ${golden.mustStayUnchanged.length}`);
console.log(`- New Golden SHA-256: ${hash}`);
