import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine.ts';

const enBuf = fs.readFileSync(path.resolve('public/dict/en.bin'));
const frBuf = fs.readFileSync(path.resolve('public/dict/fr.bin'));

const engine = createEngine({
  en: enBuf.buffer.slice(enBuf.byteOffset, enBuf.byteOffset + enBuf.byteLength),
  fr: frBuf.buffer.slice(frBuf.byteOffset, frBuf.byteOffset + frBuf.byteLength),
});

import { LanguageIndex, parseBinaryIndex } from '../engine/index.ts';

const enDict = new LanguageIndex(parseBinaryIndex(enBuf.buffer.slice(enBuf.byteOffset, enBuf.byteOffset + enBuf.byteLength)));
const frDict = new LanguageIndex(parseBinaryIndex(frBuf.buffer.slice(frBuf.byteOffset, frBuf.byteOffset + frBuf.byteLength)));

console.log('enDict has misspell:', enDict.isKnownWord('misspell'));
console.log('enDict lookup mispell:', enDict.lookupCandidates('mispell'));

console.log('frDict has intellectuellement:', frDict.isKnownWord('intellectuellement'));
console.log('frDict lookup intellectuelment:', frDict.lookupCandidates('intellectuelment'));

console.log('frDict has naturellement:', frDict.isKnownWord('naturellement'));
console.log('frDict lookup naturelment:', frDict.lookupCandidates('naturelment'));

console.log('frDict has souffrir:', frDict.isKnownWord('souffrir'));
console.log('frDict lookup soufrir:', frDict.lookupCandidates('soufrir'));

console.log('frDict has embarrasser:', frDict.isKnownWord('embarrasser'));
console.log('frDict lookup embarasser:', frDict.lookupCandidates('embarasser'));

