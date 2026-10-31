/**
 * High-precision curated rules for English
 */

export const RULES_EN: Record<string, string> = {
  dont: "don't",
  doesnt: "doesn't",
  didnt: "didn't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  hasnt: "hasn't",
  havent: "haven't",
  hadnt: "hadn't",
  shouldnt: "shouldn't",
  couldnt: "couldn't",
  wouldnt: "wouldn't",
  im: "I'm",
  ive: "I've",
  youre: "you're",
  theyre: "they're",
  thats: "that's",
  whats: "what's",
  cant: "can't",
  fourty: "forty",
  teh: "the",
};

export function lookupRuleEn(
  token: string,
  fixLoneI = true,
  ctx?: { leftContext?: string[] },
  pEn?: number
): string | null {
  const lower = token.toLowerCase();

  if (fixLoneI && token === 'i') {
    return 'I';
  }

  // Guard ambiguous rules: 'im' and 'cant'
  if (lower === 'im') {
    // If context indicates non-English (e.g. German "im Haus", "Er ist im..."), do not convert to I'm
    if (ctx?.leftContext && ctx.leftContext.length > 0) {
      const hasGermanPronounOrVerb = ctx.leftContext.some(w =>
        ['er', 'sie', 'es', 'ist', 'war', 'sind', 'wir', 'ihr', 'im', 'in'].includes(w.toLowerCase())
      );
      const hasGermanNoun = ctx.leftContext.some(w =>
        /^[A-Z][a-z]+$/.test(w) && !['I', 'The', 'A', 'An', 'My', 'Our', 'He', 'She', 'It'].includes(w)
      );
      if (hasGermanPronounOrVerb || hasGermanNoun) {
        return null;
      }
    }
    if (pEn !== undefined && pEn < 0.55 && (ctx?.leftContext?.length ?? 0) > 0) {
      return null;
    }
  }

  if (lower === 'cant') {
    // In foreign or non-English dominant context, do not convert valid dictionary word 'cant'
    if (pEn !== undefined && pEn < 0.55 && (ctx?.leftContext?.length ?? 0) > 0) {
      return null;
    }
  }

  const match = RULES_EN[lower];
  if (!match) return null;

  // Match casing
  if (token === token.toUpperCase() && token.length > 1) {
    return match.toUpperCase();
  }
  if (token[0] === token[0]!.toUpperCase()) {
    return match[0]!.toUpperCase() + match.slice(1);
  }

  return match;
}
