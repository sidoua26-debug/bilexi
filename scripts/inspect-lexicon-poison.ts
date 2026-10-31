import dictionaryEn from 'dictionary-en';
import dictionaryFr from 'dictionary-fr';
// @ts-expect-error
import nspell from 'nspell';
import fs from 'node:fs';
import path from 'node:path';

const spellerEn = nspell(dictionaryEn.aff, dictionaryEn.dic);
const spellerFr = nspell(dictionaryFr.aff, dictionaryFr.dic);

const wordsToCheck = ['millenium', 'jaime', 'jetais', 'dun', 'mispell', 'rythm', 'independant', 'fourty', 'tendancy', 'jusqua', 'apparaite', 'differament', 'embarasser', 'developpent', 'soufrir', 'intellectuelment', 'naturelment'];

console.log("=== CHECKING HUNSPELL & RAW DATA FOR POISON TOKENS ===");
for (const w of wordsToCheck) {
  console.log(`Token '${w}':`);
  console.log(`  Hunspell EN: ${spellerEn.correct(w)}`);
  console.log(`  Hunspell FR: ${spellerFr.correct(w)}`);
}

// Check where 'jaime', 'dun', 'millenium' come from in the raw corpora
const hdEn = fs.readFileSync('data/raw/en_50k.txt', 'utf-8');
const hdFr = fs.readFileSync('data/raw/fr_50k.txt', 'utf-8');
const lexique = fs.readFileSync('data/raw/Lexique383.tsv', 'utf-8');

console.log("\nCorpus occurrence checks:");
for (const w of ['millenium', 'jaime', 'jetais', 'dun']) {
  console.log(`- '${w}' in en_50k.txt: ${hdEn.includes('\n' + w + ' ')}`);
  console.log(`- '${w}' in fr_50k.txt: ${hdFr.includes('\n' + w + ' ')}`);
  console.log(`- '${w}' in Lexique383: ${lexique.includes('\n' + w + '\t')}`);
}
