import { describe, it, expect } from 'vitest';
import { isSensitiveAutocomplete, isFieldEligible, INELIGIBLE_INPUT_TYPES } from '../../entrypoints/content/policy';

if (typeof HTMLElement === 'undefined') {
  class MockElement {
    nodeType = 1;
  }
  class MockInputElement extends MockElement {}
  class MockTextAreaElement extends MockElement {}
  (globalThis as any).HTMLElement = MockElement;
  (globalThis as any).HTMLInputElement = MockInputElement;
  (globalThis as any).HTMLTextAreaElement = MockTextAreaElement;
  (globalThis as any).window = { location: { hostname: 'example.com' } };
}

describe('Field Eligibility & Safety Policy Unit Tests (WP3)', () => {
  describe('isSensitiveAutocomplete (Table-Driven Tests)', () => {
    const testCases: Array<{ input: string; expectedSensitive: boolean; description: string }> = [
      // Standard sensitive fields
      { input: 'username', expectedSensitive: true, description: 'Direct username' },
      { input: 'email', expectedSensitive: true, description: 'Direct email' },
      { input: 'current-password', expectedSensitive: true, description: 'Current password' },
      { input: 'new-password', expectedSensitive: true, description: 'New password' },
      { input: 'one-time-code', expectedSensitive: true, description: '2FA / OTP code' },
      { input: 'cc-number', expectedSensitive: true, description: 'Credit card number' },
      { input: 'cc-csc', expectedSensitive: true, description: 'Credit card CVV / CSC' },
      { input: 'cc-exp', expectedSensitive: true, description: 'Credit card expiration' },
      { input: 'tel', expectedSensitive: true, description: 'Direct phone number' },
      { input: 'tel-national', expectedSensitive: true, description: 'National phone number' },
      { input: 'street-address', expectedSensitive: true, description: 'Street address' },
      { input: 'address-line1', expectedSensitive: true, description: 'Address line 1' },
      { input: 'postal-code', expectedSensitive: true, description: 'Postal / ZIP code' },
      { input: 'bday', expectedSensitive: true, description: 'Birthday' },
      { input: 'off', expectedSensitive: true, description: 'autocomplete=off' },

      // Multi-token qualifiers and section prefixes
      {
        input: 'section-billing shipping street-address',
        expectedSensitive: true,
        description: 'Section + scope shipping street-address',
      },
      {
        input: 'billing email',
        expectedSensitive: true,
        description: 'Billing scope with email',
      },
      {
        input: 'shipping tel-national',
        expectedSensitive: true,
        description: 'Shipping scope with national phone',
      },
      {
        input: 'home tel',
        expectedSensitive: true,
        description: 'Home contact phone number',
      },
      {
        input: 'section-checkout cc-number',
        expectedSensitive: true,
        description: 'Section with credit card number',
      },
      {
        input: 'section-user-profile work email',
        expectedSensitive: true,
        description: 'Section with work email',
      },
      {
        input: 'shipping given-name',
        expectedSensitive: true,
        description: 'Shipping given name (personal info)',
      },
      {
        input: 'shipping family-name',
        expectedSensitive: true,
        description: 'Shipping family name (personal info)',
      },

      // Eligible / Non-sensitive autocomplete fields
      { input: 'on', expectedSensitive: false, description: 'autocomplete=on' },
      { input: '', expectedSensitive: false, description: 'Empty string' },
      { input: 'search', expectedSensitive: false, description: 'search input' },
      { input: 'country', expectedSensitive: true, description: 'country is personal address info' },
    ];

    for (const tc of testCases) {
      it(`evaluates '${tc.input}' (${tc.description}) -> ${tc.expectedSensitive ? 'SENSITIVE' : 'ELIGIBLE'}`, () => {
        expect(isSensitiveAutocomplete(tc.input)).toBe(tc.expectedSensitive);
      });
    }
  });

  describe('isFieldEligible (HTML Element Ineligibility)', () => {
    it('rejects input with disabled or readOnly', () => {
      const disabledInput = {
        nodeType: 1,
        tagName: 'INPUT',
        disabled: true,
        readOnly: false,
        getAttribute: () => null,
        closest: () => null,
      } as unknown as HTMLElement;
      expect(isFieldEligible(disabledInput)).toBe(false);

      const readOnlyInput = {
        nodeType: 1,
        tagName: 'INPUT',
        disabled: false,
        readOnly: true,
        getAttribute: () => null,
        closest: () => null,
      } as unknown as HTMLElement;
      expect(isFieldEligible(readOnlyInput)).toBe(false);
    });

    it('rejects all standard ineligible input types', () => {
      for (const type of Array.from(INELIGIBLE_INPUT_TYPES)) {
        const input = {
          nodeType: 1,
          tagName: 'INPUT',
          type,
          disabled: false,
          readOnly: false,
          getAttribute: () => null,
          closest: () => null,
        };
        // Mock instanceof HTMLInputElement behavior
        Object.setPrototypeOf(input, HTMLInputElement.prototype);
        expect(isFieldEligible(input as unknown as HTMLElement)).toBe(false);
      }
    });

    it('rejects elements with spellcheck="false", autocorrect="off", or data-gramm="false"', () => {
      const spellcheckOff = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        getAttribute: (attr: string) => (attr === 'spellcheck' ? 'false' : null),
        closest: () => null,
      };
      Object.setPrototypeOf(spellcheckOff, HTMLInputElement.prototype);
      expect(isFieldEligible(spellcheckOff as unknown as HTMLElement)).toBe(false);

      const autocorrectOff = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        getAttribute: (attr: string) => (attr === 'autocorrect' ? 'off' : null),
        closest: () => null,
      };
      Object.setPrototypeOf(autocorrectOff, HTMLInputElement.prototype);
      expect(isFieldEligible(autocorrectOff as unknown as HTMLElement)).toBe(false);

      const dataGrammOff = {
        nodeType: 1,
        tagName: 'TEXTAREA',
        disabled: false,
        readOnly: false,
        getAttribute: (attr: string) => (attr === 'data-gramm' ? 'false' : null),
        closest: () => null,
      };
      Object.setPrototypeOf(dataGrammOff, HTMLTextAreaElement.prototype);
      expect(isFieldEligible(dataGrammOff as unknown as HTMLElement)).toBe(false);
    });

    it('rejects code editors (Monaco, CodeMirror, Ace, pre, code)', () => {
      const codeInput = {
        nodeType: 1,
        tagName: 'TEXTAREA',
        disabled: false,
        readOnly: false,
        getAttribute: () => null,
        closest: (sel: string) => (sel.includes('.cm-editor') ? {} : null),
      };
      Object.setPrototypeOf(codeInput, HTMLTextAreaElement.prototype);
      expect(isFieldEligible(codeInput as unknown as HTMLElement)).toBe(false);
    });
  });
});
