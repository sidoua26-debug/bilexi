import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine';
import { hashString } from '../engine/normalize';

const enBinPath = path.resolve('public/dict/en.bin');
const frBinPath = path.resolve('public/dict/fr.bin');
const enBuf = fs.readFileSync(enBinPath);
const frBuf = fs.readFileSync(frBinPath);

const engine = createEngine(
  { en: enBuf, fr: frBuf },
  { languageMode: 'auto', sensitivity: 'balanced', layout: 'auto', sentenceCaps: true, fixLoneI: true }
);

const tatoebaRaw = JSON.parse(fs.readFileSync('data/raw/tatoeba-sentences.json', 'utf-8'));
const enTatoeba = Object.entries(tatoebaRaw.en as Record<string, string>);
const frTatoeba = Object.entries(tatoebaRaw.fr as Record<string, string>);

const devCorpus: Array<{ id: string; text: string; lang: 'en' | 'fr' }> = [];
for (const [id, text] of enTatoeba) {
  if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'en' });
}
for (const [id, text] of frTatoeba) {
  if (hashString(id) % 10 < 6) devCorpus.push({ id, text, lang: 'fr' });
}

const cleanFpCounts = new Map<string, { count: number; lang: string; replacement: string; example: string }>();

for (const item of devCorpus) {
  const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
  const leftContext: string[] = [];

  for (const rawToken of rawTokens) {
    if (rawToken.length < 2) continue;

    const decision = engine.analyze({
      token: rawToken,
      boundary: ' ',
      leftContext,
      langHint: item.lang,
    });

    if (decision.action === 'replace') {
      const rep = decision.replacement;
      if (rep.toLowerCase() !== rawToken.toLowerCase()) {
        const key = `${rawToken} -> ${rep}`;
        const existing = cleanFpCounts.get(key) || { count: 0, lang: item.lang, replacement: rep, example: item.text };
        existing.count++;
        cleanFpCounts.set(key, existing);
      }
    }

    leftContext.push(rawToken);
    if (leftContext.length > 8) leftContext.shift();
  }
}

const sorted = Array.from(cleanFpCounts.entries()).sort((a, b) => b[1].count - a[1].count);

console.log('Top 60 Clean False Positives on Dev Split:');
for (let i = 0; i < Math.min(60, sorted.length); i++) {
  const [k, v] = sorted[i]!;
  console.log(`${(i + 1).toString().padStart(2)}. [${v.lang.toUpperCase()}] ${k.padEnd(30)} (x${v.count}) | e.g. "${v.example.slice(0, 60)}"`);
}
