declare module 'nspell' {
  interface NSpell {
    correct(word: string): boolean;
    suggest(word: string): string[];
    data: Record<string, string[]>;
  }
  function nspell(aff: Buffer | Uint8Array | string, dic: Buffer | Uint8Array | string): NSpell;
  export = nspell;
}
