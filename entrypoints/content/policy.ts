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
    if (token === 'off' || token === 'false') return true;
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

/**
 * Safely extracts the host element from a ShadowRoot or DocumentFragment with host.
 * Uses strict structural typing without unsafe casts.
 */
function getShadowHost(node: Node): HTMLElement | null {
  if (typeof ShadowRoot !== 'undefined' && node instanceof ShadowRoot && node.host instanceof HTMLElement) {
    return node.host;
  }
  if ('host' in node) {
    const candidate = (node as unknown as { host: unknown }).host;
    if (candidate instanceof HTMLElement) {
      return candidate;
    }
  }
  return null;
}

/**
 * Returns the first direct child element of a fieldset that is a <legend>, or null if none.
 * Follows HTML5 Living Standard § 4.10.19.1.
 */
function getFirstDirectLegend(fieldset: HTMLElement): HTMLElement | null {
  if (!fieldset || !fieldset.children) return null;
  for (let i = 0; i < fieldset.children.length; i++) {
    const child = fieldset.children[i];
    if (child && child.tagName === 'LEGEND') {
      return child as HTMLElement;
    }
  }
  return null;
}

/**
 * Traverses ancestors of el (starting from el's parent, stepping through open shadow roots)
 * and invokes callback for each ancestor until callback returns true or root is reached.
 * Returns true if callback returned true for any ancestor, false otherwise.
 */
export function forEachAncestorAcrossShadow(
  el: HTMLElement,
  callback: (node: HTMLElement) => boolean | void
): boolean {
  let curr: HTMLElement | null = el.parentElement;
  if (!curr) {
    const root: Node | null = typeof el.getRootNode === 'function' ? el.getRootNode() : null;
    if (root) {
      curr = getShadowHost(root);
    }
  }

  while (curr) {
    if (callback(curr) === true) return true;
    if (curr.parentElement) {
      curr = curr.parentElement;
    } else {
      const root: Node | null = typeof curr.getRootNode === 'function' ? curr.getRootNode() : null;
      if (root) {
        curr = getShadowHost(root);
      } else {
        break;
      }
    }
  }
  return false;
}

/**
 * Traverses ancestors across open Shadow DOM boundaries to find an element matching predicate.
 * Checks el and all its ancestors across open shadow roots.
 */
export function findAncestorAcrossShadow(
  el: HTMLElement,
  predicate: (node: HTMLElement) => boolean
): HTMLElement | null {
  if (predicate(el)) return el;
  let match: HTMLElement | null = null;
  forEachAncestorAcrossShadow(el, (ancestor) => {
    if (predicate(ancestor)) {
      match = ancestor;
      return true;
    }
  });
  return match;
}

