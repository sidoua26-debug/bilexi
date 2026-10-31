/**
 * Settings Management for Content Script and Options: entrypoints/content/settings.ts
 */

export interface TextShortcut {
  trigger: string;
  replacement: string;
}

export interface ExtensionSettings {
  version: number; // 2
  enabled: boolean;
  disabledSites: string[];
  languageMode: 'auto' | 'en' | 'fr' | 'en+fr';
  sensitivity: 'cautious' | 'balanced' | 'bold';
  sentenceCaps: boolean;
  fixLoneI: boolean;
  showUndoChip: boolean;
  typographicApostrophe: boolean;
  showSuggestions: boolean;
  suggestOnlyMisspelled: boolean;
  maxSuggestions: number;
  personalWords: string[];
  rejectedWords: string[];
  shortcuts: TextShortcut[];
  learningEnabled: boolean;
  capitalizeFieldStart: boolean;
  stats: {
    corrections: number;
    reverts: number;
  };
}

export interface ExtensionStats {
  corrections: number;
  reverts: number;
}

export const MAX_PERSONAL_WORDS = 2000;

export const DEFAULT_STATS: ExtensionStats = {
  corrections: 0,
  reverts: 0,
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  version: 2,
  enabled: true,
  disabledSites: [],
  languageMode: 'auto',
  sensitivity: 'balanced',
  sentenceCaps: true,
  fixLoneI: true,
  showUndoChip: true,
  typographicApostrophe: false,
  showSuggestions: true,
  suggestOnlyMisspelled: true,
  maxSuggestions: 3,
  personalWords: [],
  rejectedWords: [],
  shortcuts: [
    { trigger: 'omw', replacement: 'on my way' },
  ],
  learningEnabled: true,
  capitalizeFieldStart: false,
  stats: {
    corrections: 0,
    reverts: 0,
  },
};

let currentSettings: ExtensionSettings = { ...DEFAULT_SETTINGS };
let currentStats: ExtensionStats = { ...DEFAULT_STATS };
let statsWriteTimeout: any = null;

// C6 Privacy: Pre-promotion counters live strictly in volatile memory. Never written to storage.local.
const memoryWordCounts = new Map<string, number>();
const memoryRejectionCounts = new Map<string, number>();

export function getMemoryWordCounts(): ReadonlyMap<string, number> {
  return memoryWordCounts;
}

export function getMemoryRejectionCounts(): ReadonlyMap<string, number> {
  return memoryRejectionCounts;
}

export function resetMemoryLearningCounters(): void {
  memoryWordCounts.clear();
  memoryRejectionCounts.clear();
}

export function getSettings(): Readonly<ExtensionSettings> {
  return currentSettings;
}

export function isSiteDisabled(hostname: string = typeof window !== 'undefined' ? window.location?.hostname || '' : ''): boolean {
  if (!currentSettings.enabled) return true;
  if (!hostname) return false;
  return currentSettings.disabledSites.some(site => {
    if (!site) return false;
    const cleanSite = site.trim().toLowerCase();
    return hostname.toLowerCase() === cleanSite || hostname.toLowerCase().endsWith('.' + cleanSite);
  });
}

