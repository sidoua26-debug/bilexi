import { describe, it, expect } from 'vitest';
import { detectSentenceStart } from '../case';

describe('Sentence Capitalization & Boundary Detection (Phase 1.4)', () => {
  it('detects standard sentence boundaries (. ! ? followed by space)', () => {
    expect(detectSentenceStart('Hello world. ')).toBe(true);
    expect(detectSentenceStart('Are you ready? ')).toBe(true);
    expect(detectSentenceStart('Look out! ')).toBe(true);
    expect(detectSentenceStart('First sentence.\n')).toBe(true);
  });

  it('handles field start according to explicit setting', () => {
    expect(detectSentenceStart('', { capitalizeFieldStart: false })).toBe(false);
    expect(detectSentenceStart('', { capitalizeFieldStart: true })).toBe(true);
    expect(detectSentenceStart('   ', { capitalizeFieldStart: false })).toBe(false);
    expect(detectSentenceStart('   ', { capitalizeFieldStart: true })).toBe(true);
  });

  it('detects newline starts as sentence boundary', () => {
    expect(detectSentenceStart('Line 1\n')).toBe(true);
    expect(detectSentenceStart('Line 1\r\n  ')).toBe(true);
  });

  it('does NOT trigger on ellipsis (...)', () => {
    expect(detectSentenceStart('Waiting... ')).toBe(false);
    expect(detectSentenceStart('Wait… ')).toBe(false);
  });

  it('guards against English and French abbreviations', () => {
    // English abbreviations
    expect(detectSentenceStart('See etc. ')).toBe(false);
    expect(detectSentenceStart('Visit Mr. ')).toBe(false);
    expect(detectSentenceStart('Ask Dr. ')).toBe(false);
    expect(detectSentenceStart('e.g. ')).toBe(false);
    expect(detectSentenceStart('i.e. ')).toBe(false);

    // French abbreviations
    expect(detectSentenceStart('Bonjour M. ')).toBe(false);
    expect(detectSentenceStart('Comme p. ex. ')).toBe(false);
  });

  it('does NOT trigger in the middle of a sentence', () => {
    expect(detectSentenceStart('Hello ')).toBe(false);
    expect(detectSentenceStart('Say ')).toBe(false);
    expect(detectSentenceStart('word, ')).toBe(false);
  });
});
