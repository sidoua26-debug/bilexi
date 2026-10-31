import fs from 'node:fs';
import { fold } from '../engine/normalize';

const data = JSON.parse(fs.readFileSync('evidence/v0.5.0/french-heldout-bad-replacements.json', 'utf8'));

interface CategorizedItem {
  id: string;
  original: string;
  noisy: string;
  rep: string;
  type: string;
  category: string;
  reason: string;
}

const categorized: CategorizedItem[] = [];

for (const d of data) {
  const orig = d.original;
  const noisy = d.noisy;
  const rep = d.replacement;
  const origFold = fold(orig.toLowerCase());
  const repFold = fold(rep.toLowerCase());

  let cat = '';

  // A. Apostrophe glyph discrepancy only (e.g. ’ vs ')
  if (orig.replace(/’/g, "'") === rep.replace(/’/g, "'")) {
    cat = 'A. Typographical Apostrophe Glyph Discrepancy';
  }
  // B. Mid-sentence Capitalized Proper Nouns / Names (TitleCase, non-initial)
  else if (/^[A-Z][a-z]+$/.test(noisy) && origFold !== repFold) {
    cat = 'B. Mid-Sentence Capitalized Proper Noun Overwrite';
  }
  // C. Curated Rule False Trigger (quelles -> qu'elles)
  else if (d.reason?.includes('Curated')) {
    cat = 'C. Curated Rule Semantic Collision';
  }
  // D. Broken / Spurious Elision Split (e.g. calm -> c'alm, cangé -> c'ange)
  else if (rep.includes("'") && !orig.includes("'") && !noisy.includes("'")) {
    cat = 'D. Spurious Elision Split on Non-Elided Words';
  }
  // E. Verbal & Grammatical Inflection Homophones / Suffix Ambiguity
  // (e.g. courrai -> couterai, avancions -> avançons, amenéé -> amenée, réglée -> règle, etc.)
  else if (
    (orig.length >= 5 && noisy.length >= 5) &&
    (
      orig.slice(0, 3) === rep.slice(0, 3) ||
      origFold === repFold
    )
  ) {
    cat = 'E. Grammatical & Morphological Suffix Ambiguity (Length >= 5)';
  }
  // F. Short Word Competitor (Length <= 4, dense Hamming/Levenshtein neighborhood)
  else if (orig.length <= 4 || noisy.length <= 4) {
    cat = 'F. Short Word Lexical Competitor (Length <= 4)';
  }
  // G. Other General Lexical Competitors
  else {
    cat = 'G. Other General Lexical Competitors';
  }

  categorized.push({
    id: d.sentenceId,
    original: orig,
    noisy: noisy,
    rep: rep,
    type: d.type,
    category: cat,
    reason: d.reason || '',
  });
}

const groups = new Map<string, CategorizedItem[]>();
for (const c of categorized) {
  if (!groups.has(c.category)) groups.set(c.category, []);
  groups.get(c.category)!.push(c);
}

const sorted = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);

console.log(`TOTAL FRENCH BAD REPLACEMENTS: ${categorized.length}\n`);

for (const [catName, items] of sorted) {
  const pct = ((items.length / categorized.length) * 100).toFixed(1);
  console.log(`================================================================`);
  console.log(`${catName}: ${items.length} (${pct}%)`);
  console.log(`================================================================`);
  console.log('Examples:');
  for (let i = 0; i < Math.min(5, items.length); i++) {
    const it = items[i]!;
    console.log(`  ${i + 1}. Sent #${it.id}: orig="${it.original}" (typo="${it.noisy}") -> rep="${it.rep}" [${it.type}]`);
  }
  console.log('');
}
