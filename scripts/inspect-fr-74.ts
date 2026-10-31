import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('evidence/v0.5.0/french-heldout-bad-replacements.json', 'utf8'));
console.log(`Total items: ${data.length}\n`);

for (let i = 0; i < data.length; i++) {
  const d = data[i];
  console.log(`${(i+1).toString().padStart(2)}. Sent #${d.sentenceId}: orig="${d.original}" noisy="${d.noisy}" -> rep="${d.replacement}" [type=${d.type}, dist=${d.distance}] reason="${d.reason}"`);
}
