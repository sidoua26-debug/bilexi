import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine';

describe('Morphological and Orthographic Rules Audit', () => {
  let engine: any;

  beforeAll(() => {
    const enBinPath = path.resolve('public/dict/en.bin');
    const frBinPath = path.resolve('public/dict/fr.bin');
    const enBuf = fs.readFileSync(enBinPath);
    const frBuf = fs.readFileSync(frBinPath);
    engine = createEngine(
      { en: enBuf, fr: frBuf },
      { languageMode: 'auto', sensitivity: 'balanced' }
    );
  });

  beforeEach(() => {
    engine.resetStickyLanguage();
  });

  describe('Adverbial Suffix Morphology (-ament -> -emment / -amment)', () => {
    it('corrects differament to différemment in French context', () => {
      const d = engine.analyze({ token: 'differament', boundary: ' ', leftContext: [], langHint: 'fr' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe('différemment');
    });

    it('corrects evidament to évidemment in French context', () => {
      const d = engine.analyze({ token: 'evidament', boundary: ' ', leftContext: [], langHint: 'fr' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe('évidemment');
    });

    it('preserves valid English words ending in -ament / -ent unchanged', () => {
      for (const w of ['fundamental', 'filament', 'parliament', 'ornament', 'different']) {
        const d = engine.analyze({ token: w, boundary: ' ', leftContext: [], langHint: 'en' });
        expect(d.action).toBe('none');
      }
    });

    it('preserves valid French words ending in -ament with diacritic restoration', () => {
      const d = engine.analyze({ token: 'medicament', boundary: ' ', leftContext: [], langHint: 'fr' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe('médicament');
    });
  });

  describe('French developp* Root Orthographic Rules', () => {
    it('corrects developpent to développement in French context', () => {
      const d = engine.analyze({ token: 'developpent', boundary: ' ', leftContext: [], langHint: 'fr' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe('développement');
    });

    it('corrects developpement to développement in French context', () => {
      const d = engine.analyze({ token: 'developpement', boundary: ' ', leftContext: [], langHint: 'fr' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe('développement');
    });

    it('preserves valid English development unchanged', () => {
      const d = engine.analyze({ token: 'development', boundary: ' ', leftContext: [], langHint: 'en' });
      expect(d.action).toBe('none');
    });

    it('preserves valid English develop unchanged', () => {
      const d = engine.analyze({ token: 'develop', boundary: ' ', leftContext: [], langHint: 'en' });
      expect(d.action).toBe('none');
    });
  });

  describe('Required Invariants from Prompt Section 3', () => {
    it('corrects ecole -> école', () => {
      const d = engine.analyze({ token: 'ecole', boundary: ' ', leftContext: [], langHint: 'fr' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe('école');
    });

    it('corrects l\'ecole -> l\'école', () => {
      const d = engine.analyze({ token: "l'ecole", boundary: ' ', leftContext: [], langHint: 'fr' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe("l'école");
    });

    it('corrects jespere -> j\'espère', () => {
      const d = engine.analyze({ token: 'jespere', boundary: ' ', leftContext: [], langHint: 'fr' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe("j'espère");
    });

    it('handles independant in English context -> independent', () => {
      const d = engine.analyze({ token: 'independant', boundary: ' ', leftContext: ['very'], langHint: 'en' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe('independent');
    });

    it('handles independant in French context -> indépendant', () => {
      const d = engine.analyze({ token: 'independant', boundary: ' ', leftContext: ['très'], langHint: 'fr' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe('indépendant');
    });

    it('preserves common words untouched: the, different, development, independent', () => {
      for (const w of ['the', 'different', 'development', 'independent']) {
        const d = engine.analyze({ token: w, boundary: ' ', leftContext: [], langHint: 'en' });
        expect(d.action).toBe('none');
      }
    });
  });

  describe('English Contraction and Possessive Candidates', () => {
    it('corrects cna\'t -> can\'t', () => {
      const d = engine.analyze({ token: "cna't", boundary: ' ', leftContext: [], langHint: 'en' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe("can't");
    });

    it('corrects do\'t -> don\'t', () => {
      const d = engine.analyze({ token: "do't", boundary: ' ', leftContext: [], langHint: 'en' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe("don't");
    });

    it('corrects wont\' -> won\'t', () => {
      const d = engine.analyze({ token: "wont'", boundary: ' ', leftContext: [], langHint: 'en' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe("won't");
    });

    it('corrects theer\'s -> there\'s', () => {
      const d = engine.analyze({ token: "theer's", boundary: ' ', leftContext: [], langHint: 'en' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe("there's");
    });

    it('corrects prosectuor\'s -> prosecutor\'s', () => {
      const d = engine.analyze({ token: "prosectuor's", boundary: ' ', leftContext: [], langHint: 'en' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe("prosecutor's");
    });

    it('corrects fahter\'s -> father\'s', () => {
      const d = engine.analyze({ token: "fahter's", boundary: ' ', leftContext: [], langHint: 'en' });
      expect(d.action).toBe('replace');
      expect(d.replacement.toLowerCase()).toBe("father's");
    });
  });
});
