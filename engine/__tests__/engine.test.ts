import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine';
import { normalize, fold } from '../normalize';
import { splitElision } from '../tokenize';
import { weightedDistance } from '../distance';
import { isAdjacentKey } from '../keyboard';
import { matchCase } from '../case';
import { lookupRuleEn } from '../rules-en';
import { lookupRuleFr } from '../rules-fr';
import { computeLanguagePosterior } from '../language';

describe('Unit Tests: Pure NLP Engine Modules', () => {
  it('1. Unicode Normalization & Fold', () => {
    expect(normalize('e\u0301cole')).toBe('école');
    expect(fold('école')).toBe('ecole');
    expect(fold('cœur')).toBe('coeur');
    expect(fold('œuvre')).toBe('oeuvre');
    expect(fold('façade')).toBe('facade');
    expect(fold('naïve')).toBe('naive');
    expect(fold('don’t')).toBe("don't");
  });

  it('2. French Elision Splitting', () => {
    expect(splitElision("l'ecole")).toEqual({
      raw: "l'ecole",
      prefix: "l'",
      core: "ecole",
      hasElision: true,
    });
    expect(splitElision("d'accord")).toEqual({
      raw: "d'accord",
      prefix: "d'",
      core: "accord",
      hasElision: true,
    });
    expect(splitElision("j'ai")).toEqual({
      raw: "j'ai",
      prefix: "j'",
      core: "ai",
      hasElision: true,
    });
    expect(splitElision("qu'il")).toEqual({
      raw: "qu'il",
      prefix: "qu'",
      core: "il",
      hasElision: true,
    });
    expect(splitElision("hello")).toEqual({
      raw: "hello",
      prefix: "",
      core: "hello",
      hasElision: false,
    });
  });

  it('3. Keyboard Adjacency Mapping', () => {
    // QWERTY
    expect(isAdjacentKey('t', 'y', 'qwerty')).toBe(true);
    expect(isAdjacentKey('t', 'r', 'qwerty')).toBe(true);
    expect(isAdjacentKey('t', 'g', 'qwerty')).toBe(true);
    expect(isAdjacentKey('t', 'p', 'qwerty')).toBe(false);

    // AZERTY
    expect(isAdjacentKey('a', 'z', 'azerty')).toBe(true);
    expect(isAdjacentKey('a', 'q', 'azerty')).toBe(true);
  });

  it('4. Weighted Damerau-Levenshtein Cost Model', () => {
    // Exact match
    expect(weightedDistance('hello', 'hello')).toBe(0);

    // Accent-only restoration
    expect(weightedDistance('ecole', 'école')).toBe(0.2);
    expect(weightedDistance('oeuvre', 'œuvre')).toBe(0.2);

    // Adjacent keyboard key substitution vs non-adjacent
    const adjacentCost = weightedDistance('tje', 'the', { layout: 'qwerty' });
    const nonAdjacentCost = weightedDistance('txe', 'the', { layout: 'qwerty' });
    expect(adjacentCost).toBeLessThan(nonAdjacentCost);

    // Transposition (Damerau)
    const transCost = weightedDistance('teh', 'the');
    expect(transCost).toBeCloseTo(0.6, 2);

    // Doubled / undoubled letter cost
    const doubleCost = weightedDistance('adress', 'address');
    expect(doubleCost).toBeCloseTo(0.6, 2);
  });

  it('5. Case Restoration', () => {
    expect(matchCase('teh', 'the')).toBe('the');
    expect(matchCase('Teh', 'the')).toBe('The');
    expect(matchCase('TEH', 'the')).toBe('THE');
    expect(matchCase('ecole', 'école')).toBe('école');
    expect(matchCase('Ecole', 'école')).toBe('École');
    expect(matchCase('ECOLE', 'école')).toBe('ÉCOLE');
  });

  it('6. Curated High-Precision Rules', () => {
    // English
    expect(lookupRuleEn('dont')).toBe("don't");
    expect(lookupRuleEn('im')).toBe("I'm");
    expect(lookupRuleEn('ive')).toBe("I've");
    expect(lookupRuleEn('thats')).toBe("that's");
    expect(lookupRuleEn('i')).toBe("I");

    // French
    expect(lookupRuleFr('jai')).toBe("j'ai");
    expect(lookupRuleFr('cest')).toBe("c'est");
    expect(lookupRuleFr('aujourdhui')).toBe("aujourd'hui");
    expect(lookupRuleFr('lecole')).toBe("l'école");
  });

  it('7. Language Prior and Character Weighting', () => {
    // French diacritics heavily skew to French
    const resFr = computeLanguagePosterior('école', ['je', 'vais', 'à']);
    expect(resFr.pFr).toBeGreaterThan(0.9);

    // English context skews to English
    const resEn = computeLanguagePosterior('house', ['the', 'big', 'white']);
    expect(resEn.pEn).toBeGreaterThan(0.9);
  });
});

