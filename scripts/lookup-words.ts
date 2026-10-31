import fs from 'node:fs';
import path from 'node:path';
import { LanguageIndex, parseBinaryIndex } from '../engine/index.ts';

const enBuf = fs.readFileSync(path.resolve('public/dict/en.bin'));
const frBuf = fs.readFileSync(path.resolve('public/dict/fr.bin'));

const enIndex = new LanguageIndex(parseBinaryIndex(enBuf.buffer.slice(enBuf.byteOffset, enBuf.byteOffset + enBuf.byteLength)));
const frIndex = new LanguageIndex(parseBinaryIndex(frBuf.buffer.slice(frBuf.byteOffset, frBuf.byteOffset + frBuf.byteLength)));

const words = ['millenium', 'jaime', 'jetais', 'dun', 'mispell', 'rythm', 'independant', 'fourty', 'tendancy', 'jusqua', 'apparaite', 'differament', 'embarasser', 'developpent', 'soufrir', 'intellectuelment', 'naturelment'];
for (const w of words) {
  console.log(`Word: '${w}' -> EN hasExact: ${enIndex.hasExactWord(w)}, FR hasExact: ${frIndex.hasExactWord(w)}`);
}
