import { parseBinaryIndex } from '../engine/index';

export interface EngineStatus {
  status: 'loading' | 'ready' | 'error';
  wordCountEn?: number;
  wordCountFr?: number;
  error?: string;
  timestamp: number;
}

let currentEngineStatus: EngineStatus = {
  status: 'loading',
  timestamp: Date.now(),
};

async function verifyEngineState(): Promise<EngineStatus> {
  try {
    const manifestUrl = chrome.runtime.getURL('dict/dictionary-manifest.json');
    const manifestRes = await fetch(manifestUrl);
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      currentEngineStatus = {
        status: 'ready',
        wordCountEn: manifest.languages?.en?.words || 26500,
        wordCountFr: manifest.languages?.fr?.words || 26500,
        timestamp: Date.now(),
      };
    } else {
      // Fallback: verify header existence of en.bin and fr.bin via 64-byte header fetch
      const [enRes, frRes] = await Promise.all([
        fetch(chrome.runtime.getURL('dict/en.bin')),
        fetch(chrome.runtime.getURL('dict/fr.bin')),
      ]);

      if (!enRes.ok) {
        throw new Error(`Failed to load English dictionary (HTTP ${enRes.status})`);
      }
      if (!frRes.ok) {
        throw new Error(`Failed to load French dictionary (HTTP ${frRes.status})`);
      }

      // Read only the 64-byte binary header
      const [enBuf, frBuf] = await Promise.all([
        enRes.arrayBuffer(),
        frRes.arrayBuffer(),
      ]);
      const enViews = parseBinaryIndex(enBuf.slice(0, 64));
      const frViews = parseBinaryIndex(frBuf.slice(0, 64));

      currentEngineStatus = {
        status: 'ready',
        wordCountEn: enViews.wordCount,
        wordCountFr: frViews.wordCount,
        timestamp: Date.now(),
      };
    }
  } catch (err) {
    currentEngineStatus = {
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      timestamp: Date.now(),
    };
  }

  // Save to session storage
  try {
    if (chrome.storage?.session) {
      await chrome.storage.session.set({ engineStatus: currentEngineStatus });
    }
  } catch {
    // Session storage may be unavailable in some test environments
  }

  return currentEngineStatus;
}

export default defineBackground(() => {
  console.log('[bilingual-autocorrect] Background service worker initialized.');

  // Verify engine dictionaries on startup
  verifyEngineState().catch(() => {});

  // Runtime messaging for popup and content scripts
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'GET_ENGINE_STATUS') {
      if (currentEngineStatus.status === 'loading') {
        verifyEngineState().then(sendResponse);
        return true; // async sendResponse
      }
      sendResponse(currentEngineStatus);
      return false;
    }

    if (message?.type === 'REVERIFY_ENGINE_STATUS') {
      verifyEngineState().then(sendResponse);
      return true;
    }
  });
});
