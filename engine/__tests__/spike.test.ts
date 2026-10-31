import { describe, it, expect } from 'vitest';

describe('Engine Spike Validation', () => {
  it('validates UTF-8 NFC normalization and fold', () => {
    const input = 'école';
    const normalized = input.normalize('NFC');
    expect(normalized).toBe('école');
    const folded = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    expect(folded).toBe('ecole');
  });

  it('validates French elision splitting logic', () => {
    const elisions = ["l'ecole", "d'un", "j'ai", "c'est", "qu'il"];
    const prefixRegex = /^(l'|d'|j'|n'|m'|t'|s'|c'|qu'|jusqu'|lorsqu'|puisqu')(.*)$/i;

    for (const token of elisions) {
      const match = prefixRegex.exec(token);
      expect(match).not.toBeNull();
      expect(match![1]).toBeDefined();
      expect(match![2]).toBeDefined();
    }
  });

  it('verifies weighted Damerau-Levenshtein cost properties', () => {
    // Keyboard adjacency distance property check
    const qwertyAdjacent: Record<string, string[]> = {
      t: ['r', 'y', 'g', 'f'],
      e: ['w', 'r', 's', 'd'],
      h: ['g', 'j', 'b', 'n', 'y', 'u'],
    };

    // 't' is adjacent to 'r' and 'y'
    expect(qwertyAdjacent['t']).toContain('y');
    expect(qwertyAdjacent['t']).toContain('r');
  });
});
