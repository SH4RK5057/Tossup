import type { Ruleset } from './rulesets/types';
import type { AnswerSpec } from './types';
import {
  editDistance,
  normalizeMath,
  normalizeSpelling,
  normalizeText,
  typoTolerance,
} from './normalize';

export type CheckResult = 'correct' | 'incorrect' | 'prompt';

const FOREIGN_ARTICLES = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', // Spanish
  'le', 'les', 'l', 'une', 'des', 'du', // French
  'der', 'die', 'das', 'ein', 'eine', // German
  'il', 'lo', 'gli', 'uno', // Italian
]);

const MATH_UNITS = new Set([
  'degree', 'degrees', 'deg', 'percent', 'unit', 'units', 'square', 'cubic', 'sq',
  'meter', 'meters', 'metre', 'metres', 'm', 'cm', 'mm', 'km', 'foot', 'feet', 'ft', 'inch', 'inches',
  'mile', 'miles', 'mi', 'kg', 'kilogram', 'kilograms', 'gram', 'grams', 'g', 'pound', 'pounds', 'lb', 'lbs',
  'second', 'seconds', 'sec', 's', 'minute', 'minutes', 'min', 'hour', 'hours', 'hr', 'mph',
  'joule', 'joules', 'j', 'newton', 'newtons', 'n', 'watt', 'watts', 'w', 'volt', 'volts', 'v',
  'ohm', 'ohms', 'mol', 'mole', 'moles', 'liter', 'liters', 'litre', 'litres', 'l', 'ml',
  'dollar', 'dollars', 'cent', 'cents',
]);

/** Strips trailing units from a typed numeric answer: "180 degrees", "12cm", "50%". */
function stripTrailingUnits(typed: string): string {
  let s = typed.trim().toLowerCase().replace(/[°%]/g, (c) => (c === '°' ? ' degrees' : ' percent'));
  s = s.replace(/^(-?[\d.,/]+)([a-z]+)/, '$1 $2');
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || !/\d/.test(tokens[0])) return typed;
  let end = tokens.length;
  while (end > 1 && MATH_UNITS.has(tokens[end - 1])) end--;
  return end === tokens.length ? typed : tokens.slice(0, end).join(' ');
}

function candidates(spec: AnswerSpec): string[] {
  return [spec.answer, ...(spec.required ? [spec.required] : []), ...spec.alternates];
}

function promptMatches(typed: string, spec: AnswerSpec, norm: (s: string) => string): boolean {
  return spec.prompt_on.some((p) => norm(p) === typed);
}

function fuzzyEq(typed: string, key: string): boolean {
  if (typed === key) return true;
  if (/\d/.test(key)) return false; // never for numbers
  return editDistance(typed, key) <= typoTolerance(key.length);
}

function checkGeneral(typedRaw: string, spec: AnswerSpec): CheckResult {
  const t = normalizeText(typedRaw);
  if (!t) return 'incorrect';
  const keys = candidates(spec).map((c) => normalizeText(c));
  if (keys.includes(t)) return 'correct';
  if (promptMatches(t, spec, normalizeText)) return 'prompt';
  if (keys.some((k) => fuzzyEq(t, k))) return 'correct';
  return 'incorrect';
}

/** Does every typed first-name token match some key token (exactly, fuzzily, or as an initial)? */
function firstNameCompatible(typedTokens: string[], keyTokens: string[]): boolean {
  if (!keyTokens.length) return false;
  return typedTokens.every((tt) =>
    keyTokens.some((kt) => {
      if (tt === kt) return true;
      if (kt.length === 1) return tt.startsWith(kt);
      if (tt.length === 1) return kt.startsWith(tt);
      return fuzzyEq(tt, kt);
    }),
  );
}