export function migrateSettings(raw: any): ExtensionSettings {
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_SETTINGS,
      shortcuts: [...DEFAULT_SETTINGS.shortcuts],
      personalWords: [],
      rejectedWords: [],
      disabledSites: [],
      stats: { corrections: 0, reverts: 0 },
    };
  }

  const base: ExtensionSettings = {
    version: 2,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_SETTINGS.enabled,
    disabledSites: Array.isArray(raw.disabledSites) ? [...raw.disabledSites] : [...DEFAULT_SETTINGS.disabledSites],
    languageMode: ['auto', 'en', 'fr', 'en+fr'].includes(raw.languageMode) ? raw.languageMode : DEFAULT_SETTINGS.languageMode,
    sensitivity: ['cautious', 'balanced', 'bold'].includes(raw.sensitivity) ? raw.sensitivity : DEFAULT_SETTINGS.sensitivity,
    sentenceCaps: typeof raw.sentenceCaps === 'boolean' ? raw.sentenceCaps : DEFAULT_SETTINGS.sentenceCaps,
    fixLoneI: typeof raw.fixLoneI === 'boolean' ? raw.fixLoneI : DEFAULT_SETTINGS.fixLoneI,
    showUndoChip: typeof raw.showUndoChip === 'boolean' ? raw.showUndoChip : DEFAULT_SETTINGS.showUndoChip,
    typographicApostrophe: typeof raw.typographicApostrophe === 'boolean' ? raw.typographicApostrophe : DEFAULT_SETTINGS.typographicApostrophe,
    showSuggestions: typeof raw.showSuggestions === 'boolean' ? raw.showSuggestions : DEFAULT_SETTINGS.showSuggestions,
    suggestOnlyMisspelled: typeof raw.suggestOnlyMisspelled === 'boolean' ? raw.suggestOnlyMisspelled : DEFAULT_SETTINGS.suggestOnlyMisspelled,
    maxSuggestions: typeof raw.maxSuggestions === 'number' ? Math.min(5, Math.max(1, raw.maxSuggestions)) : DEFAULT_SETTINGS.maxSuggestions,
    personalWords: Array.isArray(raw.personalWords) ? raw.personalWords.slice(0, MAX_PERSONAL_WORDS) : [...DEFAULT_SETTINGS.personalWords],
    rejectedWords: Array.isArray(raw.rejectedWords) ? [...raw.rejectedWords] : [...DEFAULT_SETTINGS.rejectedWords],
    shortcuts: Array.isArray(raw.shortcuts)
      ? raw.shortcuts.map((s: any) => ({ trigger: String(s.trigger || ''), replacement: String(s.replacement || '') }))
      : [...DEFAULT_SETTINGS.shortcuts],
    learningEnabled: typeof raw.learningEnabled === 'boolean' ? raw.learningEnabled : DEFAULT_SETTINGS.learningEnabled,
    capitalizeFieldStart: typeof raw.capitalizeFieldStart === 'boolean' ? raw.capitalizeFieldStart : DEFAULT_SETTINGS.capitalizeFieldStart,
    stats: {
      corrections: typeof raw.stats?.corrections === 'number' ? raw.stats.corrections : 0,
      reverts: typeof raw.stats?.reverts === 'number' ? raw.stats.reverts : 0,
    },
  };

  return base;
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  currentSettings = { ...settings };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      await chrome.storage.local.set({ settings: currentSettings });
    } catch (err) {
      console.warn('[bilingual-autocorrect] Failed to save settings:', err);
    }
  }
}

export async function updateSettings(updates: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const merged = migrateSettings({ ...currentSettings, ...updates });
  await saveSettings(merged);
  return currentSettings;
}

export async function addPersonalWord(word: string): Promise<ExtensionSettings> {
  const trimmed = word.trim();
  if (!trimmed) return currentSettings;
  const lower = trimmed.toLowerCase();

  let fresh = { ...currentSettings };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get('settings');
      if (stored?.settings) {
        fresh = migrateSettings(stored.settings);
      }
    } catch {}
  }

  if (fresh.personalWords.length >= MAX_PERSONAL_WORDS) {
    return currentSettings;
  }

  const exists = fresh.personalWords.some(w => w.toLowerCase() === lower);
  if (!exists) {
    const newRejected = fresh.rejectedWords.filter(w => w.toLowerCase() !== lower);
    const updated = {
      ...fresh,
      personalWords: [...fresh.personalWords, trimmed],
      rejectedWords: newRejected,
    };
    await saveSettings(updated);
  }
  return currentSettings;
}

export async function removePersonalWord(word: string): Promise<ExtensionSettings> {
  const lower = word.trim().toLowerCase();
  let fresh = { ...currentSettings };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get('settings');
      if (stored?.settings) {
        fresh = migrateSettings(stored.settings);
      }
    } catch {}
  }

  const updated = {
    ...fresh,
    personalWords: fresh.personalWords.filter(w => w.toLowerCase() !== lower),
  };
  await saveSettings(updated);
  return currentSettings;
}

