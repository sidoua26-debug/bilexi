import { describe, it, expect } from 'vitest';
import { isBoundaryChar, BOUNDARY_REGEX, splitElision, isWordToken } from '../tokenize';

describe('Unicode Tokenization & Boundaries (Phase 1.5)', () => {
  it('recognizes narrow NBSP (U+202F) as boundary character before French punctuation', () => {
    expect(isBoundaryChar('\u202F')).toBe(true);
    expect(BOUNDARY_REGEX.test('mot\u202F:')).toBe(true);
    expect(BOUNDARY_REGEX.test('mot\u202F;')).toBe(true);
    expect(BOUNDARY_REGEX.test('mot\u202F!')).toBe(true);
    expect(BOUNDARY_REGEX.test('mot\u202F?')).toBe(true);
  });

  it('validates word tokens with Unicode letters, uppercase accents, ÿ, and typographic apostrophes', () => {
    expect(isWordToken('École')).toBe(true);
    expect(isWordToken('À')).toBe(true);
    expect(isWordToken('l’école')).toBe(true);
    expect(isWordToken("l'école")).toBe(true);
    expect(isWordToken('naïf')).toBe(true);
    expect(isWordToken('haÿ')).toBe(true);
  });

  it('splits French elisions with both straight and typographic apostrophes', () => {
    const straight = splitElision("l'école");
    expect(straight.hasElision).toBe(true);
    expect(straight.prefix).toBe("l'");
    expect(straight.core).toBe('école');

    const typo = splitElision('l’école');
    expect(typo.hasElision).toBe(true);
    expect(typo.prefix).toBe('l’');
    expect(typo.core).toBe('école');

    const upper = splitElision("D'accord");
    expect(upper.hasElision).toBe(true);
    expect(upper.prefix).toBe("D'");
    expect(upper.core).toBe('accord');
  });
});