function checkName(typedRaw: string, spec: AnswerSpec, strict: boolean): CheckResult {
  const t = normalizeText(typedRaw);
  if (!t) return 'incorrect';
  const key = normalizeText(spec.answer);
  const alternates = spec.alternates.map((a) => normalizeText(a));
  if (t === key || alternates.includes(t)) return 'correct';
  if (promptMatches(t, spec, normalizeText)) return 'prompt';

  const keyTokens = key.split(' ');
  const required = spec.required ? normalizeText(spec.required) : keyTokens[keyTokens.length - 1];
  const requiredTokens = required.split(' ');
  // "Other" tokens: the part of the key that is not the required (last-name) portion.
  let start = -1;
  for (let i = 0; i + requiredTokens.length <= keyTokens.length && start < 0; i++) {
    if (keyTokens.slice(i, i + requiredTokens.length).join(' ') === required) start = i;
  }
  const other = start < 0
    ? keyTokens
    : [...keyTokens.slice(0, start), ...keyTokens.slice(start + requiredTokens.length)];

  const typedTokens = t.split(' ');
  if (spec.accepts_partial_name && (fuzzyEq(t, required) || (other.length > 0 && fuzzyEq(t, other.join(' '))))) {
    return 'correct';
  }

  if (typedTokens.length >= requiredTokens.length) {
    const tail = typedTokens.slice(typedTokens.length - requiredTokens.length).join(' ');
    const lead = typedTokens.slice(0, typedTokens.length - requiredTokens.length);
    if (fuzzyEq(tail, required)) {
      if (!strict) return 'correct'; // lenient: first names are never penalized
      if (lead.length === 0) return spec.duplicate_name ? 'incorrect' : 'correct';
      return firstNameCompatible(lead, other) ? 'correct' : 'incorrect'; // wrong first name -> incorrect
    }
  }
  if ([key, ...alternates].some((k) => fuzzyEq(t, k))) return 'correct';
  return 'incorrect';
}

const NUMBER = /^-?\d+(\.\d+)?$/;
function numericValue(s: string): number | null {
  if (NUMBER.test(s)) return Number(s);
  const m = /^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/.exec(s);
  if (m && Number(m[2]) !== 0) return Number(m[1]) / Number(m[2]);
  return null;
}

function checkMath(typedRaw: string, spec: AnswerSpec, strict: boolean): CheckResult {
  const keys = candidates(spec).map(normalizeMath);
  const keyHasDigit = keys.some((k) => /\d/.test(k));
  const t = normalizeMath(keyHasDigit ? stripTrailingUnits(typedRaw) : typedRaw);
  if (!t) return 'incorrect';
  if (keys.includes(t)) return 'correct';
  if (promptMatches(t, spec, normalizeMath)) return 'prompt';
  if (!strict && NUMBER.test(keys[0])) {
    const tv = numericValue(t);
    if (tv !== null && Math.abs(tv - Number(keys[0])) < 1e-9) return 'correct';
  }
  return 'incorrect'; // forms are compared, not values; no typo tolerance
}

function checkSpelling(typedRaw: string, spec: AnswerSpec): CheckResult {
  const t = normalizeSpelling(typedRaw);
  if (!t) return 'incorrect';
  if (candidates(spec).some((c) => normalizeSpelling(c) === t)) return 'correct';
  if (spec.prompt_on.some((p) => normalizeSpelling(p) === t)) return 'prompt';
  return 'incorrect';
}

function splitArticle(s: string): { article: string | null; core: string } {
  const tokens = s.split(' ').filter(Boolean);
  if (tokens.length > 1 && FOREIGN_ARTICLES.has(tokens[0])) {
    return { article: tokens[0], core: tokens.slice(1).join(' ') };
  }
  return { article: null, core: s };
}

function foreignNormalize(s: string): string {
  return normalizeText(s.replace(/\b([ldLD])['’]/g, '$1 '), { keepArticle: true });
}

function checkForeign(typedRaw: string, spec: AnswerSpec): CheckResult {
  const t = splitArticle(foreignNormalize(typedRaw));
  if (!t.core) return 'incorrect';
  let articleMismatch = false;
  for (const c of candidates(spec)) {
    const k = splitArticle(foreignNormalize(c));
    if (k.core !== t.core) continue;
    if (t.article === null || k.article === null || t.article === k.article) return 'correct';
    articleMismatch = true; // right word, wrong article
  }
  if (articleMismatch) return 'incorrect';
  const whole = foreignNormalize(typedRaw);
  if (promptMatches(whole, spec, foreignNormalize)) return 'prompt';
  return 'incorrect';
}

/**
 * Checks a typed answer against an answer spec under a ruleset's strictness.
 * Pipeline: normalize -> exact -> prompt_on -> typo tolerance (general and name only).
 */
export function check(typed: string, spec: AnswerSpec, ruleset: Ruleset): CheckResult {
  if (!typed || !typed.trim()) return 'incorrect';
  const strict = ruleset.checker === 'strict';
  switch (spec.answer_type) {
    case 'name': return checkName(typed, spec, strict);
    case 'math': return checkMath(typed, spec, strict);
    case 'spelling': return checkSpelling(typed, spec);
    case 'foreign_language': return checkForeign(typed, spec);
    default: return checkGeneral(typed, spec);
  }
}
