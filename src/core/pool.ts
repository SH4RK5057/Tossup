import { createRng, shuffle, type Rng } from './rng';
import type { Ruleset } from './rulesets/types';
import { LEVELS, type Bonus, type Difficulty, type Level, type Question, type Tossup } from './types';

export interface PoolFilter {
  /** Selected subjects as "Category/Subcategory" keys. Empty = everything. */
  subjects: string[];
  /** Ignore `subjects` and draw by the ruleset's distribution. */
  fullDistribution: boolean;
  /** Difficulties to include. Omitted or empty = all. */
  difficulties?: Difficulty[];
}

export const subjectKey = (category: string, subcategory: string) => `${category}/${subcategory}`;

export function isServable(q: Question, ruleset: Ruleset, nowIso: string): boolean {
  if (q.status !== 'active') return false;
  if (!q.rulesets.includes(ruleset.id)) return false;
  if (q.expires_at && q.expires_at <= nowIso) return false;
  return true;
}

function lowerLevels(level: Level): Level[] {
  return LEVELS.slice(0, LEVELS.indexOf(level));
}

/** Levels to load from the data store: the requested level plus lower levels when pools are cumulative. */
export function levelsForPool(ruleset: Ruleset, level: Level): Level[] {
  return ruleset.lowerLevelShare ? [...lowerLevels(level), level] : [level];
}

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Takes `count` items, drawing a share from the lower-level list when cumulative pools apply. */
function pickMixed<T>(own: T[], lower: T[], count: number, share: number, rng: Rng): T[] {
  const lowerWant = Math.min(lower.length, Math.round(count * share));
  const lowerPick = lower.slice(0, lowerWant);
  const ownPick = own.slice(0, Math.max(0, count - lowerPick.length));
  const picked = [...ownPick, ...lowerPick];
  if (picked.length < count) picked.push(...lower.slice(lowerWant, lowerWant + count - picked.length));
  return shuffle(picked, rng);
}

interface Candidates<T extends Question> {
  own: T[];
  lower: T[];
}

function candidates<T extends Question>(
  all: T[], ruleset: Ruleset, level: Level, filter: PoolFilter, nowIso: string,
): Candidates<T> {
  const servable = all.filter((q) => isServable(q, ruleset, nowIso));
  const wanted = filter.fullDistribution || filter.subjects.length === 0 ? null : new Set(filter.subjects);
  const diffs = filter.difficulties?.length ? new Set<Difficulty>(filter.difficulties) : null;
  const passes = (q: T) =>
    (!wanted || wanted.has(subjectKey(q.category, q.subcategory))) && (!diffs || diffs.has(q.difficulty));
  const lowerSet = new Set<Level>(ruleset.lowerLevelShare ? lowerLevels(level) : []);
  return {
    own: servable.filter((q) => q.level === level && passes(q)).sort(byId),
    lower: servable.filter((q) => lowerSet.has(q.level) && passes(q)).sort(byId),
  };
}

/** Largest-remainder allocation of `total` across weights. */
function allocate(total: number, weights: Record<string, number>): Record<string, number> {
  const entries = Object.entries(weights);
  const sum = entries.reduce((s, [, w]) => s + w, 0);
  const out: Record<string, number> = {};
  const remainders: [string, number][] = [];
  let assigned = 0;
  for (const [k, w] of entries) {
    const exact = (total * w) / sum;
    out[k] = Math.floor(exact);
    assigned += out[k];
    remainders.push([k, exact - out[k]]);
  }
  remainders.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  for (let i = 0; assigned < total; i = (i + 1) % remainders.length, assigned++) out[remainders[i][0]]++;
  return out;
}

export function currentEventsCount(ruleset: Ruleset, level: Level, length: number): number {
  const base = ruleset.currentEvents?.[level] ?? 0;
  if (!base) return 0;
  if (length >= ruleset.currentEventsReferenceLength) return base;
  return Math.min(base, Math.round((base * length) / ruleset.currentEventsReferenceLength));
}

export interface SequenceArgs<T extends Question> {
  pool: T[];
  ruleset: Ruleset;
  level: Level;
  filter: PoolFilter;
  seed: string;
  /** Maximum number of questions. Omit for everything available. */
  limit?: number;
  nowIso: string;
}

function buildSequence<T extends Question>(a: SequenceArgs<T>, salt: string): T[] {
  const rng = createRng(`${a.seed}:${salt}`);
  const c = candidates(a.pool, a.ruleset, a.level, a.filter, a.nowIso);
  const own = shuffle(c.own, rng);
  const lower = shuffle(c.lower, rng);
  const share = a.ruleset.lowerLevelShare ?? 0;
  const available = own.length + lower.length;
  const limit = Math.min(a.limit ?? Infinity, available);
  if (!a.filter.fullDistribution) return pickMixed(own, lower, limit, share, rng);

  // Full distribution: fixed current-events count, remaining slots by category weight.
  const isCE = (q: T) => q.category === 'Current Events';
  const ce = pickMixed(own.filter(isCE), lower.filter(isCE), currentEventsCount(a.ruleset, a.level, limit), share, rng);
  const rest = limit - ce.length;
  const weights = a.ruleset.distribution;
  const alloc = allocate(rest, weights);
  const used = new Set<string>(ce.map((q) => q.id));
  const picked: T[] = [...ce];
  const leftovers: T[] = [];
  for (const cat of Object.keys(weights)) {
    const inCat = (q: T) => q.category === cat;
    const chosen = pickMixed(own.filter(inCat), lower.filter(inCat), alloc[cat] ?? 0, share, rng);
    chosen.forEach((q) => used.add(q.id));
    picked.push(...chosen);
  }
  // Categories short of questions: fill from anything unused (non-CE first).
  if (picked.length < limit) {
    for (const q of [...own, ...lower]) if (!used.has(q.id) && !isCE(q)) leftovers.push(q);
    picked.push(...leftovers.slice(0, limit - picked.length));
  }
  return shuffle(picked, rng);
}

export function buildTossupSequence(a: SequenceArgs<Tossup>): Tossup[] {
  return buildSequence(a, 'tossups');
}

export function buildBonusSequence(a: SequenceArgs<Bonus>): Bonus[] {
  return buildSequence(a, 'bonuses');
}

/** Counts servable questions so the UI can show how many a filter matches. */
export function countAvailable(
  pool: Question[], ruleset: Ruleset, level: Level, filter: PoolFilter, nowIso: string,
): { tossups: number; bonuses: number } {
  const t = candidates(pool.filter((q): q is Tossup => q.type === 'tossup'), ruleset, level, filter, nowIso);
  const b = candidates(pool.filter((q): q is Bonus => q.type === 'bonus'), ruleset, level, filter, nowIso);
  return { tossups: t.own.length + t.lower.length, bonuses: b.own.length + b.lower.length };
}
