#!/usr/bin/env python3
"""
scripts/build-heldout-validation.py
Extracts 5,000 English and 5,000 French sentences from lines 200,000+
disjoint from:
1. Dev corpus (lines 0..14,529)
2. Pristine test set (lines 35,000..40,108)
3. Bigram training set (lines 45,000..195,000)
Verifies programmatically that overlap is 0.
"""

import bz2
import json
import os

def main():
    with open('data/raw/tatoeba-sentences.json', 'r', encoding='utf-8') as f:
        dev_data = json.load(f)
    dev_en_ids = set(dev_data['en'].keys())
    dev_fr_ids = set(dev_data['fr'].keys())

    with open('data/raw/pristine-test-sentences.json', 'r', encoding='utf-8') as f:
        test_data = json.load(f)
    test_en_ids = set(test_data['en'].keys())
    test_fr_ids = set(test_data['fr'].keys())

    all_excluded_en = dev_en_ids | test_en_ids
    all_excluded_fr = dev_fr_ids | test_fr_ids

    def extract_sentences(tsv_path, excluded_ids, start_line=200000, target_count=5000):
        results = {}
        with bz2.open(tsv_path, 'rt', encoding='utf-8') as f:
            for idx, line in enumerate(f):
                if idx < start_line:
                    continue
                parts = line.strip().split('\t')
                if len(parts) < 3:
                    continue
                sid, text = parts[0], parts[2]
                if sid in excluded_ids:
                    continue
                # Quality check: reasonable sentence length (4 to 20 words)
                words = text.split()
                if 4 <= len(words) <= 20:
                    results[sid] = text
                    if len(results) >= target_count:
                        break
        return results

    print('Extracting held-out validation sentences from lines 200,000+...')
    heldout_en = extract_sentences('data/raw/eng_sentences.tsv.bz2', all_excluded_en, start_line=200000, target_count=5000)
    heldout_fr = extract_sentences('data/raw/fra_sentences.tsv.bz2', all_excluded_fr, start_line=200000, target_count=5000)

    # Programmatic overlap verification
    overlap_dev_en = set(heldout_en.keys()) & dev_en_ids
    overlap_test_en = set(heldout_en.keys()) & test_en_ids
    overlap_dev_fr = set(heldout_fr.keys()) & dev_fr_ids
    overlap_test_fr = set(heldout_fr.keys()) & test_fr_ids

    print(f'EN sentences: {len(heldout_en)}, Overlap with Dev: {len(overlap_dev_en)}, Overlap with Pristine Test: {len(overlap_test_en)}')
    print(f'FR sentences: {len(heldout_fr)}, Overlap with Dev: {len(overlap_dev_fr)}, Overlap with Pristine Test: {len(overlap_test_fr)}')

    assert len(overlap_dev_en) == 0, 'EN overlap with dev must be 0'
    assert len(overlap_test_en) == 0, 'EN overlap with pristine test must be 0'
    assert len(overlap_dev_fr) == 0, 'FR overlap with dev must be 0'
    assert len(overlap_test_fr) == 0, 'FR overlap with pristine test must be 0'

    payload = {
        'description': 'Disjoint held-out validation corpus extracted from Tatoeba lines 200,000+',
        'en': heldout_en,
        'fr': heldout_fr,
    }

    out_file = 'data/raw/heldout-val-sentences.json'
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    sz = os.path.getsize(out_file)
    print(f'Wrote {out_file}: {sz} bytes ({sz/1024:.1f} KB)')

if __name__ == '__main__':
    main()