describe('Full Engine Analysis on Real Binary Dictionaries', () => {
  let engine: ReturnType<typeof createEngine>;

  beforeAll(() => {
    const enBinPath = path.resolve('public/dict/en.bin');
    const frBinPath = path.resolve('public/dict/fr.bin');

    const enBuf = fs.readFileSync(enBinPath);
    const frBuf = fs.readFileSync(frBinPath);

    engine = createEngine(
      { en: enBuf, fr: frBuf },
      {
        languageMode: 'auto',
        sensitivity: 'balanced',
        layout: 'auto',
        sentenceCaps: true,
        fixLoneI: true,
      }
    );
  });

  beforeEach(() => {
    engine.resetStickyLanguage();
    engine.updateSettings({
      personalWords: [],
      rejectedWords: [],
      typographicApostrophe: false,
    });
  });

  it('Fixes standard English typos (Appendix A)', () => {
    const cases: Array<[string, string]> = [
      ['teh', 'the'],
      ['recieve', 'receive'],
      ['seperate', 'separate'],
      ['occured', 'occurred'],
      ['wierd', 'weird'],
      ['thier', 'their'],
      ['becuase', 'because'],
      ['untill', 'until'],
      ['freind', 'friend'],
      ['beleive', 'believe'],
      ['adress', 'address'],
      ['accomodate', 'accommodate'],
      ['goverment', 'government'],
      ['tommorow', 'tomorrow'],
      ['tje', 'the'],
      ['Teh', 'The'],
    ];

    for (const [typed, expected] of cases) {
      const decision = engine.analyze({
        token: typed,
        boundary: ' ',
        leftContext: ['I', 'think'],
      });
      expect(decision.action, `Failed to correct '${typed}'`).toBe('replace');
      expect(decision.replacement, `Expected '${expected}' for '${typed}'`).toBe(expected);
    }
  });

  it('Fixes English curated rules (Appendix A)', () => {
    const cases: Array<[string, string]> = [
      ['dont', "don't"],
      ['doesnt', "doesn't"],
      ['im', "I'm"],
      ['ive', "I've"],
      ['thats', "that's"],
      ['i', 'I'],
    ];

    for (const [typed, expected] of cases) {
      const decision = engine.analyze({
        token: typed,
        boundary: ' ',
      });
      expect(decision.action).toBe('replace');
      expect(decision.replacement).toBe(expected);
    }
  });

  it('Fixes French accents and typos (Appendix A)', () => {
    const cases: Array<[string, string]> = [
      ['ecole', 'école'],
      ['tres', 'très'],
      ['deja', 'déjà'],
      ['apres', 'après'],
      ['francais', 'français'],
      ['necessaire', 'nécessaire'],
      ['oeuvre', 'œuvre'],
      ['coeur', 'cœur'],
      ['bonjuor', 'bonjour'],
      ['beaucuop', 'beaucoup'],
      ['cest', "c'est"],
      ['jai', "j'ai"],
      ['aujourdhui', "aujourd'hui"],
      ['lecole', "l'école"],
      ['quil', "qu'il"],
      ['sil', "s'il"],
      ["l'ecole", "l'école"],
    ];

    for (const [typed, expected] of cases) {
      const decision = engine.analyze({
        token: typed,
        boundary: ' ',
        leftContext: ['c', 'est', 'très'],
      });
      expect(decision.action, `Failed to correct FR '${typed}'`).toBe('replace');
      expect(decision.replacement, `Expected '${expected}' for '${typed}'`).toBe(expected);
    }
  });

  it('Supports typographicApostrophe setting (straight vs curly apostrophes)', () => {
    // Default: straight apostrophe
    expect(engine.getSettings().typographicApostrophe).toBe(false);
    expect(engine.analyze({ token: 'dont', boundary: ' ' }).replacement).toBe("don't");
    expect(engine.analyze({ token: 'cest', boundary: ' ' }).replacement).toBe("c'est");
    expect(engine.analyze({ token: "l'ecole", boundary: ' ' }).replacement).toBe("l'école");

    // Enable typographicApostrophe
    engine.updateSettings({ typographicApostrophe: true });
    expect(engine.analyze({ token: 'dont', boundary: ' ' }).replacement).toBe('don’t');
    expect(engine.analyze({ token: 'cest', boundary: ' ' }).replacement).toBe('c’est');
    expect(engine.analyze({ token: "l'ecole", boundary: ' ' }).replacement).toBe('l’école');

    // Reset back to default
    engine.updateSettings({ typographicApostrophe: false });
    expect(engine.analyze({ token: 'dont', boundary: ' ' }).replacement).toBe("don't");
  });

  it('Handles mixed sentence: I went to l\'ecole hier', () => {
    const decision = engine.analyze({
      token: "l'ecole",
      boundary: ' ',
      leftContext: ['I', 'went', 'to'],
    });
    expect(decision.action).toBe('replace');
    expect(decision.replacement).toBe("l'école");
  });

  it('Leaves unchanged all items on the MUST-STAY-UNCHANGED list', () => {
    const mustStayUnchanged = [
      'iPhone', 'NASA', 'GitHub', 'npm', 'lol', 'mdr', 'slt', 'stp',
      'https://example.com/teh', 'john@example.com', '#teh', '@teh',
      '3rd', 'co-operate', 'colour', 'color', "c'est", "l'école",
      'peut-être', "aujourd'hui", 'fatigue', 'Paris', 'Québec', 'SNCF',
      'pain', 'on', 'a', 'ou'
    ];

    for (const word of mustStayUnchanged) {
      const decision = engine.analyze({
        token: word,
        boundary: ' ',
        leftContext: ['test'],
      });
      expect(
        decision.action,
        `Expected '${word}' to remain untouched, but got '${decision.replacement}' (reason: ${decision.reason})`
      ).toBe('none');
    }
  });

  it('Respects personal dictionary additions', () => {
    engine.updateSettings({ personalWords: ['mycustomword'] });
    const decision = engine.analyze({ token: 'mycustomword', boundary: ' ' });
    expect(decision.action).toBe('none');
    expect(decision.reason).toBe('Personal dictionary match');
  });

  it('Respects rejected words', () => {
    engine.updateSettings({ rejectedWords: ['teh'] });
    const decision = engine.analyze({ token: 'teh', boundary: ' ' });
    expect(decision.action).toBe('none');
    expect(decision.reason).toBe('Previously rejected token');
  });

  it('A2: Validity test on 2,000 seeded random words (zero false negatives)', () => {
    function mulberry32(a: number) {
      return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    const rng = mulberry32(1337);

    // 1. English Hunspell words
    const enDicPath = path.resolve('node_modules/dictionary-en/index.dic');
    const enLines = fs.readFileSync(enDicPath, 'utf-8').split('\n');
    const enWords: string[] = [];
    for (let i = 1; i < enLines.length; i++) {
      const line = enLines[i]!.trim();
      const slash = line.indexOf('/');
      const w = (slash >= 0 ? line.slice(0, slash) : line).trim();
      if (w && /^[a-zA-Z'-]{2,20}$/.test(w)) enWords.push(w);
    }

    // 2. French Lexique words
    const lexiquePath = path.resolve('data/raw/Lexique383.tsv');
    const frWords: string[] = [];
    if (fs.existsSync(lexiquePath)) {
      const frLines = fs.readFileSync(lexiquePath, 'utf-8').split('\n');
      for (let i = 1; i < Math.min(frLines.length, 50000); i++) {
        const ortho = frLines[i]!.split('\t')[0]?.trim();
        if (ortho && /^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]{2,20}$/.test(ortho)) {
          const w = ortho.includes('oe') && !ortho.includes('œ') ? ortho.replace(/oe/g, 'œ') : ortho;
          frWords.push(w);
        }
      }
    }

    let enTested = 0;
    let enMissing = 0;
    for (let i = 0; i < 1000 && enWords.length > 0; i++) {
      const idx = Math.floor(rng() * enWords.length);
      const w = enWords[idx]!;
      enTested++;
      if (!engine.isKnownWord(w, 'en')) enMissing++;
    }

    let frTested = 0;
    let frMissing = 0;
    for (let i = 0; i < 1000 && frWords.length > 0; i++) {
      const idx = Math.floor(rng() * frWords.length);
      const w = frWords[idx]!;
      frTested++;
      if (!engine.isKnownWord(w, 'fr')) frMissing++;
    }

    expect(enTested).toBe(1000);
    expect(enMissing, `EN false negatives: ${enMissing}/1000`).toBe(0);

    if (frWords.length > 0) {
      expect(frTested).toBe(1000);
      expect(frMissing, `FR false negatives: ${frMissing}/1000`).toBe(0);
    }
  });

  describe('Task T4 & T5: Suggestion Ordering, Weighting, Case & Partial Words', () => {
    it('ranks closer and higher frequency candidates first in suggest()', () => {
      const suggestions = engine.suggest({ token: 'recieve' });
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toBe('receive');
    });

    it('preserves casing in suggestions: Upper and Title case', () => {
      const upper = engine.suggest({ token: 'RECIEVE' });
      expect(upper[0]).toBe('RECEIVE');

      const title = engine.suggest({ token: 'Recieve' });
      expect(title[0]).toBe('Receive');
    });

    it('suggests French elision candidate for token typed without apostrophe', () => {
      const suggestions = engine.suggest({ token: 'jespere' });
      expect(suggestions).toContain("j'espère");
    });

    it('respects language weighting and language hints', () => {
      const frHint = engine.suggest({ token: 'differament', langHint: 'fr' });
      expect(frHint).toContain('différemment');
    });

    it('handles partial words: suggest() offers completions/corrections and space does not autocorrect unknown fragments', () => {
      // For partial word 'reci', suggest() offers corrections or completions
      const suggestions = engine.suggest({ token: 'reci' });
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions).toContain('reçu');

      // Test that an unknown arbitrary partial fragment (e.g. 'zzx') is never auto-replaced on space
      const fragmentDecision = engine.analyze({ token: 'zzx', boundary: ' ' });
      expect(fragmentDecision.action).toBe('none');
    });

    it('handles generalizable French morphology and cross-lingual disambiguation without test-specific rules', () => {
      // 1. French context: -ament homophone -> -emment, developpent -> développement
      const diffFr = engine.analyze({ token: 'differament', boundary: ' ', langHint: 'fr' });
      expect(diffFr.action).toBe('replace');
      expect(diffFr.replacement).toBe('différemment');

      const devFrContext = engine.analyze({ token: 'developpent', boundary: ' ', leftContext: ['le'] });
      expect(devFrContext.action).toBe('replace');
      expect(devFrContext.replacement).toBe('développement');

      // 2. English context: differament -> different, developpent -> development
      const diffEn = engine.analyze({ token: 'differament', boundary: ' ', langHint: 'en' });
      expect(diffEn.action).toBe('replace');
      expect(diffEn.replacement).toBe('different');

      const devEn = engine.analyze({ token: 'developpent', boundary: ' ', langHint: 'en' });
      expect(devEn.action).toBe('replace');
      expect(devEn.replacement).toBe('development');

      // 3. Genuinely ambiguous context-free: safe two-tier behavior (no blind replacement, suggest offers alternatives)
      const diffNoHint = engine.analyze({ token: 'differament', boundary: ' ' });
      expect(diffNoHint.action).toBe('none');
      const diffSugg = engine.suggest({ token: 'differament', boundary: ' ' });
      expect(diffSugg).toContain('différemment');
      expect(diffSugg).toContain('different');

      const devNoHint = engine.analyze({ token: 'developpent', boundary: ' ' });
      expect(devNoHint.action).toBe('none');
      const devSugg = engine.suggest({ token: 'developpent', boundary: ' ' });
      expect(devSugg).toContain('development');
      expect(devSugg).toContain('développement');

      // 3b. English vs French cognate disambiguation
      const enIndep = engine.analyze({ token: 'independant', langHint: 'en', boundary: ' ' });
      expect(enIndep.action).toBe('replace');
      expect(enIndep.replacement).toBe('independent');

      const frIndep = engine.analyze({ token: 'independant', langHint: 'fr', boundary: ' ' });
      expect(frIndep.action).toBe('replace');
      expect(frIndep.replacement).toBe('indépendant');

      // 4. French accent restoration on English page
      const ecole = engine.analyze({ token: 'ecole', langHint: 'en', boundary: ' ' });
      expect(ecole.action).toBe('replace');
      expect(ecole.replacement).toBe('école');
    });

    it('protects valid English words, compounds, possessives, and proper nouns (non-regression)', () => {
      // Legitimate words must remain unchanged
      expect(engine.analyze({ token: 'different', boundary: ' ' }).action).toBe('none');
      expect(engine.analyze({ token: 'development', boundary: ' ' }).action).toBe('none');
      expect(engine.analyze({ token: 'independent', boundary: ' ' }).action).toBe('none');

      // Possessives & contractions
      expect(engine.analyze({ token: "students'", boundary: ' ' }).action).toBe('none');
      expect(engine.analyze({ token: "else's", boundary: ' ' }).action).toBe('none');
      expect(engine.analyze({ token: "Where're", boundary: ' ' }).action).toBe('none');

      // Hyphenated compounds & prefixes
      expect(engine.analyze({ token: 'stomach-ache', boundary: ' ' }).action).toBe('none');
      expect(engine.analyze({ token: 'unturned', boundary: ' ' }).action).toBe('none');
      expect(engine.analyze({ token: 'heirless', boundary: ' ' }).action).toBe('none');
      expect(engine.analyze({ token: 'PTAs', boundary: ' ' }).action).toBe('none');
    });

    it('preserves verified 1990 French orthographic reform variants without overwriting (WP3)', () => {
      // 1. Circumflex on i and u removed (Règle 4) vs traditional forms
      // Neither plait nor plaît should be replaced by the other
      expect(engine.analyze({ token: 'plait', boundary: ' ', leftContext: ["s'il", "vous"] }).action).toBe('none');
      expect(engine.analyze({ token: 'plaît', boundary: ' ', leftContext: ["s'il", "vous"] }).action).toBe('none');
      expect(engine.analyze({ token: 'ainé', boundary: ' ', leftContext: ['mon', 'frère'] }).action).toBe('none');
      expect(engine.analyze({ token: 'aîné', boundary: ' ', leftContext: ['mon', 'frère'] }).action).toBe('none');
      expect(engine.analyze({ token: 'abimé', boundary: ' ', leftContext: ["l'objet", "est"] }).action).toBe('none');
      expect(engine.analyze({ token: 'abîmé', boundary: ' ', leftContext: ["l'objet", "est"] }).action).toBe('none');
      expect(engine.analyze({ token: 'dégoute', boundary: ' ', leftContext: ['il', 'me'] }).action).toBe('none');
      expect(engine.analyze({ token: 'dégoûte', boundary: ' ', leftContext: ['il', 'me'] }).action).toBe('none');
      expect(engine.analyze({ token: 'brulé', boundary: ' ', leftContext: ['tout', 'a'] }).action).toBe('none');
      expect(engine.analyze({ token: 'brûlé', boundary: ' ', leftContext: ['tout', 'a'] }).action).toBe('none');

      // 2. Inverted future/conditional accent (Règle 2)
      expect(engine.analyze({ token: 'préfèrerais', boundary: ' ', leftContext: ['je'] }).action).toBe('none');
      expect(engine.analyze({ token: 'préférerais', boundary: ' ', leftContext: ['je'] }).action).toBe('none');
      expect(engine.analyze({ token: 'évènement', boundary: ' ', leftContext: ['un'] }).action).toBe('none');
      expect(engine.analyze({ token: 'événement', boundary: ' ', leftContext: ['un'] }).action).toBe('none');

      // 3. Hyphenation variants
      expect(engine.analyze({ token: 'weekend', boundary: ' ', leftContext: ['bon'] }).action).toBe('none');
      expect(engine.analyze({ token: 'week-end', boundary: ' ', leftContext: ['bon'] }).action).toBe('none');
    });

    it('handles missing, null, or malformed ngram models gracefully without throwing', () => {
      const enBuf = fs.readFileSync('public/dict/en.bin');
      const frBuf = fs.readFileSync('public/dict/fr.bin');
      // 1. Engine created with corrupted ngram buffer
      const corruptedEngine = createEngine({
        en: enBuf,
        fr: frBuf,
        ngram: new Uint8Array([0x00, 0x01, 0x02, 0x03]).buffer,
      });
      const res1 = corruptedEngine.analyze({ token: 'teh', boundary: ' ', leftContext: ['all'] });
      expect(res1.action).toBe('replace');
      expect(res1.replacement).toBe('the');

      // 2. Engine created with completely missing ngram
      const noNgramEngine = createEngine({
        en: enBuf,
        fr: frBuf,
      });
      const res2 = noNgramEngine.analyze({ token: "l'ecole", boundary: ' ', leftContext: ['I', 'went', 'to'], langHint: 'en' });
      expect(res2.action).toBe('replace');
      expect(res2.replacement).toBe("l'école");
    });

    it('handles sentenceCaps and typographicApostrophe correctly', () => {
      // 1. Isolated token without sentence context does NOT capitalize
      const resIsolated = engine.analyze({ token: 'hello', boundary: ' ' });
      expect(resIsolated.action).toBe('none');
      expect(resIsolated.replacement).toBe('hello');

      // 2. Explicitly sentence-initial token capitalizes
      const resInitial = engine.analyze({ token: 'hello', boundary: ' ', isSentenceInitial: true });
      expect(resInitial.action).toBe('replace');
      expect(resInitial.replacement).toBe('Hello');

      // 3. Token after sentence-ending period capitalizes
      const resAfterPeriod = engine.analyze({ token: 'hello', boundary: ' ', leftContext: ['Previous', 'sentence.'] });
      expect(resAfterPeriod.action).toBe('replace');
      expect(resAfterPeriod.replacement).toBe('Hello');

      // 4. Token after abbreviation does NOT capitalize
      const resAfterAbbr = engine.analyze({ token: 'hello', boundary: ' ', leftContext: ['e.g.'] });
      expect(resAfterAbbr.action).toBe('none');

      // 5. Token in middle of sentence does NOT capitalize
      const resMid = engine.analyze({ token: 'hello', boundary: ' ', leftContext: ['Say'] });
      expect(resMid.action).toBe('none');

      // 6. Typographic apostrophe formatting
      engine.updateSettings({ typographicApostrophe: true });
      const resTypo = engine.analyze({ token: "cna't", boundary: ' ' });
      expect(resTypo.action).toBe('replace');
      expect(resTypo.replacement).toBe('can’t');

      // Reset
      engine.updateSettings({ typographicApostrophe: false });
    });

    it('Phase 1.1: Curated rules gating, ambiguous rules (nest, quelles, im, cant)', () => {
      // English "nest" should stay unchanged in English context
      const resNest = engine.analyze({ token: 'nest', boundary: ' ', leftContext: ['a', 'bird'] });
      expect(resNest.action).toBe('none');
      expect(resNest.replacement).toBe('nest');

      // German "im Haus" - "im" should stay unchanged
      const resIm = engine.analyze({ token: 'im', boundary: ' ', leftContext: ['Er', 'ist'] });
      expect(resIm.action).toBe('none');
      expect(resIm.replacement).toBe('im');

      // French "je sais quelles sont..." - "quelles" is a valid French word and must stay unchanged
      const resQuelles = engine.analyze({ token: 'quelles', boundary: ' ', leftContext: ['je', 'sais'] });
      expect(resQuelles.action).toBe('none');
      expect(resQuelles.replacement).toBe('quelles');
    });

    it('Phase 2: Sticky language, code-switching, and ambiguous words', () => {
      engine.resetStickyLanguage();
      expect(engine.getStickyLanguage()).toBeUndefined();

      // 1. Typing 2 unambiguous French words sets sticky language to 'fr'
      engine.analyze({ token: 'bonjour', boundary: ' ' });
      engine.analyze({ token: 'monde', boundary: ' ', leftContext: ['bonjour'] });
      expect(engine.getStickyLanguage()).toBe('fr');

      // 2. Ambiguous words (pain, coin, pour, son) are preserved in French sticky context
      const resPainFr = engine.analyze({ token: 'pain', boundary: ' ' });
      expect(resPainFr.action).toBe('none');
      expect(resPainFr.replacement).toBe('pain');

      const resCoinFr = engine.analyze({ token: 'coin', boundary: ' ' });
      expect(resCoinFr.action).toBe('none');
      expect(resCoinFr.replacement).toBe('coin');

      // French typo in sticky French context is corrected to French
      const resEcole = engine.analyze({ token: 'ecole', boundary: ' ' });
      expect(resEcole.action).toBe('replace');
      expect(resEcole.replacement).toBe('école');

      // 3. Code-switching: Typing 2 unambiguous English words flips sticky language to 'en'
      engine.analyze({ token: 'yesterday', boundary: ' ' });
      engine.analyze({ token: 'morning', boundary: ' ', leftContext: ['yesterday'] });
      expect(engine.getStickyLanguage()).toBe('en');

      // 4. In English context, ambiguous words remain unchanged as valid English words
      const resPainEn = engine.analyze({ token: 'pain', boundary: ' ' });
      expect(resPainEn.action).toBe('none');
      expect(resPainEn.replacement).toBe('pain');

      // English typo in sticky English context is corrected to English
      const resTeh = engine.analyze({ token: 'teh', boundary: ' ' });
      expect(resTeh.action).toBe('replace');
      expect(resTeh.replacement).toBe('the');

      // 5. Reset works cleanly
      engine.resetStickyLanguage();
      expect(engine.getStickyLanguage()).toBeUndefined();
    });
  });
});

