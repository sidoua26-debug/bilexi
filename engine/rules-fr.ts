/**
 * High-precision curated rules for French
 */

export const RULES_FR: Record<string, string> = {
  jai: "j'ai",
  cest: "c'est",
  nest: "n'est",
  sil: "s'il",
  quil: "qu'il",
  quils: "qu'ils",
  quelles: "qu'elles",
  aujourdhui: "aujourd'hui",
  lecole: "l'école",
  daccord: "d'accord",
  dabord: "d'abord",
  jusqua: "jusqu'à",
  laccueil: "l'accueil",
  peutetre: 'peut-être',
};

export function lookupRuleFr(
  token: string,
  ctx?: { leftContext?: string[] },
  pFr?: number,
  pEn?: number
): string | null {
  const lower = token.toLowerCase();

  // 'quelles' is a standard French interrogative / relative determiner (e.g. "Quelles options...", "je sais quelles sont...")
  if (lower === 'quelles') {
    if (token[0] === token[0]!.toUpperCase()) {
      return null;
    }
    if (ctx?.leftContext && ctx.leftContext.length > 0) {
      const hasDeterminerContext = ctx.leftContext.some(w =>
        [
          'sais', 'sait', 'savez', 'savent', 'savoir', 'vois', 'voit', 'ignore', 'connais', 'demande',
          'les', 'ces', 'des', 'de', 'à', 'en', 'par', 'pour', 'toutes', 'tous',
          'faire', 'fait', 'fais', 'font', 'dire', 'dit', 'dis', 'soit', 'soient',
          'comme', 'sans', 'sous', 'vers', 'chez', 'ou', 'et', 'mais', 'car', 'donc'
        ].includes(w.toLowerCase())
      );
      if (hasDeterminerContext) {
        return null;
      }
    }
  }

  // 'nest' is a valid English word ('bird's nest'). If English context is present, do not convert to n'est
  if (lower === 'nest') {
    if (pEn !== undefined && pEn > (pFr ?? 0.5) && (ctx?.leftContext?.length ?? 0) > 0) {
      return null;
    }
  }

  const match = RULES_FR[lower];
  if (!match) return null;

  if (token === token.toUpperCase() && token.length > 1) {
    return match.toUpperCase();
  }
  if (token[0] === token[0]!.toUpperCase()) {
    return match[0]!.toUpperCase() + match.slice(1);
  }

  return match;
}
