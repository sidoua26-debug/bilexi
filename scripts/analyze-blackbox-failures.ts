import fs from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve('docs/BENCHMARK-BLACKBOX.md');
const content = fs.readFileSync(reportPath, 'utf-8');

interface Row {
  scenario: string;
  surface: string;
  expected: string;
  actual: string;
  status: string;
  category: string;
}

const rows: Row[] = [];
let currentCategory = '';

for (const line of content.split('\n')) {
  if (line.startsWith('### ')) {
    currentCategory = line.replace('### ', '').trim();
    continue;
  }
  if (line.startsWith('| `')) {
    const parts = line.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 5) {
      rows.push({
        scenario: parts[0].replace(/`/g, ''),
        surface: parts[1],
        expected: parts[2].replace(/`/g, ''),
        actual: parts[3].replace(/`/g, ''),
        status: parts[4],
        category: currentCategory,
      });
    }
  }
}

const failures = rows.filter(r => r.status.includes('FAIL'));
console.log(`Total Failing Scenarios: ${failures.length}`);

// Group pairs (textarea + contenteditable)
const pairMap = new Map<string, Row[]>();
for (const f of failures) {
  const key = `${f.category} :: ${f.scenario} :: exp "${f.expected}" :: act "${f.actual}"`;
  if (!pairMap.has(key)) pairMap.set(key, []);
  pairMap.get(key)!.push(f);
}

console.log(`\nUnique failing cases (${pairMap.size}):\n`);
for (const [key, list] of pairMap) {
  const surfaces = list.map(l => l.surface).join(', ');
  console.log(`- [${list[0].category}] ${list[0].scenario} (Expected: "${list[0].expected}", Got: "${list[0].actual}") on [${surfaces}]`);
}
