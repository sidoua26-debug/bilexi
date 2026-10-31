/**
 * entrypoints/content/policy.ts
 * Field Eligibility & Safety Policy
 */

export const INELIGIBLE_INPUT_TYPES = new Set([
  'password',
  'email',
  'url',
  'number',
  'tel',
  'date',
  'datetime-local',
  'month',
  'week',
  'time',
  'file',
  'color',
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'range',
  'hidden',
  'image',
]);

/**
 * Scope qualifiers per WHATWG HTML Autocomplete standard:
 * https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill-detail-tokens
 */
export const AUTOCOMPLETE_SCOPE_QUALIFIERS = new Set([
  'shipping',
  'billing',
  'home',
  'work',
  'mobile',
  'fax',
  'pager',
]);

export const SENSITIVE_AUTOCOMPLETE_FIELDS = new Set([
  'off',
  'name',
  'honorific-prefix',
  'given-name',
  'additional-name',
  'family-name',
  'honorific-suffix',
  'nickname',
  'username',
  'new-password',
  'current-password',
  'one-time-code',
  'organization-title',
  'organization',
  'street-address',
  'address-line1',
  'address-line2',
  'address-line3',
  'address-level1',
  'address-level2',
  'address-level3',
  'address-level4',
  'country',
  'country-name',
  'postal-code',
  'cc-name',
  'cc-given-name',
  'cc-additional-name',
  'cc-family-name',
  'cc-number',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'cc-type',
  'transaction-currency',
  'transaction-amount',
  'language',
  'bday',
  'bday-day',
  'bday-month',
  'bday-year',
  'sex',
  'url',
  'photo',
  'tel',
  'tel-country-code',
  'tel-national',
  'tel-area-code',
  'tel-local',
  'tel-local-prefix',
  'tel-local-suffix',
  'tel-extension',
  'email',
  'impp',
]);

/**
 * Parses space-separated tokens in autocomplete string and identifies sensitive fields.
 * Strips section-* prefixes and scope qualifiers (shipping, billing, home, work, mobile, etc.).
 */
export function isSensitiveAutocomplete(autocompleteStr: string): boolean {
  if (!autocompleteStr) return false;
  const rawTokens = autocompleteStr.trim().toLowerCase().split(/\s+/);
  if (rawTokens.length === 0) return false;

  for (const token of rawTokens) {
    if (token === 'off') return true;
    if (token.startsWith('section-')) continue;
    if (AUTOCOMPLETE_SCOPE_QUALIFIERS.has(token)) continue;

    // Check direct membership in sensitive set
    if (SENSITIVE_AUTOCOMPLETE_FIELDS.has(token)) return true;

    // Check standard sensitive prefixes
    if (
      token.startsWith('cc-') ||
      token.startsWith('tel-') ||
      token.startsWith('address-') ||
      token.startsWith('bday-')
    ) {
      return true;
    }
  }

  return false;
}

export function isFieldEligible(target: EventTarget | null): target is HTMLElement {
  if (!target || !(target instanceof HTMLElement)) return false;

  // Disabled or Readonly
  if ((target as HTMLInputElement).disabled || (target as HTMLInputElement).readOnly) {
    return false;
  }

  // Check spellcheck attribute
  if (target.getAttribute('spellcheck') === 'false' || target.spellcheck === false) {
    return false;
  }

  // Check autocorrect attribute
  if (target.getAttribute('autocorrect') === 'off') {
    return false;
  }

  // Check data-gramm (Grammarly/extension opt-out) attribute
  if (target.getAttribute('data-gramm') === 'false') {
    return false;
  }

  // Code editor or code tag containers
  if (target.closest('.monaco-editor, .cm-editor, .ace_editor, pre, code')) {
    return false;
  }

  // Google Docs / Canvas editors detection
  if (
    target.closest('.kix-appview, .docs-texteventtarget-iframe') ||
    window.location.hostname.endsWith('docs.google.com')
  ) {
    return false;
  }

  const checkAutocomplete = (el: HTMLElement): boolean => {
    const autocomplete = el.getAttribute('autocomplete');
    if (autocomplete && isSensitiveAutocomplete(autocomplete)) {
      return false;
    }
    return true;
  };

  // Check input elements
  if (target instanceof HTMLInputElement) {
    const type = (target.type || 'text').toLowerCase();
    if (INELIGIBLE_INPUT_TYPES.has(type)) return false;

    if (!checkAutocomplete(target)) return false;
    return true;
  }

  // Check textarea
  if (target instanceof HTMLTextAreaElement) {
    if (!checkAutocomplete(target)) return false;
    return true;
  }

  // Check contenteditable
  if (target.isContentEditable) {
    const ceAttr = target.getAttribute('contenteditable');
    if (ceAttr === 'false') return false;
    return true;
  }

  return false;
}
