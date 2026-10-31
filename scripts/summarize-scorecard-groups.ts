import fs from 'node:fs';
import path from 'node:path';

const content = fs.readFileSync(path.resolve('docs/BENCHMARK-BLACKBOX.md'), 'utf-8');

interface CategorySummary {
  name: string;
  passed: number;
  total: number;
}

const summaries: CategorySummary[] = [];

for (const line of content.split('\n')) {
  const match = line.match(/^### (.*) \((\d+)\/(\d+) passed\)/);
  if (match) {
    summaries.push({
      name: match[1]!.trim(),
      passed: parseInt(match[2]!, 10),
      total: parseInt(match[3]!, 10),
    });
  }
}

console.log("=== SCORECARD BY GROUP ===");
let headlinePassed = 0;
let headlineTotal = 0;

for (const s of summaries) {
  const rate = ((s.passed / s.total) * 100).toFixed(1);
  console.log(`- ${s.name.padEnd(35)}: ${s.passed}/${s.total} (${rate}%)`);
  if (!s.name.includes('Stretch')) {
    headlinePassed += s.passed;
    headlineTotal += s.total;
  }
}

console.log("-------------------------------------------------------");
console.log(`Headline Total (excl. stretch): ${headlinePassed}/${headlineTotal} (${((headlinePassed/headlineTotal)*100).toFixed(1)}%)`);
console.log(`Overall Total (incl. stretch):  ${summaries.reduce((a,b)=>a+b.passed,0)}/${summaries.reduce((a,b)=>a+b.total,0)} (${((summaries.reduce((a,b)=>a+b.passed,0)/summaries.reduce((a,b)=>a+b.total,0))*100).toFixed(1)}%)`);
