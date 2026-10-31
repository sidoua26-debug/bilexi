/**
 * Data Fetch & Integrity Verification Script: scripts/fetch-data.ts
 * Downloads pinned external corpora, verifies SHA256 checksums, and manages data/raw cache
 * Usage: pnpm tsx scripts/fetch-data.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const RAW_DIR = path.resolve('data/raw');
fs.mkdirSync(RAW_DIR, { recursive: true });

interface ResourceSource {
  name: string;
  url: string;
  sha256: string;
  targetFile: string;
}

const RESOURCES: ResourceSource[] = [
  {
    name: 'HermitDave English Frequency (50k)',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
    sha256: '5351ff405b1126ef555791dd4d9798a48e3e9a501a9fc481a9da957752cfb458',
    targetFile: path.join(RAW_DIR, 'en_50k.txt'),
  },
  {
    name: 'HermitDave French Frequency (50k)',
    url: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt',
    sha256: 'f81f7c570b6433764da99aa30f4dfb08d81c5926301377b709af23a13b1f9596',
    targetFile: path.join(RAW_DIR, 'fr_50k.txt'),
  },
  {
    name: 'Lexique 3.83 (French Database)',
    url: 'https://www.lexique.org/databases/Lexique383/Lexique383.zip',
    sha256: 'e181d132b3b0d3d87efc98d376968441b517353933011cebea5366321a6024e6',
    targetFile: path.join(RAW_DIR, 'Lexique383.zip'),
  },
  {
    name: 'Tatoeba English Sentences',
    url: 'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
    sha256: '0eabb52f54350bbb39807190920bfddaf9fee2ba50ca75af67e11a22ec475c29',
    targetFile: path.join(RAW_DIR, 'eng_sentences.tsv.bz2'),
  },
  {
    name: 'Tatoeba French Sentences',
    url: 'https://downloads.tatoeba.org/exports/per_language/fra/fra_sentences.tsv.bz2',
    sha256: 'fac31d82b216c95affee7dffcee6c0ae59c45f254ebbfbbf8abb9e66da86ee8f',
    targetFile: path.join(RAW_DIR, 'fra_sentences.tsv.bz2'),
  },
];

function verifyChecksum(filePath: string, expectedHash: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const buffer = fs.readFileSync(filePath);
  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');
  return actualHash === expectedHash;
}

function downloadFile(url: string, targetPath: string): void {
  console.log(`Downloading: ${url} -> ${targetPath}`);
  execSync(`curl -s -L "${url}" -o "${targetPath}"`, { stdio: 'inherit' });
}

async function main() {
  console.log('=== Fetching & Verifying External Data Corpora ===');

  for (const res of RESOURCES) {
    if (verifyChecksum(res.targetFile, res.sha256)) {
      console.log(`[Cache Hit] ${res.name} (SHA256 verified)`);
    } else {
      console.log(`[Fetching] ${res.name}...`);
      downloadFile(res.url, res.targetFile);
      if (!verifyChecksum(res.targetFile, res.sha256)) {
        throw new Error(`Checksum mismatch for ${res.name} at ${res.targetFile}`);
      }
      console.log(`[OK] ${res.name} downloaded & verified.`);
    }
  }

  // 1. Unpack Lexique383.tsv if not present
  const lexiqueTsv = path.join(RAW_DIR, 'Lexique383.tsv');
  if (!fs.existsSync(lexiqueTsv)) {
    console.log('[Unpack] Extracting Lexique383.tsv from Lexique383.zip...');
    execSync(`unzip -p "${path.join(RAW_DIR, 'Lexique383.zip')}" Lexique383.tsv > "${lexiqueTsv}"`);
    console.log('[Unpack] Lexique383.tsv extracted.');
  }

  // 2. Extract Tatoeba Sentences & generate data/tatoeba-ids.json
  const tatoebaSentencesCache = path.join(RAW_DIR, 'tatoeba-sentences.json');
  const tatoebaIdsFile = path.resolve('data/tatoeba-ids.json');
  fs.mkdirSync(path.resolve('data'), { recursive: true });

  if (!fs.existsSync(tatoebaSentencesCache) || !fs.existsSync(tatoebaIdsFile)) {
    console.log('[Tatoeba] Processing sentences for benchmarks (min 100k tokens, 5k distinct per language)...');

    const extractTatoeba = (bz2Path: string): { ids: number[]; sentences: Record<number, string> } => {
      const output = execSync(`bzcat "${bz2Path}" | head -n 35000`, { encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 });
      const lines = output.split('\n');
      const ids: number[] = [];
      const sentences: Record<number, string> = {};
      const tokensSet = new Set<string>();
      let totalTokens = 0;

      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split('\t');
        const id = parseInt(parts[0]!, 10);
        const text = parts[2]?.trim();
        if (!id || !text) continue;

        // Clean tokenization test
        const words = text.toLowerCase().match(/[a-zA-Zàâäéèêëîïôöùûüçœæ'-]+/g) || [];
        if (words.length < 3) continue;

        ids.push(id);
        sentences[id] = text;
        totalTokens += words.length;
        for (const w of words) tokensSet.add(w);

        if (totalTokens >= 110000 && tokensSet.size >= 5500) {
          break;
        }
      }

      console.log(`- Extracted ${ids.length} sentences: ${totalTokens} tokens, ${tokensSet.size} distinct.`);
      return { ids, sentences };
    }

    console.log('Extracting Tatoeba English...');
    const enData = extractTatoeba(path.join(RAW_DIR, 'eng_sentences.tsv.bz2'));

    console.log('Extracting Tatoeba French...');
    const frData = extractTatoeba(path.join(RAW_DIR, 'fra_sentences.tsv.bz2'));

    // Commit only IDs to data/tatoeba-ids.json
    const idsPayload = {
      version: 1,
      timestamp: new Date().toISOString(),
      en: enData.ids,
      fr: frData.ids,
    };
    fs.writeFileSync(tatoebaIdsFile, JSON.stringify(idsPayload, null, 2), 'utf-8');
    console.log(`Saved Tatoeba IDs to: ${tatoebaIdsFile}`);

    // Cache actual sentences in data/raw
    const sentencesPayload = {
      en: enData.sentences,
      fr: frData.sentences,
    };
    fs.writeFileSync(tatoebaSentencesCache, JSON.stringify(sentencesPayload), 'utf-8');
    console.log(`Cached Tatoeba sentences in: ${tatoebaSentencesCache}`);
  } else {
    console.log('[Cache Hit] Tatoeba sentences and IDs already extracted.');
  }

  console.log('=== All raw corpora successfully fetched and cached. ===');
}

main().catch((err) => {
  console.error('fetch-data failed:', err);
  process.exit(1);
});