export function isFieldEligible(target: EventTarget | null): target is HTMLElement {
  if (!target || !(target instanceof HTMLElement)) return false;

  // 1. Native visibility check in Chromium (C++ layout/visibility check for display:none, visibility:hidden, hidden)
  if (typeof target.checkVisibility === 'function') {
    try {
      if (!target.checkVisibility({ checkVisibilityCSS: true })) {
        return false;
      }
    } catch {
      if (!target.checkVisibility()) return false;
    }
  }

  // 2. Hidden or aria-hidden element checks (direct element & fast closest query)
  if (target.hidden || target.getAttribute?.('aria-hidden') === 'true') {
    return false;
  }
  if (target.style && (target.style.display === 'none' || target.style.visibility === 'hidden')) {
    return false;
  }
  if (typeof target.closest === 'function') {
    if (target.closest('[hidden], [aria-hidden="true"]')) {
      return false;
    }
  }

  // Hidden / visibility check across open shadow boundaries and ancestors (for mock/synthetic tests)
  const isHiddenAncestor = forEachAncestorAcrossShadow(target, (ancestor) => {
    if (ancestor.hidden || ancestor.getAttribute?.('aria-hidden') === 'true') {
      return true;
    }
    if (ancestor.style && (ancestor.style.display === 'none' || ancestor.style.visibility === 'hidden')) {
      return true;
    }
    return false;
  });
  if (isHiddenAncestor) return false;

  // 3. Disabled or Readonly form controls (including native :disabled pseudo-class)
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (target.disabled || target.readOnly) return false;
    try {
      if (typeof target.matches === 'function' && target.matches(':disabled')) {
        return false;
      }
    } catch {
      // Fallback if :disabled is unsupported in test/mock environment
    }
  }

  // 4. Disabled fieldset check with HTML5 first direct-child legend exception
  // Inspects ALL fieldset ancestors: an outer disabled fieldset cannot be bypassed by an inner legend!
  let isFieldsetDisabled = false;
  forEachAncestorAcrossShadow(target, (ancestor) => {
    if (ancestor.tagName === 'FIELDSET') {
      const fs = ancestor as HTMLFieldSetElement;
      const isFsDisabled = Boolean(fs.disabled || fs.getAttribute?.('disabled') !== null);
      if (isFsDisabled) {
        const firstLegend = getFirstDirectLegend(fs);
        if (!firstLegend || (typeof firstLegend.contains === 'function' && !firstLegend.contains(target))) {
          isFieldsetDisabled = true;
          return true; // Halt: disabled by this fieldset
        }
      }
    }
    return false;
  });
  if (isFieldsetDisabled) return false;

  // 5. Ancestor opt-outs: spellcheck="false"
  if (target.getAttribute?.('spellcheck') === 'false' || target.spellcheck === false) {
    return false;
  }
  if (findAncestorAcrossShadow(target, (el) => el.getAttribute?.('spellcheck') === 'false')) {
    return false;
  }

  // 6. Ancestor opt-outs: autocorrect="off", data-gramm="false", code editors, Google docs
  if (
    typeof target.closest === 'function' &&
    (target.closest('.monaco-editor, .cm-editor, .ace_editor, pre, code') ||
     target.closest('.kix-appview, .docs-texteventtarget-iframe') ||
     target.closest('[autocorrect="off"]') ||
     target.closest('[data-gramm="false"]'))
  ) {
    return false;
  }

  const optOutAncestor = findAncestorAcrossShadow(target, (el) => {
    if (el.getAttribute?.('autocorrect') === 'off') return true;
    if (el.getAttribute?.('data-gramm') === 'false') return true;
    if (
      typeof el.matches === 'function' &&
      el.matches('.monaco-editor, .cm-editor, .ace_editor, pre, code, .kix-appview, .docs-texteventtarget-iframe')
    ) {
      return true;
    }
    if (
      typeof el.closest === 'function' &&
      el.closest('.monaco-editor, .cm-editor, .ace_editor, pre, code, .kix-appview, .docs-texteventtarget-iframe')
    ) {
      return true;
    }
    return false;
  });
  if (optOutAncestor) return false;

  if (
    typeof window !== 'undefined' &&
    window.location?.hostname?.endsWith('docs.google.com')
  ) {
    return false;
  }

  // 7. Check sensitive autocomplete across element, associated form, and ALL ancestors
  const checkAutocomplete = (el: HTMLElement): boolean => {
    // A. Direct element autocomplete
    const elAc = el.getAttribute?.('autocomplete');
    if (elAc) {
      const cleanElAc = elAc.trim().toLowerCase();
      if (cleanElAc === 'off' || cleanElAc === 'false' || isSensitiveAutocomplete(elAc)) {
        return false;
      }
    }

    // B. Associated form for form controls (via HTML form attribute or DOM ancestor)
    const form =
      el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
        ? el.form || (typeof el.closest === 'function' ? el.closest('form') : null)
        : (typeof el.closest === 'function' ? el.closest('form') : null);

    if (form) {
      const formAc = form.getAttribute?.('autocomplete');
      if (formAc) {
        const cleanFormAc = formAc.trim().toLowerCase();
        if (cleanFormAc === 'off' || cleanFormAc === 'false' || isSensitiveAutocomplete(formAc)) {
          return false;
        }
      }
    }

    // C. Inspect ALL ancestors across open shadow DOM boundaries
    const hasSensitiveAcAncestor = forEachAncestorAcrossShadow(el, (ancestor) => {
      const ancAc = ancestor.getAttribute?.('autocomplete');
      if (ancAc) {
        const cleanAncAc = ancAc.trim().toLowerCase();
        if (cleanAncAc === 'off' || cleanAncAc === 'false' || isSensitiveAutocomplete(ancAc)) {
          return true; // Found sensitive ancestor -> stop traversal and signal rejection!
        }
      }
      if (
        (typeof HTMLFormElement !== 'undefined' && ancestor instanceof HTMLFormElement) ||
        ancestor.tagName === 'FORM'
      ) {
        const ancFormAc = ancestor.getAttribute?.('autocomplete');
        if (ancFormAc) {
          const cleanAncFormAc = ancFormAc.trim().toLowerCase();
          if (cleanAncFormAc === 'off' || cleanAncFormAc === 'false' || isSensitiveAutocomplete(ancFormAc)) {
            return true;
          }
        }
      }
      return false; // Continue traversing up
    });

    if (hasSensitiveAcAncestor) {
      return false;
    }

    return true;
  };

  // 8. Check input elements
  if (target instanceof HTMLInputElement) {
    const type = (target.type || 'text').toLowerCase();
    if (INELIGIBLE_INPUT_TYPES.has(type)) return false;
    return checkAutocomplete(target);
  }

  // 9. Check textarea elements
  if (target instanceof HTMLTextAreaElement) {
    return checkAutocomplete(target);
  }

  // 10. Check contenteditable elements
  if (target.isContentEditable) {
    if (target.getAttribute?.('contenteditable') === 'false') return false;
    const nonEditableWrapper = typeof target.closest === 'function'
      ? target.closest('[contenteditable="false"]')
      : null;
    if (nonEditableWrapper) return false;
    return checkAutocomplete(target);
  }

  return false;
}