export async function addRejectedWord(word: string): Promise<ExtensionSettings> {
  const trimmed = word.trim();
  if (!trimmed) return currentSettings;
  const lower = trimmed.toLowerCase();

  let fresh = { ...currentSettings };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get('settings');
      if (stored?.settings) fresh = migrateSettings(stored.settings);
    } catch {}
  }

  const exists = fresh.rejectedWords.some(w => w.toLowerCase() === lower);
  if (!exists) {
    const updated = {
      ...fresh,
      rejectedWords: [...fresh.rejectedWords, trimmed],
    };
    await saveSettings(updated);
  }
  return currentSettings;
}

export async function removeRejectedWord(word: string): Promise<ExtensionSettings> {
  const lower = word.trim().toLowerCase();
  let fresh = { ...currentSettings };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get('settings');
      if (stored?.settings) fresh = migrateSettings(stored.settings);
    } catch {}
  }

  const updated = {
    ...fresh,
    rejectedWords: fresh.rejectedWords.filter(w => w.toLowerCase() !== lower),
  };
  await saveSettings(updated);
  return currentSettings;
}

export async function addShortcut(trigger: string, replacement: string): Promise<ExtensionSettings> {
  const cleanTrigger = trigger.trim();
  const cleanRepl = replacement.trim();
  if (!cleanTrigger || !cleanRepl) return currentSettings;

  let fresh = { ...currentSettings };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get('settings');
      if (stored?.settings) fresh = migrateSettings(stored.settings);
    } catch {}
  }

  const existingIdx = fresh.shortcuts.findIndex(
    s => s.trigger.toLowerCase() === cleanTrigger.toLowerCase()
  );
  const newShortcuts = [...fresh.shortcuts];
  if (existingIdx >= 0) {
    newShortcuts[existingIdx] = { trigger: cleanTrigger, replacement: cleanRepl };
  } else {
    newShortcuts.push({ trigger: cleanTrigger, replacement: cleanRepl });
  }

  const updated = { ...fresh, shortcuts: newShortcuts };
  await saveSettings(updated);
  return currentSettings;
}

export async function removeShortcut(trigger: string): Promise<ExtensionSettings> {
  const cleanTrigger = trigger.trim().toLowerCase();
  let fresh = { ...currentSettings };
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get('settings');
      if (stored?.settings) fresh = migrateSettings(stored.settings);
    } catch {}
  }

  const updated = {
    ...fresh,
    shortcuts: fresh.shortcuts.filter(s => s.trigger.toLowerCase() !== cleanTrigger),
  };
  await saveSettings(updated);
  return currentSettings;
}

export async function getStats(): Promise<ExtensionStats> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const stored = await chrome.storage.local.get('stats');
      if (stored?.stats) {
        currentStats = {
          corrections: typeof stored.stats.corrections === 'number' ? stored.stats.corrections : 0,
          reverts: typeof stored.stats.reverts === 'number' ? stored.stats.reverts : 0,
        };
        currentSettings.stats = { ...currentStats };
      }
    } catch {}
  }
  return { ...currentStats };
}

function scheduleStatsFlush(): void {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  if (statsWriteTimeout) clearTimeout(statsWriteTimeout);
  statsWriteTimeout = setTimeout(async () => {
    try {
      await chrome.storage.local.set({ stats: currentStats });
    } catch (err) {
      console.warn('[bilingual-autocorrect] Failed to flush stats:', err);
    }
  }, 500);
}

export async function recordCorrection(): Promise<void> {
  currentStats = {
    ...currentStats,
    corrections: currentStats.corrections + 1,
  };
  currentSettings.stats = { ...currentStats };
  scheduleStatsFlush();
}

export async function recordRevert(): Promise<void> {
  currentStats = {
    ...currentStats,
    reverts: currentStats.reverts + 1,
  };
  currentSettings.stats = { ...currentStats };
  scheduleStatsFlush();
}

/**
 * C6 Double-Rejection: Pre-promotion count is stored strictly in memory.
 * Only upon 2nd rejection does it get persisted to rejectedWords.
 */
