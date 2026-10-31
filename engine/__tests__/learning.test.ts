import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrateSettings,
  recordRejection,
  recordWordUsage,
  getSettings,
  saveSettings,
  addPersonalWord,
  removePersonalWord,
  addShortcut,
  removeShortcut,
  resetMemoryLearningCounters,
  getMemoryWordCounts,
  getMemoryRejectionCounts,
  MAX_PERSONAL_WORDS,
} from '../../entrypoints/content/settings';
import { createEngine } from '../engine';

describe('Phase B & C: Settings Migration, Shortcuts & Learning Privacy', () => {
  beforeEach(async () => {
    // Reset to clean default settings and memory before each test
    resetMemoryLearningCounters();
    await saveSettings(migrateSettings({}));
  });

  describe('1. Settings Migration & Typographic Apostrophe Option', () => {
    it('migrates undefined or null settings to default v2 with typographicApostrophe false', () => {
      const migrated = migrateSettings(null);
      expect(migrated.version).toBe(2);
      expect(migrated.enabled).toBe(true);
      expect(migrated.languageMode).toBe('auto');
      expect(migrated.typographicApostrophe).toBe(false);
      expect(migrated.personalWords).toEqual([]);
      expect(migrated.rejectedWords).toEqual([]);
      expect(migrated.shortcuts.length).toBeGreaterThan(0);
      expect(migrated.shortcuts[0]).toEqual({ trigger: 'omw', replacement: 'on my way' });
      expect(migrated.stats.corrections).toBe(0);
      expect(migrated.stats.reverts).toBe(0);
    });

    it('preserves existing v1 user preferences and typographicApostrophe', () => {
      const v1Settings = {
        enabled: true,
        disabledSites: ['example.com'],
        languageMode: 'fr',
        sensitivity: 'bold',
        sentenceCaps: false,
        fixLoneI: false,
        showUndoChip: false,
        typographicApostrophe: true,
        personalWords: ['MyCustomBrand', 'Sid'],
      };

      const migrated = migrateSettings(v1Settings);
      expect(migrated.version).toBe(2);
      expect(migrated.languageMode).toBe('fr');
      expect(migrated.sensitivity).toBe('bold');
      expect(migrated.sentenceCaps).toBe(false);
      expect(migrated.typographicApostrophe).toBe(true);
      expect(migrated.personalWords).toEqual(['MyCustomBrand', 'Sid']);
      expect(migrated.disabledSites).toEqual(['example.com']);
      expect(migrated.rejectedWords).toEqual([]);
      expect(migrated.shortcuts).toBeDefined();
    });
  });

  describe('2. Text Shortcuts Expansion & Casing', () => {
    it('expands trigger with exact matching casing', () => {
      const engine = createEngine({}, {
        shortcuts: [
          { trigger: 'omw', replacement: 'on my way' },
          { trigger: 'tyvm', replacement: 'thank you very much' },
        ],
      });

      // Lowercase
      const resLower = engine.analyze({ token: 'omw', boundary: ' ' });
      expect(resLower.action).toBe('replace');
      expect(resLower.replacement).toBe('on my way');

      // Capitalized
      const resCap = engine.analyze({ token: 'Omw', boundary: ' ' });
      expect(resCap.action).toBe('replace');
      expect(resCap.replacement).toBe('On my way');

      // ALL CAPS
      const resUpper = engine.analyze({ token: 'OMW', boundary: ' ' });
      expect(resUpper.action).toBe('replace');
      expect(resUpper.replacement).toBe('ON MY WAY');

      // Another shortcut
      const resTyvm = engine.analyze({ token: 'tyvm', boundary: '.' });
      expect(resTyvm.action).toBe('replace');
      expect(resTyvm.replacement).toBe('thank you very much');
    });

    it('expands shortcut with French elision prefix intact', () => {
      const engine = createEngine({}, {
        shortcuts: [
          { trigger: 'omw', replacement: 'on my way' },
        ],
      });

      const res = engine.analyze({ token: "d'omw", boundary: ' ' });
      expect(res.action).toBe('replace');
      expect(res.replacement).toBe("d'on my way");
    });
  });

  describe('3. Personal Words Suppression', () => {
    it('suppresses correction for personal words', () => {
      const engine = createEngine({}, {
        personalWords: ['teh', 'mybrand'],
      });

      const res = engine.analyze({ token: 'teh', boundary: ' ' });
      expect(res.action).toBe('none');
      expect(res.reason).toBe('Personal dictionary match');

      const resBrand = engine.analyze({ token: 'mybrand', boundary: ' ' });
      expect(resBrand.action).toBe('none');
      expect(resBrand.reason).toBe('Personal dictionary match');
    });

    it('isKnownWord recognizes personal words', () => {
      const engine = createEngine({}, {
        personalWords: ['SuperCustomWord'],
      });

      expect(engine.isKnownWord('supercustomword')).toBe(true);
      expect(engine.isKnownWord('SuperCustomWord')).toBe(true);
      expect(engine.isKnownWord('unknownword')).toBe(false);
    });
  });

  describe('4. C6 Learning Privacy: Double-Rejection Learning & Ignore List', () => {
    it('tracks single rejection strictly in memory without storage write', async () => {
      const { promoted, count, settings } = await recordRejection('mytypo');
      expect(promoted).toBe(false);
      expect(count).toBe(1);
      expect(getMemoryRejectionCounts().get('mytypo')).toBe(1);
      // Not in persistent rejectedWords!
      expect(settings.rejectedWords).not.toContain('mytypo');
    });

    it('promotes word to rejectedWords upon second rejection', async () => {
      await recordRejection('mytypo');
      const { promoted, count, settings } = await recordRejection('mytypo');

      expect(promoted).toBe(true);
      expect(count).toBe(2);
      expect(settings.rejectedWords).toContain('mytypo');

      // Now verify engine suppresses autocorrection for rejectedWords
      const engine = createEngine({}, {
        rejectedWords: settings.rejectedWords,
      });

      const res = engine.analyze({ token: 'mytypo', boundary: ' ' });
      expect(res.action).toBe('none');
      expect(res.reason).toBe('Previously rejected token');
    });
  });

  describe('5. C6 Learning Privacy: Passive Learning Engine & Guardrails', () => {
    it('tracks in memory and promotes to personalWords on 3rd occurrence', async () => {
      // 1st time
      const res1 = await recordWordUsage('customtech');
      expect(res1.promoted).toBe(false);
      expect(res1.count).toBe(1);
      expect(getMemoryWordCounts().get('customtech')).toBe(1);
      expect(res1.settings.personalWords).not.toContain('customtech');

      // 2nd time
      const res2 = await recordWordUsage('customtech');
      expect(res2.promoted).toBe(false);
      expect(res2.count).toBe(2);
      expect(getMemoryWordCounts().get('customtech')).toBe(2);
      expect(res2.settings.personalWords).not.toContain('customtech');

      // 3rd time -> Promoted!
      const res3 = await recordWordUsage('customtech');
      expect(res3.promoted).toBe(true);
      expect(res3.count).toBe(3);
      expect(res3.settings.personalWords).toContain('customtech');

      // Engine treats customtech as a personal word
      const engine = createEngine({}, {
        personalWords: res3.settings.personalWords,
      });
      const decision = engine.analyze({ token: 'customtech', boundary: ' ' });
      expect(decision.action).toBe('none');
      expect(decision.reason).toBe('Personal dictionary match');
    });

    it('C6 Guardrail: ignores tokens shorter than 3 or longer than 24 chars', async () => {
      const resShort = await recordWordUsage('xy');
      expect(resShort.promoted).toBe(false);
      expect(getMemoryWordCounts().has('xy')).toBe(false);

      const resLong = await recordWordUsage('supercalifragilisticexpialidocious');
      expect(resLong.promoted).toBe(false);
      expect(getMemoryWordCounts().has('supercalifragilisticexpialidocious')).toBe(false);
    });

    it('C6 Guardrail: ignores camelCase, numeric, or punctuation-laden tokens', async () => {
      const resCamel = await recordWordUsage('iPhone');
      expect(resCamel.promoted).toBe(false);
      expect(getMemoryWordCounts().has('iphone')).toBe(false);

      const resNum = await recordWordUsage('tech123');
      expect(resNum.promoted).toBe(false);
      expect(getMemoryWordCounts().has('tech123')).toBe(false);
    });

    it('C6 Guardrail: caps personal dictionary at 2,000 entries', async () => {
      const largeList = Array.from({ length: MAX_PERSONAL_WORDS }, (_, i) => `word${i}`);
      await saveSettings(migrateSettings({ personalWords: largeList }));
      expect(getSettings().personalWords.length).toBe(MAX_PERSONAL_WORDS);

      // Attempt adding another word manually
      const updated = await addPersonalWord('overflowword');
      expect(updated.personalWords.length).toBe(MAX_PERSONAL_WORDS);
      expect(updated.personalWords).not.toContain('overflowword');
    });
  });

  describe('6. Dictionary Mutation Helpers', () => {
    it('adds and removes personal words', async () => {
      await addPersonalWord('DeepMind');
      expect(getSettings().personalWords).toContain('DeepMind');

      await removePersonalWord('deepmind');
      expect(getSettings().personalWords).not.toContain('DeepMind');
    });

    it('adds and removes shortcuts', async () => {
      await addShortcut('brb', 'be right back');
      expect(getSettings().shortcuts.some(s => s.trigger === 'brb' && s.replacement === 'be right back')).toBe(true);

      await removeShortcut('brb');
      expect(getSettings().shortcuts.some(s => s.trigger === 'brb')).toBe(false);
    });
  });

  describe('7. Phase 1.6 & 1.7: Settings Races & Passive Learning Controls', () => {
    it('handles concurrent frame updates without overwriting personalWords (get-merge-set)', async () => {
      // Simulate Frame A and Frame B adding personal words concurrently
      const p1 = addPersonalWord('FrameAWord');
      const p2 = addPersonalWord('FrameBWord');
      await Promise.all([p1, p2]);

      const current = getSettings().personalWords;
      expect(current).toContain('FrameAWord');
      expect(current).toContain('FrameBWord');
    });

    it('stores stats in its own key without rewriting settings or personalWords', async () => {
      await addPersonalWord('ProtectedWord');
      const { recordCorrection, getStats } = await import('../../entrypoints/content/settings');
      await recordCorrection();
      const stats = await getStats();
      expect(stats.corrections).toBeGreaterThan(0);
      expect(getSettings().personalWords).toContain('ProtectedWord');
    });

    it('respects learningEnabled setting to disable passive learning', async () => {
      await saveSettings(migrateSettings({ learningEnabled: false }));
      const res = await recordWordUsage('brandnewword');
      expect(res.promoted).toBe(false);
      expect(getMemoryWordCounts().has('brandnewword')).toBe(false);
    });
  });
});

