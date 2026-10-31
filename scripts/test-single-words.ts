import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine.ts';

const enBuf = fs.readFileSync(path.resolve('public/dict/en.bin'));
const frBuf = fs.readFileSync(path.resolve('public/dict/fr.bin'));

const engine = createEngine({
  en: enBuf.buffer.slice(enBuf.byteOffset, enBuf.byteOffset + enBuf.byteLength),
  fr: frBuf.buffer.slice(frBuf.byteOffset, frBuf.byteOffset + frBuf.byteLength),
});

const words = [
  // 6 failing EN:
  'mispell', 'rythm', 'millenium', 'independant', 'fourty', 'tendancy',
  // 11 failing FR:
  'jaime', 'jetais', 'dun', 'jusqua', 'apparaite', 'differament',
  'embarasser', 'developpent', 'soufrir', 'intellectuelment', 'naturelment'
];

for (const w of words) {
  const res = engine.analyze({
    token: w,
    triggerChar: ' ',
    isBoundaryTrigger: true,
  });
  const topSugg = engine.suggest({
    token: w,
    triggerChar: '',
    isBoundaryTrigger: false,
  });
  console.log(`Word: '${w}'`);
  console.log(`  Auto-replace: ${res.action !== 'none' ? `'${res.replacement}'` : 'NONE'} (reason: ${res.reason})`);
  console.log(`  Suggestions:  [${topSugg.join(', ')}]`);
}
