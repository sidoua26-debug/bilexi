import { describe, it, expect } from 'vitest';
import { loadCorpora, evaluateCorpus, DEFAULT_SEED, createMulberry32, getTokenSeed, injectTypoWithRng, type SentenceItem } from '../../scripts/lib/eval-harness';
import { createEngine } from '../engine';
import fs from 'node:fs';

describe('Order-Independent Typo Injector', () => {
  it('generates identical typo decisions and mutations regardless of corpus ordering', () => {
    const enBuf = fs.readFileSync('public/dict/en.bin');
    const frBuf = fs.readFileSync('public/dict/fr.bin');
    const ngBuf = fs.existsSync('public/dict/ngram.bin') ? fs.readFileSync('public/dict/ngram.bin') : undefined;

    const engine = createEngine(
      { en: enBuf, fr: frBuf, ngram: ngBuf },
      { languageMode: 'auto', sensitivity: 'balanced', layout: 'auto', sentenceCaps: true, fixLoneI: true }
    );

    const { dev } = loadCorpora('.');
    const sample20 = dev.slice(0, 20);

    // Context (a): 20 sentences alone
    const resA = evaluateCorpus(sample20, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

    // Context (b): 20 sentences shuffled amongst 100 sentences from dev
    const sample100 = dev.slice(0, 100);
    const rng = createMulberry32(12345);
    const shuffled100 = [...sample100];
    for (let i = shuffled100.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = shuffled100[i]!;
      shuffled100[i] = shuffled100[j]!;
      shuffled100[j] = tmp;
    }
    const resB = evaluateCorpus(shuffled100, engine, { langHintPolicy: 'production', seed: DEFAULT_SEED, collectDetails: true });

    // Helper to get detailed typo injections for a given set of sentences
    function getInjectionsForSentences(corpus: SentenceItem[], targetIds: Set<string>) {
      const injections: Record<string, Array<{ tokenIdx: number; original: string; noisy: string; type: string }>> = {};
      for (const item of corpus) {
        if (!targetIds.has(item.id)) continue;
        injections[item.id] = [];
        const rawTokens = item.text.replace(/[.,;!?()«»"“”[\]{}]/g, ' ').split(/\s+/).filter(Boolean);
        for (let tokenIdx = 0; tokenIdx < rawTokens.length; tokenIdx++) {
          const token = rawTokens[tokenIdx]!;
          if (token.length < 3) continue;
          const tokenSeed = getTokenSeed(item.id, tokenIdx, DEFAULT_SEED);
          const tokenRng = createMulberry32(tokenSeed);
          if (tokenRng() < 0.083) {
            const typo = injectTypoWithRng(token, item.lang === 'fr', tokenRng);
            if (typo) {
              injections[item.id]!.push({
                tokenIdx,
                original: token,
                noisy: typo.noisy,
                type: typo.type,
              });
            }
          }
        }
      }
      return injections;
    }

    const targetIds = new Set(sample20.map(s => s.id));
    const injectionsA = getInjectionsForSentences(sample20, targetIds);
    const injectionsB = getInjectionsForSentences(shuffled100, targetIds);
    const injectionsC = getInjectionsForSentences(dev, targetIds);

    // Exact equality of all 20 sentences' token positions, original words, noisy mutations, and types
    expect(injectionsA).toEqual(injectionsB);
    expect(injectionsA).toEqual(injectionsC);

    // Also verify bad replacement details that occurred on these 20 sentences in context A vs context B
    const badA = resA.badReplacementDetails.filter(d => targetIds.has(d.sentenceId));
    const badB = resB.badReplacementDetails.filter(d => targetIds.has(d.sentenceId));
    expect(badA).toEqual(badB);
  });
});
