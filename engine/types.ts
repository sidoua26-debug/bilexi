/**
 * Pure Engine Type Definitions
 */

export type LanguageMode = 'auto' | 'en' | 'fr' | 'en+fr';
export type SensitivityMode = 'cautious' | 'balanced' | 'bold';
export type KeyboardLayout = 'auto' | 'qwerty' | 'azerty';

export interface TextShortcut {
  trigger: string;
  replacement: string;
}

export interface EngineSettings {
  languageMode: LanguageMode;
  sensitivity: SensitivityMode;
  layout: KeyboardLayout;
  enVariant?: 'us' | 'gb';
  sentenceCaps: boolean;
  fixLoneI: boolean;
  personalWords?: string[];
  rejectedWords?: string[];
  shortcuts?: TextShortcut[];
  typographicApostrophe?: boolean;
  thresholdOverrides?: Record<string, number>;
}

export interface AnalyzeContext {
  token: string;
  leftContext?: string[]; // <= 8 words preceding token
  boundary?: string;
  fieldKind?: 'input' | 'textarea' | 'contenteditable';
  layoutHint?: 'qwerty' | 'azerty';
  langHint?: string; // from element or document lang
  isSentenceInitial?: boolean; // explicitly marks sentence or field start
}

export interface CandidateAlternative {
  word: string;
  score: number;
  distance: number;
}

export interface EngineDecision {
  action: 'none' | 'replace';
  replacement: string;
  original: string;
  confidence: number;
  score?: number;
  alternatives: CandidateAlternative[];
  reason: string;
}
