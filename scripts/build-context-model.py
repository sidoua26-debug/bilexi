#!/usr/bin/env python3
"""
scripts/build-context-model.py
Extracts top n-grams from independent Tatoeba sentences (lines 45,000+)
with zero overlap with dev/eval or pristine held-out test sentences,
and compiles a binary lookup table (ngram.bin) within size budget.
"""

import bz2
import json
import os
import re
import struct
from collections import Counter

def main():
    with open('data/raw/tatoeba-sentences.json', 'r', encoding='utf-8') as f:
        eval_data = json.load(f)
    excluded_en = set(eval_data['en'].keys())
    excluded_fr = set(eval_data['fr'].keys())

    with open('data/raw/pristine-test-sentences.json', 'r', encoding='utf-8') as f:
        pristine_data = json.load(f)
    excluded_en |= set(pristine_data['en'].keys())
    excluded_fr |= set(pristine_data['fr'].keys())

    def train_ngram(tsv_path, excluded_ids, max_lines=150000):
        bigrams = Counter()
        processed = 0
        with bz2.open(tsv_path, 'rt', encoding='utf-8') as f:
            for idx, line in enumerate(f):
                if idx < 45000:
                    continue
                parts = line.strip().split('\t')
                if len(parts) < 3 or parts[0] in excluded_ids:
                    continue
                words = re.findall(r"[a-zA-Zàâäéèêëîïôöùûüçœæ'-]+", parts[2].lower())
                if len(words) < 2:
                    continue
                for i in range(len(words) - 1):
                    w1, w2 = words[i], words[i+1]
                    if len(w1) >= 2 and len(w2) >= 2:
                        bigrams[(w1, w2)] += 1
                processed += 1
                if processed >= max_lines:
                    break
        return bigrams

    print('Training bigrams on 150,000 EN and 150,000 FR sentences...')
    en_bi = train_ngram('data/raw/eng_sentences.tsv.bz2', excluded_en)
    fr_bi = train_ngram('data/raw/fra_sentences.tsv.bz2', excluded_fr)

    # K=8,000 per language produces 16,000 total bigrams = 80 KB binary, ensuring <= 8.0 MB budget with > 23KB headroom
    K = 8000
    en_top = dict(sorted([(k, v) for k, v in en_bi.items() if v >= 3], key=lambda x: -x[1])[:K])
    fr_top = dict(sorted([(k, v) for k, v in fr_bi.items() if v >= 3], key=lambda x: -x[1])[:K])

    def hash32(s):
        h = 2166136261
        for b in s.encode('utf-8'):
            h = (h ^ b) * 16777619 & 0xFFFFFFFF
        return h

    en_items = sorted([(hash32(' '.join(k)), min(v, 255)) for k, v in en_top.items()], key=lambda x: x[0])
    fr_items = sorted([(hash32(' '.join(k)), min(v, 255)) for k, v in fr_top.items()], key=lambda x: x[0])

    header = struct.pack('<IIII', 0x4E47524D, 1, len(en_items), len(fr_items))
    en_hashes = struct.pack(f'<{len(en_items)}I', *[x[0] for x in en_items])
    en_weights = struct.pack(f'<{len(en_items)}B', *[x[1] for x in en_items])
    fr_hashes = struct.pack(f'<{len(fr_items)}I', *[x[0] for x in fr_items])
    fr_weights = struct.pack(f'<{len(fr_items)}B', *[x[1] for x in fr_items])

    payload = header + en_hashes + en_weights + fr_hashes + fr_weights

    out_path = 'public/dict/ngram.bin'
    with open(out_path, 'wb') as f:
        f.write(payload)

    sz = os.path.getsize(out_path)
    print(f'Wrote {out_path}: {sz} bytes ({sz/1024:.1f} KB) with K={K} per language')

if __name__ == '__main__':
    main()
