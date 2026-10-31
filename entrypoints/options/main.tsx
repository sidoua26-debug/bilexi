import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import {
  ExtensionSettings,
  DEFAULT_SETTINGS,
  migrateSettings,
  updateSettings,
  addPersonalWord,
  removePersonalWord,
  removeRejectedWord,
  addShortcut,
  removeShortcut,
} from '../content/settings';

type TabType = 'general' | 'words' | 'shortcuts' | 'sites' | 'about';

export function OptionsApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<TabType>('general');

  // Form states
  const [newWordInput, setNewWordInput] = useState('');
  const [wordSearchQuery, setWordSearchQuery] = useState('');
  const [newTriggerInput, setNewTriggerInput] = useState('');
  const [newReplacementInput, setNewReplacementInput] = useState('');
  const [newSiteInput, setNewSiteInput] = useState('');
  const [notification, setNotification] = useState<string | null>(null);

  const importWordsFileRef = useRef<HTMLInputElement>(null);
  const importShortcutsFileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get('settings', (res) => {
        if (res && res.settings) {
          setSettings(migrateSettings(res.settings));
        }
      });

      const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
        if (areaName === 'local' && changes.settings && changes.settings.newValue) {
          setSettings(migrateSettings(changes.settings.newValue));
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
  }, []);

  const handleUpdate = async (updates: Partial<ExtensionSettings>) => {
    const updated = await updateSettings(updates);
    setSettings(updated);
  };

  const handleAddWord = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newWordInput.trim();
    if (!trimmed) return;
    const updated = await addPersonalWord(trimmed);
    setSettings(updated);
    setNewWordInput('');
    showToast(`Added "${trimmed}" to personal dictionary`);
  };

  const handleRemoveWord = async (word: string) => {
    const updated = await removePersonalWord(word);
    setSettings(updated);
    showToast(`Removed "${word}"`);
  };

  const handleRemoveRejectedWord = async (word: string) => {
    const updated = await removeRejectedWord(word);
    setSettings(updated);
    showToast(`Unblocked "${word}"`);
  };

  const handleExportWords = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settings.personalWords, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'personal_words.json');
    dlAnchor.click();
    showToast('Exported personal words JSON');
  };

  const handleImportWords = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        let wordsToAdd: string[] = [];
        if (Array.isArray(parsed)) {
          wordsToAdd = parsed.filter(w => typeof w === 'string' && w.trim().length > 0);
        } else if (parsed && Array.isArray(parsed.personalWords)) {
          wordsToAdd = parsed.personalWords.filter((w: any) => typeof w === 'string' && w.trim().length > 0);
        }

        if (wordsToAdd.length === 0) {
          showToast('No valid words found in JSON file');
          return;
        }

        const existingSet = new Set(settings.personalWords.map(w => w.toLowerCase()));
        const uniqueNew = wordsToAdd.filter(w => !existingSet.has(w.trim().toLowerCase()));
        const merged = [...settings.personalWords, ...uniqueNew.map(w => w.trim())];
        const updated = await updateSettings({ personalWords: merged });
        setSettings(updated);
        showToast(`Imported ${uniqueNew.length} new words (${merged.length} total)`);
      } catch (err) {
        showToast('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClearPersonalWords = async () => {
    if (window.confirm('Are you sure you want to clear your entire personal dictionary?')) {
      const updated = await updateSettings({ personalWords: [] });
      setSettings(updated);
      showToast('Cleared personal dictionary');
    }
  };

  const handleClearRejectedWords = async () => {
    if (window.confirm('Are you sure you want to clear all ignored words? Autocorrect will be re-enabled for them.')) {
      const updated = await updateSettings({ rejectedWords: [] });
      setSettings(updated);
      showToast('Cleared ignored words list');
    }
  };

  const handleAddShortcut = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trigger = newTriggerInput.trim();
    const repl = newReplacementInput.trim();
    if (!trigger || !repl) return;

    const updated = await addShortcut(trigger, repl);
    setSettings(updated);
    setNewTriggerInput('');
    setNewReplacementInput('');
    showToast(`Added shortcut "${trigger}" → "${repl}"`);
  };

  const handleRemoveShortcut = async (trigger: string) => {
    const updated = await removeShortcut(trigger);
    setSettings(updated);
    showToast(`Removed shortcut "${trigger}"`);
  };

  const handleExportShortcuts = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settings.shortcuts, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', 'shortcuts.json');
    dlAnchor.click();
    showToast('Exported shortcuts JSON');
  };

  const handleImportShortcuts = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          showToast('Invalid format: expected array of { trigger, replacement }');
          return;
        }

        const validShortcuts = parsed
          .filter(item => item && typeof item.trigger === 'string' && typeof item.replacement === 'string')
          .map(item => ({ trigger: item.trigger.trim(), replacement: item.replacement.trim() }))
          .filter(item => item.trigger && item.replacement);

        const shortcutMap = new Map<string, string>();
        for (const s of settings.shortcuts) {
          shortcutMap.set(s.trigger.toLowerCase(), s.replacement);
        }
        for (const s of validShortcuts) {
          shortcutMap.set(s.trigger.toLowerCase(), s.replacement);
        }

        const merged = Array.from(shortcutMap.entries()).map(([trigger, replacement]) => ({ trigger, replacement }));
        const updated = await updateSettings({ shortcuts: merged });
        setSettings(updated);
        showToast(`Imported shortcuts (${merged.length} total)`);
      } catch {
        showToast('Failed to parse shortcuts JSON');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddSite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const site = newSiteInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!site) return;

    if (!settings.disabledSites.some(s => s.toLowerCase() === site)) {
      const updated = await updateSettings({ disabledSites: [...settings.disabledSites, site] });
      setSettings(updated);
      setNewSiteInput('');
      showToast(`Added "${site}" to disabled sites`);
    }
  };

  const handleRemoveSite = async (site: string) => {
    const updated = await updateSettings({
      disabledSites: settings.disabledSites.filter(s => s.toLowerCase() !== site.toLowerCase()),
    });
    setSettings(updated);
    showToast(`Removed "${site}"`);
  };

  const filteredPersonalWords = settings.personalWords.filter(w =>
    w.toLowerCase().includes(wordSearchQuery.trim().toLowerCase())
  );

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 20px', width: '100%' }}>
      {/* Header */}
      <header style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>🌐 Bilexi</span>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 9999, background: 'var(--accent-bg)', color: 'var(--accent)', fontWeight: 600 }}>
              Settings v2.0
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
            100% offline bilingual English & French autocorrect engine
          </p>
        </div>

        {/* Global Master Switch */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'var(--bg-card)', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Extension Active</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleUpdate({ enabled: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: 'var(--accent)' }}
          />
        </label>
      </header>

      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'var(--bg-card)',
          color: 'var(--text-primary)',
          border: '1px solid var(--accent)',
          borderRadius: 8,
          padding: '10px 18px',
          fontSize: 13,
          boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease-out',
        }}>
          ✓ {notification}
        </div>
      )}

      {/* Tab Navigation */}
      <nav role="tablist" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: 24, gap: 4 }}>
        {[
          { id: 'general', label: 'General' },
          { id: 'words', label: `My Words (${settings.personalWords.length})` },
          { id: 'shortcuts', label: `Shortcuts (${settings.shortcuts.length})` },
          { id: 'sites', label: `Disabled Sites (${settings.disabledSites.length})` },
          { id: 'about', label: 'About & Licences' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id as TabType)}
              style={{
                background: 'none',
                border: 'none',
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Tab 1: General */}
      {activeTab === 'general' && (
        <section role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Engine Parameters Card */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Engine Preferences</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
              {/* Language Mode */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Language Mode
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { val: 'auto', label: 'Auto (Bilingual EN/FR detection)' },
                    { val: 'en', label: 'English Only' },
                    { val: 'fr', label: 'French Only (Français)' },
                    { val: 'en+fr', label: 'Combined Bilingual' },
                  ].map((mode) => (
                    <label key={mode.val} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="languageMode"
                        value={mode.val}
                        checked={settings.languageMode === mode.val}
                        onChange={() => handleUpdate({ languageMode: mode.val as any })}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      {mode.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Sensitivity */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8, color: 'var(--text-secondary)' }}>
                  Autocorrect Sensitivity
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { val: 'cautious', label: 'Cautious (High threshold, few corrections)' },
                    { val: 'balanced', label: 'Balanced (Standard default, D≤2)' },
                    { val: 'bold', label: 'Bold (Aggressive, corrects close phonetic variants)' },
                  ].map((sens) => (
                    <label key={sens.val} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="sensitivity"
                        value={sens.val}
                        checked={settings.sensitivity === sens.val}
                        onChange={() => handleUpdate({ sensitivity: sens.val as any })}
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      {sens.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '20px 0' }} />

            {/* Formatting & Behavior */}
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Typography & Behavior</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.sentenceCaps}
                  onChange={(e) => handleUpdate({ sentenceCaps: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Sentence initial capitalization (capitalize first letter after terminal punctuation)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.fixLoneI}
                  onChange={(e) => handleUpdate({ fixLoneI: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Capitalize standalone pronoun &quot;i&quot; → &quot;I&quot;
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.showUndoChip}
                  onChange={(e) => handleUpdate({ showUndoChip: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Show floating undo chip after applied corrections
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.typographicApostrophe}
                  onChange={(e) => handleUpdate({ typographicApostrophe: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Use typographic curly apostrophe (&rsquo;) instead of straight apostrophe (&apos;)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.showSuggestions}
                  onChange={(e) => handleUpdate({ showSuggestions: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Show phone-style 3-candidate suggestion strip above caret
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.suggestOnlyMisspelled}
                  onChange={(e) => handleUpdate({ suggestOnlyMisspelled: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Only show suggestion strip when current token is not a known word
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.learningEnabled}
                  onChange={(e) => handleUpdate({ learningEnabled: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Enable passive learning (automatically add novel words to personal dictionary after typing them 3 times)
              </label>
            </div>
          </div>

          {/* Statistics Card */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>Usage & Learning Statistics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
              <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{settings.stats.corrections.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Total Corrections</div>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b' }}>{settings.stats.reverts.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Reverted Corrections</div>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{settings.personalWords.length.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Personal Words</div>
              </div>
              <div style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--danger)' }}>{settings.rejectedWords.length.toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Ignored Words</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Tab 2: My Words */}
      {activeTab === 'words' && (
        <section role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Personal Words */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Personal Dictionary</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Words here are never autocorrected or flagged as mistakes. Includes words passively learned (3x typed).
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="file"
                  accept=".json"
                  ref={importWordsFileRef}
                  style={{ display: 'none' }}
                  onChange={handleImportWords}
                />
                <button
                  onClick={() => importWordsFileRef.current?.click()}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  Import JSON
                </button>
                <button
                  onClick={handleExportWords}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  Export JSON
                </button>
                {settings.personalWords.length > 0 && (
                  <button
                    onClick={handleClearPersonalWords}
                    style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Add Word Form */}
            <form onSubmit={handleAddWord} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Add custom word (e.g. surname, jargon, brand)..."
                value={newWordInput}
                onChange={(e) => setNewWordInput(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 13 }}
              />
              <button
                type="submit"
                style={{ background: 'var(--accent)', color: '#000', fontWeight: 600, border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
              >
                Add Word
              </button>
            </form>

            {/* Search Filter */}
            {settings.personalWords.length > 5 && (
              <input
                type="text"
                placeholder="Search words..."
                value={wordSearchQuery}
                onChange={(e) => setWordSearchQuery(e.target.value)}
                style={{ width: '100%', marginBottom: 14, padding: '6px 12px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 12 }}
              />
            )}

            {/* Words Chips List */}
            {filteredPersonalWords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                {settings.personalWords.length === 0 ? 'No custom words added yet.' : 'No matching words found.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
                {filteredPersonalWords.map((word) => (
                  <span
                    key={word}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      padding: '4px 10px',
                      borderRadius: 9999,
                      fontSize: 12,
                    }}
                  >
                    <span>{word}</span>
                    <button
                      onClick={() => handleRemoveWord(word)}
                      title={`Remove ${word}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Ignored Words (Rejected Words) */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Ignored Words (Double-Rejection)</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Words you have rejected twice with Backspace or Undo. Autocorrect is permanently suppressed for these tokens.
                </p>
              </div>

              {settings.rejectedWords.length > 0 && (
                <button
                  onClick={handleClearRejectedWords}
                  style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  Clear Ignored
                </button>
              )}
            </div>

            {settings.rejectedWords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '18px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                No ignored words. When you revert an autocorrect twice, the word will appear here.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 200, overflowY: 'auto', padding: '4px 0' }}>
                {settings.rejectedWords.map((word) => (
                  <span
                    key={word}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: 'var(--text-primary)',
                      padding: '4px 10px',
                      borderRadius: 9999,
                      fontSize: 12,
                    }}
                  >
                    <span>{word}</span>
                    <button
                      onClick={() => handleRemoveRejectedWord(word)}
                      title={`Allow autocorrect for ${word}`}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        padding: '0 2px',
                        fontSize: 14,
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 3: Shortcuts */}
      {activeTab === 'shortcuts' && (
        <section role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600 }}>Text Expansion Shortcuts</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Type the trigger followed by space or punctuation to expand into the full text. Capitalization adapts automatically.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="file"
                  accept=".json"
                  ref={importShortcutsFileRef}
                  style={{ display: 'none' }}
                  onChange={handleImportShortcuts}
                />
                <button
                  onClick={() => importShortcutsFileRef.current?.click()}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  Import JSON
                </button>
                <button
                  onClick={handleExportShortcuts}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                >
                  Export JSON
                </button>
              </div>
            </div>

            {/* Add Shortcut Form */}
            <form onSubmit={handleAddShortcut} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 10, marginBottom: 18 }}>
              <input
                type="text"
                placeholder="Trigger (e.g. omw)"
                value={newTriggerInput}
                onChange={(e) => setNewTriggerInput(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 13 }}
              />
              <input
                type="text"
                placeholder="Replacement text (e.g. on my way)"
                value={newReplacementInput}
                onChange={(e) => setNewReplacementInput(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 13 }}
              />
              <button
                type="submit"
                style={{ background: 'var(--accent)', color: '#000', fontWeight: 600, border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
              >
                Add Shortcut
              </button>
            </form>

            {/* Shortcuts Table */}
            {settings.shortcuts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                No shortcuts defined yet. Add your first text replacement above!
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 12px', width: '25%' }}>Trigger</th>
                      <th style={{ padding: '8px 12px', width: '60%' }}>Replacement</th>
                      <th style={{ padding: '8px 12px', width: '15%', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settings.shortcuts.map((shortcut) => (
                      <tr key={shortcut.trigger} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 600 }}>
                          {shortcut.trigger}
                        </td>
                        <td style={{ padding: '10px 12px' }}>{shortcut.replacement}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleRemoveShortcut(shortcut.trigger)}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Tab 4: Disabled Sites */}
      {activeTab === 'sites' && (
        <section role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Disabled Websites</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Autocorrect is completely deactivated on these domains and all of their subdomains.
            </p>

            <form onSubmit={handleAddSite} style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              <input
                type="text"
                placeholder="Domain to disable (e.g. github.com, mail.google.com)..."
                value={newSiteInput}
                onChange={(e) => setNewSiteInput(e.target.value)}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 6, background: 'var(--bg-input)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: 13 }}
              />
              <button
                type="submit"
                style={{ background: 'var(--accent)', color: '#000', fontWeight: 600, border: 'none', padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}
              >
                Disable Domain
              </button>
            </form>

            {settings.disabledSites.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                No sites disabled. Autocorrect runs on all eligible text fields.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {settings.disabledSites.map((site) => (
                  <li
                    key={site}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-color)',
                      padding: '8px 14px',
                      borderRadius: 6,
                      fontSize: 13,
                    }}
                  >
                    <span>{site}</span>
                    <button
                      onClick={() => handleRemoveSite(site)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}
                    >
                      Re-enable
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      {/* Tab 5: About & Licenses */}
      {activeTab === 'about' && (
        <section role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 20, border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>About Bilexi</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
              Version <strong>0.5.0</strong>. Designed for privacy-first, zero-latency typing in English and French.
            </p>

            <div style={{ background: 'var(--bg-input)', padding: 14, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>
                🔒 100% Offline & Private Guarantee
              </h3>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                All dictionaries, language models, Bloom filters, and candidate rankers run entirely in local client memory.
                Zero keystrokes, personal words, or hostnames are ever transmitted over the network.
                Permissions are strictly scoped to local storage and active tab detection.
              </p>
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Third-Party Licences & Attributions</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: 6 }}>
                • <strong>Lexique 3.83</strong> — Boris New &amp; Christophe Pallier (CC BY-SA 4.0). Used under Creative Commons Attribution-ShareAlike 4.0 International License.
              </p>
              <p style={{ marginBottom: 6 }}>
                • <strong>SCOWL (Spell Checking Oriented Word Lists) &amp; WordNet</strong> — Kevin Atkinson and Princeton University (SCOWL / BSD-style permissive licenses).
              </p>
              <p style={{ marginBottom: 6 }}>
                • <strong>Dicollecte / French Hunspell</strong> — Olivier R. (MPL-2.0).
              </p>
              <p>
                • <strong>WXT, React &amp; Floating UI</strong> — MIT License.
              </p>
            </div>

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-color)' }}>
              <a
                href={typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL('notices.html') : 'notices.html'}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent)', fontSize: 13, textDecoration: 'underline', fontWeight: 500 }}
              >
                View Full Third-Party Notices &amp; Open Source Licenses (offline) &rarr;
              </a>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<OptionsApp />);
}