export async function recordRejection(word: string): Promise<{ promoted: boolean; count: number; settings: ExtensionSettings }> {
  const lower = word.trim().toLowerCase();
  if (!lower) return { promoted: false, count: 0, settings: currentSettings };

  const prevCount = memoryRejectionCounts.get(lower) || 0;
  const newCount = prevCount + 1;
  memoryRejectionCounts.set(lower, newCount);

  let promoted = false;
  // Double rejection: 2nd rejection permanently promotes to rejectedWords in storage
  if (newCount >= 2) {
    let fresh = { ...currentSettings };
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get('settings');
        if (stored?.settings) fresh = migrateSettings(stored.settings);
      } catch {}
    }

    if (!fresh.rejectedWords.some(w => w.toLowerCase() === lower)) {
      const newRejectedWords = [...fresh.rejectedWords, word.trim()];
      const updated: ExtensionSettings = {
        ...fresh,
        rejectedWords: newRejectedWords,
      };
      await saveSettings(updated);
      promoted = true;
    }
  }

  return { promoted, count: newCount, settings: currentSettings };
}

/**
 * C6 Passive Learning: Pre-promotion count is stored strictly in memory.
 * Guardrails: length 3 to 24, strictly alphabetical, no camelCase, no numerals.
 * Only upon 3rd usage does it get persisted to personalWords (capped at 2,000).
 */
export async function recordWordUsage(word: string): Promise<{ promoted: boolean; count: number; settings: ExtensionSettings }> {
  if (!currentSettings.learningEnabled) {
    return { promoted: false, count: 0, settings: currentSettings };
  }

  const trimmed = word.trim();
  // Length 3 to 24, strictly alphabetical
  if (trimmed.length < 3 || trimmed.length > 24) {
    return { promoted: false, count: 0, settings: currentSettings };
  }
  if (!/^[a-zA-Zàâäéèêëîïôöùûüçœæ'-]+$/.test(trimmed)) {
    return { promoted: false, count: 0, settings: currentSettings };
  }
  // No internal camelCase (e.g. iPhone, macBook)
  if (/[a-z][A-Z]/.test(trimmed)) {
    return { promoted: false, count: 0, settings: currentSettings };
  }

  const lower = trimmed.toLowerCase();
  const prevCount = memoryWordCounts.get(lower) || 0;
  const newCount = prevCount + 1;
  memoryWordCounts.set(lower, newCount);

  let promoted = false;
  // Passive learning: 3rd usage automatically promotes to personalWords in storage (up to cap)
  if (newCount >= 3) {
    let fresh = { ...currentSettings };
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      try {
        const stored = await chrome.storage.local.get('settings');
        if (stored?.settings) fresh = migrateSettings(stored.settings);
      } catch {}
    }

    if (fresh.personalWords.length < MAX_PERSONAL_WORDS && !fresh.personalWords.some(w => w.toLowerCase() === lower)) {
      const newPersonalWords = [...fresh.personalWords, trimmed];
      const updated: ExtensionSettings = {
        ...fresh,
        personalWords: newPersonalWords,
      };
      await saveSettings(updated);
      promoted = true;
    }
  }

  return { promoted, count: newCount, settings: currentSettings };
}

export async function loadSettings(): Promise<ExtensionSettings> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return currentSettings;
  }

  try {
    const stored = await chrome.storage.local.get(['settings', 'stats']);
    if (stored && stored.settings) {
      currentSettings = migrateSettings(stored.settings);
      if (stored.settings.version !== currentSettings.version) {
        await chrome.storage.local.set({ settings: currentSettings });
      }
    }
    if (stored && stored.stats) {
      currentStats = {
        corrections: typeof stored.stats.corrections === 'number' ? stored.stats.corrections : 0,
        reverts: typeof stored.stats.reverts === 'number' ? stored.stats.reverts : 0,
      };
      currentSettings.stats = { ...currentStats };
    }
  } catch (err) {
    console.warn('[bilingual-autocorrect] Failed to load settings from storage:', err);
  }

  return currentSettings;
}

export function subscribeToSettings(onChange?: (settings: ExtensionSettings) => void): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return () => {};
  }

  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && changes.settings && changes.settings.newValue) {
      currentSettings = migrateSettings(changes.settings.newValue);
      if (onChange) onChange(currentSettings);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}
