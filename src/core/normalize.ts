// Text normalization shared by the answer checker. Pure; no DOM or React.

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const ORDINALS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9,
  tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
};
const MULTIPLIERS: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000 };

function isNumberWord(t: string): boolean {
  return t in UNITS || t in TENS || t in MULTIPLIERS;
}

/** Converts spelled-out numbers and ordinals in a token list to digits. */
export function convertNumberWords(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t in ORDINALS) { out.push(String(ORDINALS[t])); i++; continue; }
    if (!isNumberWord(t)) { out.push(t); i++; continue; }
    let total = 0;
    let current = 0;
    while (i < tokens.length) {
      const w = tokens[i];
      if (w in UNITS) current += UNITS[w];
      else if (w in TENS) current += TENS[w];
      else if (w in MULTIPLIERS) {
        if (MULTIPLIERS[w] === 100) current = (current || 1) * 100;
        else { total += (current || 1) * MULTIPLIERS[w]; current = 0; }
      } else if (w === 'and' && i + 1 < tokens.length && isNumberWord(tokens[i + 1]) && (total || current)) {
        // "one hundred and five"
      } else break;
      i++;
    }
    out.push(String(total + current));
  }
  return out;
}

const COMBINING_MARKS = /[̀-ͯ]/g;

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(COMBINING_MARKS, '').normalize('NFC');
}

const ARTICLES = new Set(['a', 'an', 'the']);

export interface NormalizeOptions {
  /** Keep a leading article (foreign-language answers). */
  keepArticle?: boolean;
}

/** Lowercase, strip diacritics/punctuation, collapse whitespace, digits for spelled numbers, drop leading article. */
export function normalizeText(input: string, opts: NormalizeOptions = {}): string {
  let s = stripDiacritics(input).toLowerCase();
  s = s.replace(/&/g, ' and ');
  s = s.replace(/['’`]/g, '');
  s = s.replace(/(\d)\.(\d)/g, '$1\u0001$2'); // protect decimals
  s = s.replace(/[^\p{L}\p{N}\u0001\s]/gu, ' ');
  s = s.replace(/\u0001/g, '.');
  let tokens = s.split(/\s+/).filter(Boolean);
  tokens = tokens.map((t) => t.replace(/^(\d+)(st|nd|rd|th)$/, '$1'));
  tokens = convertNumberWords(tokens);
  if (!opts.keepArticle && tokens.length > 1 && ARTICLES.has(tokens[0])) tokens = tokens.slice(1);
  return tokens.join(' ');
}

/** Letters-only form used for spelling questions ("r-h-y-t-h-m" == "rhythm"). */
export function normalizeSpelling(input: string): string {
  return stripDiacritics(input).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/** Normalizes a math answer while preserving its written form. */
export function normalizeMath(input: string): string {
  let s = stripDiacritics(input).toLowerCase();
  s = s
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/π/g, 'pi')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\*\*/g, '^');
  // spelled-out numbers -> digits (only word tokens are touched)
  const wordTokens = s.split(/\s+/).filter(Boolean);
  s = convertNumberWords(wordTokens).join(' ');
  s = s.replace(/\s+/g, '');
  s = s.replace(/^\+/, '');
  s = s.replace(/(\d)\*([a-z(])/g, '$1$2'); // 2*x -> 2x
  s = s.replace(/(\d)\*(pi|e)\b/g, '$1$2');
  return s;
}

/** Optimal-string-alignment edit distance (a transposition counts as one edit). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (!al) return bl;
  if (!bl) return al;
  const d: number[][] = Array.from({ length: al + 1 }, () => new Array<number>(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[al][bl];
}

/** Allowed edit distance for an answer key of the given length. */
export function typoTolerance(keyLength: number): number {
  if (keyLength < 5) return 0;
  if (keyLength <= 8) return 1;
  if (keyLength <= 15) return 2;
  return 3;
}
