/* eslint-disable no-restricted-globals, @typescript-eslint/no-explicit-any, no-restricted-imports */
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

    it('rejects input inside form[autocomplete="off"] or sensitive form autocomplete', () => {
      const formOff = {
        nodeType: 1,
        tagName: 'FORM',
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'off' : null),
      };
      const inputInFormOff = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        form: formOff,
        getAttribute: () => null,
        closest: (sel: string) => (sel === 'form' ? formOff : null),
      };
      Object.setPrototypeOf(inputInFormOff, HTMLInputElement.prototype);
      expect(isFieldEligible(inputInFormOff as unknown as HTMLElement)).toBe(false);

      const formOtp = {
        nodeType: 1,
        tagName: 'FORM',
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'one-time-code' : null),
      };
      const inputInFormOtp = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        form: formOtp,
        getAttribute: () => null,
        closest: (sel: string) => (sel === 'form' ? formOtp : null),
      };
      Object.setPrototypeOf(inputInFormOtp, HTMLInputElement.prototype);
      expect(isFieldEligible(inputInFormOtp as unknown as HTMLElement)).toBe(false);

      const formOn = {
        nodeType: 1,
        tagName: 'FORM',
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'on' : null),
      };
      const inputInFormOn = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        form: formOn,
        getAttribute: () => null,
        closest: (sel: string) => (sel === 'form' ? formOn : null),
      };
      Object.setPrototypeOf(inputInFormOn, HTMLInputElement.prototype);
      expect(isFieldEligible(inputInFormOn as unknown as HTMLElement)).toBe(true);
    });

    it('respects associated form via element.form even if not a DOM ancestor', () => {
      const detachedForm = {
        nodeType: 1,
        tagName: 'FORM',
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'off' : null),
      };
      const associatedInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        form: detachedForm,
        getAttribute: (attr: string) => (attr === 'form' ? 'external-form' : null),
        closest: () => null,
      };
      Object.setPrototypeOf(associatedInput, HTMLInputElement.prototype);
      expect(isFieldEligible(associatedInput as unknown as HTMLElement)).toBe(false);
    });

    it('evaluates contenteditable safety and rejects sensitive autocomplete on editable container', () => {
      const ceOff = {
        nodeType: 1,
        tagName: 'DIV',
        isContentEditable: true,
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'off' : null),
        hasAttribute: (attr: string) => attr === 'autocomplete',
        closest: () => null,
      };
      Object.setPrototypeOf(ceOff, (globalThis as any).HTMLElement.prototype);
      expect(isFieldEligible(ceOff as unknown as HTMLElement)).toBe(false);

      const cePass = {
        nodeType: 1,
        tagName: 'DIV',
        isContentEditable: true,
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'new-password' : null),
        hasAttribute: (attr: string) => attr === 'autocomplete',
        closest: () => null,
      };
      Object.setPrototypeOf(cePass, (globalThis as any).HTMLElement.prototype);
      expect(isFieldEligible(cePass as unknown as HTMLElement)).toBe(false);

      const ceSafe = {
        nodeType: 1,
        tagName: 'DIV',
        isContentEditable: true,
        getAttribute: () => null,
        hasAttribute: () => false,
        closest: () => null,
      };
      Object.setPrototypeOf(ceSafe, (globalThis as any).HTMLElement.prototype);
      expect(isFieldEligible(ceSafe as unknown as HTMLElement)).toBe(true);
    });

    it('rejects nested non-editable widgets inside contenteditable regions', () => {
      const nonEditableChild = {
        nodeType: 1,
        tagName: 'SPAN',
        isContentEditable: true,
        getAttribute: () => null,
        closest: (sel: string) => (sel.includes('[contenteditable="false"]') ? {} : null),
      };
      Object.setPrototypeOf(nonEditableChild, (globalThis as any).HTMLElement.prototype);
      expect(isFieldEligible(nonEditableChild as unknown as HTMLElement)).toBe(false);
    });

    it('rejects ancestor opt-outs: autocorrect="off" and data-gramm="false"', () => {
      const ancestorAutocorrect = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        getAttribute: () => null,
        closest: (sel: string) => (sel.includes('[autocorrect="off"]') ? {} : null),
      };
      Object.setPrototypeOf(ancestorAutocorrect, HTMLInputElement.prototype);
      expect(isFieldEligible(ancestorAutocorrect as unknown as HTMLElement)).toBe(false);

      const ancestorGramm = {
        nodeType: 1,
        tagName: 'TEXTAREA',
        disabled: false,
        readOnly: false,
        getAttribute: () => null,
        closest: (sel: string) => (sel.includes('[data-gramm="false"]') ? {} : null),
      };
      Object.setPrototypeOf(ancestorGramm, HTMLTextAreaElement.prototype);
      expect(isFieldEligible(ancestorGramm as unknown as HTMLElement)).toBe(false);
    });

    it('rejects hidden and aria-hidden fields', () => {
      const hiddenInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        hidden: true,
        disabled: false,
        readOnly: false,
        getAttribute: () => null,
        closest: () => null,
      };
      Object.setPrototypeOf(hiddenInput, HTMLInputElement.prototype);
      expect(isFieldEligible(hiddenInput as unknown as HTMLElement)).toBe(false);

      const ariaHiddenInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        getAttribute: (attr: string) => (attr === 'aria-hidden' ? 'true' : null),
        closest: () => null,
      };
      Object.setPrototypeOf(ariaHiddenInput, HTMLInputElement.prototype);
      expect(isFieldEligible(ariaHiddenInput as unknown as HTMLElement)).toBe(false);

      const displayNoneInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        style: { display: 'none' },
        getAttribute: () => null,
        closest: () => null,
      };
      Object.setPrototypeOf(displayNoneInput, HTMLInputElement.prototype);
      expect(isFieldEligible(displayNoneInput as unknown as HTMLElement)).toBe(false);
    });

    it('handles disabled fieldset with HTML5 direct-child legend exception', () => {
      const legendElem: any = {
        nodeType: 1,
        tagName: 'LEGEND',
      };
      Object.setPrototypeOf(legendElem, (globalThis as any).HTMLElement.prototype);

      const fsElem: any = {
        nodeType: 1,
        tagName: 'FIELDSET',
        disabled: true,
        children: [legendElem],
      };
      Object.setPrototypeOf(fsElem, (globalThis as any).HTMLElement.prototype);

      // Control outside legend in disabled fieldset -> ineligible
      const bodyInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: fsElem,
        getAttribute: () => null,
        closest: () => null,
      };
      Object.setPrototypeOf(bodyInput, HTMLInputElement.prototype);
      legendElem.contains = (node: any) => node !== bodyInput;
      expect(isFieldEligible(bodyInput as unknown as HTMLElement)).toBe(false);

      // Control inside first direct legend of disabled fieldset -> eligible
      const legendInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: legendElem,
        getAttribute: () => null,
        closest: () => null,
      };
      legendElem.parentElement = fsElem;
      legendElem.contains = (node: any) => node === legendInput;
      Object.setPrototypeOf(legendInput, HTMLInputElement.prototype);
      expect(isFieldEligible(legendInput as unknown as HTMLElement)).toBe(true);

      // Descendant legend inside a div (not direct child of fieldset) -> ineligible
      const divWrapper: any = {
        nodeType: 1,
        tagName: 'DIV',
        parentElement: fsElem,
        children: [legendElem],
      };
      Object.setPrototypeOf(divWrapper, (globalThis as any).HTMLElement.prototype);
      fsElem.children = [divWrapper]; // fieldset has no direct legend child
      expect(isFieldEligible(legendInput as unknown as HTMLElement)).toBe(false);

      // Second legend child of fieldset -> ineligible
      const secondLegend: any = {
        nodeType: 1,
        tagName: 'LEGEND',
        parentElement: fsElem,
      };
      Object.setPrototypeOf(secondLegend, (globalThis as any).HTMLElement.prototype);
      const secondLegendInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: secondLegend,
        getAttribute: () => null,
        closest: () => null,
      };
      Object.setPrototypeOf(secondLegendInput, HTMLInputElement.prototype);
      secondLegend.contains = (node: any) => node === secondLegendInput;
      fsElem.children = [legendElem, secondLegend]; // first is legendElem
      expect(isFieldEligible(secondLegendInput as unknown as HTMLElement)).toBe(false);
    });

    it('rejects nested disabled fieldsets bypassing outer disabled fieldset', () => {
      const innerLegend: any = {
        nodeType: 1,
        tagName: 'LEGEND',
      };
      Object.setPrototypeOf(innerLegend, (globalThis as any).HTMLElement.prototype);

      const innerFs: any = {
        nodeType: 1,
        tagName: 'FIELDSET',
        disabled: true,
        children: [innerLegend],
      };
      Object.setPrototypeOf(innerFs, (globalThis as any).HTMLElement.prototype);
      innerLegend.parentElement = innerFs;

      const outerFs: any = {
        nodeType: 1,
        tagName: 'FIELDSET',
        disabled: true,
        children: [innerFs], // outer fieldset has NO direct legend
      };
      Object.setPrototypeOf(outerFs, (globalThis as any).HTMLElement.prototype);
      innerFs.parentElement = outerFs;

      const nestedInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: innerLegend,
        getAttribute: () => null,
        closest: () => null,
      };
      Object.setPrototypeOf(nestedInput, HTMLInputElement.prototype);
      innerLegend.contains = (node: any) => node === nestedInput;

      // Even though nestedInput is in innerFs's legend, outerFs is disabled and has no legend containing it
      expect(isFieldEligible(nestedInput as unknown as HTMLElement)).toBe(false);
    });

    it('traverses shadow roots and respects shadow host opt-outs', () => {
      const hostElem: any = {
        nodeType: 1,
        tagName: 'DIV',
        getAttribute: (attr: string) => (attr === 'autocorrect' ? 'off' : null),
        parentElement: null,
      };
      Object.setPrototypeOf(hostElem, (globalThis as any).HTMLElement.prototype);
      const mockShadowRoot: any = {
        nodeType: 11,
        host: hostElem,
      };
      // Emulate ShadowRoot constructor presence in node
      (globalThis as any).ShadowRoot = function () {};
      Object.setPrototypeOf(mockShadowRoot, (globalThis as any).ShadowRoot.prototype);

      const shadowInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: null,
        getRootNode: () => mockShadowRoot,
        getAttribute: () => null,
        closest: () => null,
      };
      Object.setPrototypeOf(shadowInput, HTMLInputElement.prototype);
      expect(isFieldEligible(shadowInput as unknown as HTMLElement)).toBe(false);
    });

    it('rejects input with autocomplete="on" inside ancestor with autocomplete="off"', () => {
      const parentDiv: any = {
        nodeType: 1,
        tagName: 'DIV',
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'off' : null),
        parentElement: null,
      };
      Object.setPrototypeOf(parentDiv, (globalThis as any).HTMLElement.prototype);

      const inputWithOn = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: parentDiv,
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'on' : null),
        closest: () => null,
      };
      Object.setPrototypeOf(inputWithOn, HTMLInputElement.prototype);

      // Must be rejected because ancestor div has autocomplete="off"
      expect(isFieldEligible(inputWithOn as unknown as HTMLElement)).toBe(false);
    });

    it('rejects contenteditable with autocomplete="on" inside ancestor with autocomplete="off"', () => {
      const parentDiv: any = {
        nodeType: 1,
        tagName: 'DIV',
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'off' : null),
        parentElement: null,
      };
      Object.setPrototypeOf(parentDiv, (globalThis as any).HTMLElement.prototype);

      const ceWithOn = {
        nodeType: 1,
        tagName: 'DIV',
        isContentEditable: true,
        parentElement: parentDiv,
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'on' : null),
        closest: () => null,
      };
      Object.setPrototypeOf(ceWithOn, (globalThis as any).HTMLElement.prototype);

      // Must be rejected because ancestor div has autocomplete="off"
      expect(isFieldEligible(ceWithOn as unknown as HTMLElement)).toBe(false);
    });

    it('rejects input with autocomplete="on" inside Shadow host with autocomplete="off"', () => {
      const shadowHost: any = {
        nodeType: 1,
        tagName: 'DIV',
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'off' : null),
        parentElement: null,
      };
      Object.setPrototypeOf(shadowHost, (globalThis as any).HTMLElement.prototype);

      const mockShadowRoot: any = {
        nodeType: 11,
        host: shadowHost,
      };
      (globalThis as any).ShadowRoot = function () {};
      Object.setPrototypeOf(mockShadowRoot, (globalThis as any).ShadowRoot.prototype);

      const shadowInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: null,
        getRootNode: () => mockShadowRoot,
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'on' : null),
        closest: () => null,
      };
      Object.setPrototypeOf(shadowInput, HTMLInputElement.prototype);

      // Must be rejected across shadow boundary
      expect(isFieldEligible(shadowInput as unknown as HTMLElement)).toBe(false);
    });

    it('rejects ancestor with sensitive autocomplete tokens (e.g., billing street-address)', () => {
      const formContainer: any = {
        nodeType: 1,
        tagName: 'DIV',
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'billing street-address' : null),
        parentElement: null,
      };
      Object.setPrototypeOf(formContainer, (globalThis as any).HTMLElement.prototype);

      const childInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: formContainer,
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'on' : null),
        closest: () => null,
      };
      Object.setPrototypeOf(childInput, HTMLInputElement.prototype);
      expect(isFieldEligible(childInput as unknown as HTMLElement)).toBe(false);
    });

    it('rejects controls inside hidden or display:none ancestors', () => {
      const hiddenAncestor: any = {
        nodeType: 1,
        tagName: 'DIV',
        hidden: true,
        parentElement: null,
        getAttribute: () => null,
      };
      Object.setPrototypeOf(hiddenAncestor, (globalThis as any).HTMLElement.prototype);

      const childOfHidden = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: hiddenAncestor,
        getAttribute: () => null,
        closest: () => null,
      };
      Object.setPrototypeOf(childOfHidden, HTMLInputElement.prototype);
      expect(isFieldEligible(childOfHidden as unknown as HTMLElement)).toBe(false);

      const displayNoneAncestor: any = {
        nodeType: 1,
        tagName: 'DIV',
        style: { display: 'none' },
        parentElement: null,
        getAttribute: () => null,
      };
      Object.setPrototypeOf(displayNoneAncestor, (globalThis as any).HTMLElement.prototype);

      const childOfDisplayNone = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: displayNoneAncestor,
        getAttribute: () => null,
        closest: () => null,
      };
      Object.setPrototypeOf(childOfDisplayNone, HTMLInputElement.prototype);
      expect(isFieldEligible(childOfDisplayNone as unknown as HTMLElement)).toBe(false);
    });

    it('allows eligible inputs with harmless autocomplete="on" and no sensitive ancestors', () => {
      const harmlessAncestor: any = {
        nodeType: 1,
        tagName: 'DIV',
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'on' : null),
        parentElement: null,
      };
      Object.setPrototypeOf(harmlessAncestor, (globalThis as any).HTMLElement.prototype);

      const normalInput = {
        nodeType: 1,
        tagName: 'INPUT',
        type: 'text',
        disabled: false,
        readOnly: false,
        parentElement: harmlessAncestor,
        getAttribute: (attr: string) => (attr === 'autocomplete' ? 'on' : null),
        closest: () => null,
      };
      Object.setPrototypeOf(normalInput, HTMLInputElement.prototype);
      expect(isFieldEligible(normalInput as unknown as HTMLElement)).toBe(true);
    });
  });
});
