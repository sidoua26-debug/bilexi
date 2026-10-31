import fs from 'fs';

const audit = JSON.parse(fs.readFileSync('docs/BASELINE-AUDIT.json', 'utf8'));
const bads = audit.sampleBadReplacements;

console.log('Total bad replacements sampled:', bads.length);

// Analyze patterns:
let apostropheInNoisy = 0;
let apostropheInTarget = 0;
let shortWordsLen3 = 0;
let shortWordsLen4 = 0;
let crossLang = 0;

for (const b of bads) {
  if (b.noisyToken.includes("'") || b.noisyToken.includes("’")) apostropheInNoisy++;
  if (b.targetToken.includes("'") || b.targetToken.includes("’")) apostropheInTarget++;
  if (b.noisyToken.length === 3) shortWordsLen3++;
  if (b.noisyToken.length === 4) shortWordsLen4++;
}

console.log('Apostrophe in noisy:', apostropheInNoisy);
console.log('Apostrophe in target:', apostropheInTarget);
console.log('Length 3 noisy:', shortWordsLen3);
console.log('Length 4 noisy:', shortWordsLen4);
