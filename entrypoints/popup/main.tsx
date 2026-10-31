import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import {
  ExtensionSettings,
  DEFAULT_SETTINGS,
  migrateSettings,
} from '../content/settings';

export function PopupApp() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [loaded, setLoaded] = useState(false);
  const [statusText, setStatusText] = useState<string>('Engine: Ready');

  useEffect(() => {
    // 1. Load active tab domain
    if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const urlStr = tabs[0]?.url;
        if (urlStr) {
          try {
            const url = new URL(urlStr);
            if (url.hostname) setCurrentDomain(url.hostname);
          } catch {
            // Non-URL tab
          }
        }
      });
    }

    // 2. Load settings from storage
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get('settings', (res) => {
        if (res && res.settings) {
          setSettings(migrateSettings(res.settings));
        }
        setLoaded(true);
      });
    } else {
      setLoaded(true);
    }

    // 3. Load live engine state via messaging and session storage (never from manifest)
    const handleStatus = (statusRes: { status: string; wordCountEn?: number; wordCountFr?: number; error?: string }) => {
      if (!statusRes) return;
      if (statusRes.status === 'ready') {
        const enWords = statusRes.wordCountEn ? statusRes.wordCountEn.toLocaleString() : '26,500';
        const frWords = statusRes.wordCountFr ? statusRes.wordCountFr.toLocaleString() : '26,500';
        setStatusText(`Engine: Ready · EN (${enWords}) + FR (${frWords})`);
      } else if (statusRes.status === 'error') {
        setStatusText(`Engine Error: ${statusRes.error || 'Failed to load'}`);
      } else {
        setStatusText('Engine: Loading...');
      }
    };

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_ENGINE_STATUS' }, (res) => {
        if (chrome.runtime.lastError || !res) {
          if (chrome.storage?.session) {
            chrome.storage.session.get('engineStatus', (sessionRes) => {
              if (sessionRes?.engineStatus) handleStatus(sessionRes.engineStatus);
            });
          }
        } else {
          handleStatus(res);
        }
      });
    }
  }, []);

  const updateSettings = (updates: Partial<ExtensionSettings>) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ settings: updated });
    }
  };

  const isCurrentSiteDisabled = currentDomain
    ? settings.disabledSites.some(site => currentDomain === site || currentDomain.endsWith('.' + site))
    : false;

  const toggleCurrentSite = () => {
    if (!currentDomain) return;
    let nextDisabledSites: string[];
    if (isCurrentSiteDisabled) {
      nextDisabledSites = settings.disabledSites.filter(s => s !== currentDomain);
    } else {
      nextDisabledSites = [...settings.disabledSites, currentDomain];
    }
    updateSettings({ disabledSites: nextDisabledSites });
  };

  if (!loaded) {
    return <div style={{ width: 320, padding: 20, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;
  }

  return (
    <div
      style={{
        width: 320,
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 13,
        padding: '16px',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* Header & Master Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#f8fafc' }}>Bilexi</div>
          <div style={{ fontSize: 11, color: '#38bdf8' }}>Offline · EN + FR</div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => updateSettings({ enabled: e.target.checked })}
            style={{ display: 'none' }}
          />
          <div
            style={{
              width: 40,
              height: 22,
              backgroundColor: settings.enabled ? '#0284c7' : '#334155',
              borderRadius: 11,
              position: 'relative',
              transition: 'background-color 150ms ease',
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                backgroundColor: '#ffffff',
                borderRadius: '50%',
                position: 'absolute',
                top: 2,
                left: settings.enabled ? 20 : 2,
                transition: 'left 150ms ease',
              }}
            />
          </div>
        </label>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #1e293b', margin: '12px 0' }} />

      {/* Current Site Status */}
      {currentDomain && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 190 }}>
              {currentDomain}
            </span>
            <button
              type="button"
              onClick={toggleCurrentSite}
              style={{
                background: isCurrentSiteDisabled ? '#dc2626' : '#1e293b',
                color: '#f8fafc',
                border: '1px solid #334155',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              {isCurrentSiteDisabled ? 'Enable Site' : 'Disable Site'}
            </button>
          </div>
        </div>
      )}

      {/* Language Mode Selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>LANGUAGE MODE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {(['auto', 'en', 'fr', 'en+fr'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateSettings({ languageMode: mode })}
              style={{
                backgroundColor: settings.languageMode === mode ? '#0284c7' : '#1e293b',
                color: settings.languageMode === mode ? '#ffffff' : '#94a3b8',
                border: '1px solid #334155',
                borderRadius: 4,
                padding: '5px 0',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: settings.languageMode === mode ? 600 : 400,
                textTransform: 'uppercase',
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Sensitivity Selector */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>SENSITIVITY</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
          {(['cautious', 'balanced', 'bold'] as const).map((sens) => (
            <button
              key={sens}
              type="button"
              onClick={() => updateSettings({ sensitivity: sens })}
              style={{
                backgroundColor: settings.sensitivity === sens ? '#0284c7' : '#1e293b',
                color: settings.sensitivity === sens ? '#ffffff' : '#94a3b8',
                border: '1px solid #334155',
                borderRadius: 4,
                padding: '5px 0',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: settings.sensitivity === sens ? 600 : 400,
                textTransform: 'capitalize',
              }}
            >
              {sens}
            </button>
          ))}
        </div>
      </div>

      {/* Feature Toggles */}
      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={settings.sentenceCaps}
            onChange={(e) => updateSettings({ sentenceCaps: e.target.checked })}
          />
          Sentence initial capitalization
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={settings.fixLoneI}
            onChange={(e) => updateSettings({ fixLoneI: e.target.checked })}
          />
          Capitalize lone &quot;i&quot; to &quot;I&quot;
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={settings.showUndoChip}
            onChange={(e) => updateSettings({ showUndoChip: e.target.checked })}
          />
          Show floating undo chip
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={settings.showSuggestions}
            onChange={(e) => updateSettings({ showSuggestions: e.target.checked })}
          />
          Show suggestion strip
        </label>
      </div>

      <div style={{ margin: '8px 0', textAlign: 'center' }}>
        <button
          onClick={() => {
            if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
              chrome.runtime.openOptionsPage();
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: '#38bdf8',
            fontSize: 12,
            cursor: 'pointer',
            padding: '4px 0',
            textDecoration: 'underline',
          }}
        >
          Options & Custom Dictionary →
        </button>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #1e293b', margin: '12px 0' }} />

      {/* Status Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748b' }}>
        <span>{statusText}</span>
        {!settings.enabled ? (
          <span style={{ color: '#f59e0b' }}>⏸ Paused</span>
        ) : isCurrentSiteDisabled ? (
          <span style={{ color: '#ef4444' }}>⊘ Disabled on site</span>
        ) : (
          <span style={{ color: '#10b981' }}>● Active</span>
        )}
      </div>
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<PopupApp />);
}
