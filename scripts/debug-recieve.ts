import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/engine.ts';

const enBuf = fs.readFileSync(path.resolve('public/dict/en.bin'));
const frBuf = fs.readFileSync(path.resolve('public/dict/fr.bin'));

const engine = createEngine({
  en: enBuf.buffer.slice(enBuf.byteOffset, enBuf.byteOffset + enBuf.byteLength),
  fr: frBuf.buffer.slice(frBuf.byteOffset, frBuf.byteOffset + frBuf.byteLength),
});

console.log("suggest 'recieve':", engine.suggest({ token: 'recieve' }));
console.log("suggest 'RECIEVE':", engine.suggest({ token: 'RECIEVE' }));
console.log("analyze 'recieve':", engine.analyze({ token: 'recieve', boundary: ' ' }));
console.log("analyze 'RECIEVE':", engine.analyze({ token: 'RECIEVE', boundary: ' ' }));
