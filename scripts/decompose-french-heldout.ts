import fs from 'node:fs';
import { createEngine } from '../engine/engine';
import {
  loadCorpora,
  evaluateCorpus,
  DEFAULT_SEED,
  type BadReplacementDetail,
} from './lib/eval-harness';
import { fold } from '../engine/normalize';

async function main() {
  const enBuf = fs.readFileSync('public/dict/en.bin');
  const frBuf = fs.readFileSync('public/dict/fr.bin');
  const ngBuf = fs.readFileSync('public/dict/ngram.bin');

  const { test } = loadCorpora('.');
  const engine = createEngine({ en: enBuf, fr: frBuf, ngram: ngBuf });

  console.log(`Evaluating Held-Out Test Split (${test.length} sentences)...`);
  const testRes = evaluateCorpus(test, engine, {
    langHintPolicy: 'production',
    seed: DEFAULT_SEED,
    collectDetails: true,
  });

  console.log(`Held-Out Test Results:`);
  console.log(`- Total Replacements: ${testRes.overall.replacements}`);
  console.log(`- French Replacements: ${testRes.fr.replacements}`);
  console.log(`- French True Positives: ${testRes.fr.truePositives}`);
  console.log(`- French Bad Replacements: ${testRes.fr.badReplacements}`);
  console.log(`- French Precision: ${testRes.fr.appliedPrecision.toFixed(2)}%\n`);

  const frBad = (testRes.badReplacementDetails || []).filter(d => d.lang === 'fr');
  console.log(`Total French bad replacement details collected: ${frBad.length}\n`);

  fs.writeFileSync('evidence/v0.5.0/french-heldout-bad-replacements.json', JSON.stringify(frBad, null, 2));

  // Analyze and categorize every single bad replacement
  interface CategorizedItem {
    item: BadReplacementDetail;
    category: string;
    subreason: string;
  }

  const categorized: CategorizedItem[] = [];

  for (const b of frBad) {
    const orig = b.original;
    const noisy = b.noisy;
    const rep = b.replacement;
    const origFold = fold(orig.toLowerCase());
    const repFold = fold(rep.toLowerCase());
    const noisyFold = fold(noisy.toLowerCase());

    let category = 'other';
    let subreason = '';

    // 1. Accent / Diacritic difference only (e.g. rep and orig differ only by diacritic on same stem)
    // e.g. "a" -> "à", "cote" -> "côte", "du" -> "dû", "sur" -> "sûr", "la" -> "là"
    if (origFold === repFold) {
      category = '1. Accentuation / Homograph Disambiguation';
      subreason = `Orig and rep differ only by accent/diacritic (${orig} vs ${rep})`;
    }
    // 2. Elision / Apostrophe issues (e.g. j' -> j, l' -> l, d' -> d, or apostrophe format ' vs ’)
    else if (orig.includes("'") || orig.includes('’') || rep.includes("'") || rep.includes('’') || noisy.includes("'") || noisy.includes('’')) {
      category = '2. Elision & Apostrophe Boundary';
      subreason = `Apostrophe or elision split mismatch (${orig} -> ${noisy} -> ${rep})`;
    }
    // 3. Inflection / Verb Conjugation / Grammatical Agreement Collision
    // (e.g. -er/-ez/-é/-ais/-ait, singular vs plural -s/-x, -e/-es)
    else if (
      (orig.slice(0, 3) === rep.slice(0, 3) && orig.length >= 4 && rep.length >= 4) &&
      (
        /(er|ez|é|és|ée|ées|ais|ait|aient|ant)$/i.test(orig) ||
        /(er|ez|é|és|ée|ées|ais|ait|aient|ant)$/i.test(rep) ||
        orig.endsWith('s') !== rep.endsWith('s') ||
        orig.endsWith('e') !== rep.endsWith('e')
      )
    ) {
      category = '3. Morphological Inflection & Suffix Ambiguity';
      subreason = `Same root stem, differing grammatical inflection/ending (${orig} vs ${rep})`;
    }
    // 4. Short Word / Dense Lexicon Collision (Length <= 4, distance 1 to multiple valid words)
    else if (orig.length <= 4 || noisy.length <= 4) {
      category = '4. Short Word / Dense Lexicon Competitor';
      subreason = `Short token (len <= 4) with competing 1-edit dictionary words (${orig} vs ${rep})`;
    }
    // 5. Cross-Lingual Intrusion (English word selected in French text)
    else if (b.reason?.includes('English') || /[a-z]/i.test(rep)) {
      category = '5. Lexical Competition (Len >= 5 Competitor)';
      subreason = `Different word selected at distance 1 (${orig} vs ${rep})`;
    }

    categorized.push({ item: b, category, subreason });
  }

  // Group by category
  const groups = new Map<string, CategorizedItem[]>();
  for (const c of categorized) {
    if (!groups.has(c.category)) groups.set(c.category, []);
    groups.get(c.category)!.push(c);
  }

  console.log('========================================================================');
  console.log('         FRENCH HELDOUT BAD REPLACEMENTS DECOMPOSITION (~77 items)      ');
  console.log('========================================================================\n');

  const sortedGroups = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);

  for (const [catName, items] of sortedGroups) {
    const pct = ((items.length / frBad.length) * 100).toFixed(1);
    console.log(`### Category: ${catName}`);
    console.log(`Count: ${items.length} (${pct}% of all ${frBad.length} French errors)`);
    console.log('5 Concrete Examples:');
    for (let i = 0; i < Math.min(5, items.length); i++) {
      const it = items[i]!.item;
      console.log(`  ${i + 1}. Sent #${it.sentenceId}: original="${it.original}" (typo="${it.noisy}") => rep="${it.replacement}" [type=${it.type}]`);
    }
    console.log('');
  }
}

main().catch(console.error);
