// Pure session engine: (state, action) -> new state. No React, DOM, Firebase or timers.
// Timers live in the UI layer and dispatch `timeout` / `clockExpired`.

import { check } from './checker';
import { buildBonusSequence, buildTossupSequence, type PoolFilter } from './pool';
import { getRuleset } from './rulesets';
import type { Ruleset } from './rulesets/types';
import type { AnswerSpec, Bonus, Level, PartDifficulty, Question, RulesetId, Tossup } from './types';

export type SessionKind = 'tossup' | 'bonus' | 'sim';

export interface SessionSettings {
  /** Seconds to answer a tossup; null = untimed. */
  tossupSeconds: number | null;
  /** NCAL: seconds for the whole bonus. Quizbowl: seconds per part. null = untimed. */
  bonusSeconds: number | null;
  bonusesOn: boolean;
}

export type SessionLength =
  | { kind: 'all' }
  | { kind: 'count'; n: number }
  /** Ruleset's match simulation (game clock or its fixed tossup count). */
  | { kind: 'match' };

export interface SessionInput {
  pool: Question[];
  seed: string;
  rulesetId: RulesetId;
  level: Level;
  kind: SessionKind;
  filter: PoolFilter;
  settings: SessionSettings;
  length: SessionLength;
  /** ISO timestamp used to drop expired questions. Passed in to keep the engine pure. */
  nowIso: string;
}

export type Phase =
  | 'tossup'          // awaiting a typed answer
  | 'tossup_prompt'   // "More specific?" - one more attempt
  | 'tossup_result'
  | 'bonus_intro'     // lead-in shown, waiting for the player to start
  | 'bonus'           // bonus parts live (all at once for NCAL, one at a time for quizbowl)
  | 'bonus_part_result' // quizbowl: result of a single part
  | 'bonus_result'
  | 'done';

export interface TossupRecord {
  kind: 'tossup';
  questionId: string;
  category: string;
  subcategory: string;
  correct: boolean;
  points: number;
  typed: string;
  timedOut: boolean;
  overridden: boolean;
}
export interface BonusPartRecord {
  difficulty: PartDifficulty;
  correct: boolean;
  typed: string;
  points: number;
  timedOut: boolean;
  overridden: boolean;
}
export interface BonusRecord {
  kind: 'bonus';
  questionId: string;
  category: string;
  subcategory: string;
  parts: BonusPartRecord[];
  points: number;
}
export type QuestionRecord = TossupRecord | BonusRecord;

export interface SessionState {
  rulesetId: RulesetId;
  level: Level;
  kind: SessionKind;
  seed: string;
  settings: SessionSettings;
  filter: PoolFilter;
  tossups: Tossup[];
  bonuses: Bonus[];
  /** Index of the tossup in play (or just played). */
  tossupIndex: number;
  /** Index of the bonus in play; bonuses are consumed in order. */
  bonusIndex: number;
  /** Quizbowl bonuses: index of the part in play. */
  partIndex: number;
  phase: Phase;
  /** Incremented whenever a timer should restart (new question, prompt, new part). */
  clockKey: number;
  score: number;
  records: QuestionRecord[];
  /** Partially built bonus record while a bonus is in progress. */
  currentBonusParts: BonusPartRecord[];
  /** Match-sim game clock has run out: finish the cycle in progress, then stop. */
  clockExpired: boolean;
  /** Fixed tossup count for the session (match sim with a count, or a chosen length). */
  maxTossups: number;
  /** Whether the tossup in play was answered with a prompt first. */
  prompted: boolean;
  /** Game clock length in seconds for the match sim, if any. */
  gameClockSeconds: number | null;
}

export type Action =
  | { type: 'submitAnswer'; answer: string }
  | { type: 'submitBonus'; answers: string[] }
  | { type: 'timeout'; answer?: string; answers?: string[] }
  | { type: 'startBonus' }
  | { type: 'next' }
  | { type: 'override'; part?: number }
  | { type: 'clockExpired' }
  | { type: 'end' };

export function createSession(input: SessionInput): SessionState {
  const ruleset = getRuleset(input.rulesetId);
  const tossupsPool = input.pool.filter((q): q is Tossup => q.type === 'tossup');
  const bonusPool = input.pool.filter((q): q is Bonus => q.type === 'bonus');
  const base = { ruleset, level: input.level, filter: input.filter, seed: input.seed, nowIso: input.nowIso };

  let limit: number | undefined;
  let gameClockSeconds: number | null = null;
  if (input.length.kind === 'count') limit = input.length.n;
  if (input.length.kind === 'match') {
    if (ruleset.match.kind === 'count') limit = ruleset.match.tossups;
    else {
      limit = ruleset.match.maxTossups;
      gameClockSeconds = ruleset.match.minutes[input.level] * 60;
    }
  }

  const tossups = input.kind === 'bonus' ? [] : buildTossupSequence({ ...base, pool: tossupsPool, limit });
  const needsBonuses = input.kind === 'bonus' || (input.kind === 'sim' && input.settings.bonusesOn);
  const bonuses = needsBonuses
    ? buildBonusSequence({ ...base, pool: bonusPool, limit: input.kind === 'bonus' ? limit : undefined })
    : [];

  const state: SessionState = {
    rulesetId: input.rulesetId,
    level: input.level,
    kind: input.kind,
    seed: input.seed,
    settings: input.settings,
    filter: input.filter,
    tossups,
    bonuses,
    tossupIndex: 0,
    bonusIndex: 0,
    partIndex: 0,
    phase: 'tossup',
    clockKey: 1,
    score: 0,
    records: [],
    currentBonusParts: [],
    clockExpired: false,
    maxTossups: tossups.length,
    prompted: false,
    gameClockSeconds,
  };
  if (input.kind === 'bonus') return bonuses.length ? { ...state, phase: 'bonus_intro' } : { ...state, phase: 'done' };
  return tossups.length ? state : { ...state, phase: 'done' };
}

// ---------------------------------------------------------------- selectors

export const currentTossup = (s: SessionState): Tossup | undefined => s.tossups[s.tossupIndex];
export const currentBonus = (s: SessionState): Bonus | undefined => s.bonuses[s.bonusIndex];
export const ruleOf = (s: SessionState): Ruleset => getRuleset(s.rulesetId);

export function lastTossupRecord(s: SessionState): TossupRecord | undefined {
  for (let i = s.records.length - 1; i >= 0; i--) {
    const r = s.records[i];
    if (r.kind === 'tossup') return r;
  }
  return undefined;
}

export function lastBonusRecord(s: SessionState): BonusRecord | undefined {
  const r = s.records[s.records.length - 1];
  return r && r.kind === 'bonus' ? r : undefined;
}

/** True when the NCAL-style bonus shows all parts at once under one clock. */
export const bonusIsTogether = (s: SessionState) => ruleOf(s).bonus.timing === 'together';

/** Seconds on the clock for the current phase, or null if untimed / no clock. */
export function activeClockSeconds(s: SessionState): number | null {
  if (s.phase === 'tossup' || s.phase === 'tossup_prompt') return s.settings.tossupSeconds;
  if (s.phase === 'bonus') return s.settings.bonusSeconds;
  return null;
}

// ------------------------------------------------------------------ reducer

function gradeBonusPart(typed: string, spec: AnswerSpec, ruleset: Ruleset, difficulty: PartDifficulty, timedOut: boolean): BonusPartRecord {
  const correct = check(typed, spec, ruleset) === 'correct';
  return { difficulty, correct, typed, points: correct ? ruleset.bonus.pointsPerPart : 0, timedOut, overridden: false };
}

function recordTossup(s: SessionState, typed: string, correct: boolean, timedOut: boolean): SessionState {
  const q = currentTossup(s)!;
  const r = ruleOf(s);
  const points = correct ? r.tossupValue : r.wrongTossupPoints;
  const rec: TossupRecord = {
    kind: 'tossup', questionId: q.id, category: q.category, subcategory: q.subcategory,
    correct, points, typed, timedOut, overridden: false,
  };
  return { ...s, phase: 'tossup_result', score: s.score + points, records: [...s.records, rec] };
}

function answerTossup(s: SessionState, typed: string, isTimeout: boolean): SessionState {
  const q = currentTossup(s);
  if (!q) return s;
  const result = check(typed, q, ruleOf(s));
  if (result === 'prompt' && !isTimeout && s.phase === 'tossup') {
    return { ...s, phase: 'tossup_prompt', prompted: true, clockKey: s.clockKey + 1 };
  }
  return recordTossup(s, typed, result === 'correct', isTimeout && !typed.trim());
}

function finishBonus(s: SessionState, parts: BonusPartRecord[]): SessionState {
  const q = currentBonus(s)!;
  const points = parts.reduce((sum, p) => sum + p.points, 0);
  const rec: BonusRecord = { kind: 'bonus', questionId: q.id, category: q.category, subcategory: q.subcategory, parts, points };
  return { ...s, phase: 'bonus_result', score: s.score + points, records: [...s.records, rec], currentBonusParts: [] };
}

function submitTogether(s: SessionState, answers: string[], timedOut: boolean): SessionState {
  const q = currentBonus(s);
  if (!q) return s;
  const r = ruleOf(s);
  const parts = q.parts.map((p, i) => gradeBonusPart(answers[i] ?? '', p, r, p.part_difficulty, timedOut && !(answers[i] ?? '').trim()));
  return finishBonus(s, parts);
}

function submitPart(s: SessionState, typed: string, timedOut: boolean): SessionState {
  const q = currentBonus(s);
  if (!q) return s;
  const part = q.parts[s.partIndex];
  const rec = gradeBonusPart(typed, part, ruleOf(s), part.part_difficulty, timedOut && !typed.trim());
  const parts = [...s.currentBonusParts, rec];
  if (parts.length >= q.parts.length) return finishBonus(s, parts);
  return { ...s, phase: 'bonus_part_result', currentBonusParts: parts };
}

/** Moves on after a finished cycle (tossup, or tossup + bonus). */
function advance(s: SessionState): SessionState {
  if (s.kind === 'bonus') {
    const nextBonus = s.bonusIndex + 1;
    if (nextBonus >= s.bonuses.length) return { ...s, phase: 'done' };
    return { ...s, bonusIndex: nextBonus, partIndex: 0, phase: 'bonus_intro', clockKey: s.clockKey + 1 };
  }
  const nextIndex = s.tossupIndex + 1;
  if (s.clockExpired || nextIndex >= s.tossups.length) return { ...s, phase: 'done' };
  return { ...s, tossupIndex: nextIndex, phase: 'tossup', prompted: false, clockKey: s.clockKey + 1 };
}

export function reduce(s: SessionState, a: Action): SessionState {
  if (s.phase === 'done') return s;
  switch (a.type) {
    case 'submitAnswer':
      if (s.phase === 'tossup' || s.phase === 'tossup_prompt') return answerTossup(s, a.answer, false);
      if (s.phase === 'bonus' && !bonusIsTogether(s)) return submitPart(s, a.answer, false);
      return s;
    case 'submitBonus':
      return s.phase === 'bonus' && bonusIsTogether(s) ? submitTogether(s, a.answers, false) : s;
    case 'timeout':
      if (s.phase === 'tossup' || s.phase === 'tossup_prompt') return answerTossup(s, a.answer ?? '', true);
      if (s.phase === 'bonus') {
        return bonusIsTogether(s) ? submitTogether(s, a.answers ?? [], true) : submitPart(s, a.answer ?? '', true);
      }
      return s;
    case 'startBonus':
      return s.phase === 'bonus_intro' ? { ...s, phase: 'bonus', partIndex: 0, clockKey: s.clockKey + 1 } : s;
    case 'next':
      return next(s);
    case 'override':
      return override(s, a.part);
    case 'clockExpired':
      return { ...s, clockExpired: true };
    case 'end':
      return { ...s, phase: 'done' };
  }
}

function next(s: SessionState): SessionState {
  if (s.phase === 'tossup_result') {
    const rec = lastTossupRecord(s);
    const hasBonus = s.kind === 'sim' && s.settings.bonusesOn && s.bonusIndex < s.bonuses.length;
    if (rec?.correct && hasBonus) return { ...s, phase: 'bonus_intro', partIndex: 0, clockKey: s.clockKey + 1 };
    return advance(s);
  }
  if (s.phase === 'bonus_part_result') {
    return { ...s, phase: 'bonus', partIndex: s.partIndex + 1, clockKey: s.clockKey + 1 };
  }
  if (s.phase === 'bonus_result') {
    // In a sim the bonus is consumed; the next cycle starts with a new tossup.
    const consumed = { ...s, bonusIndex: s.bonusIndex + (s.kind === 'sim' ? 1 : 0) };
    return s.kind === 'sim' ? advance(consumed) : advance(s);
  }
  return s;
}

/** "I was right": marks the result just shown as correct and fixes the score. */
function override(s: SessionState, part?: number): SessionState {
  const records = [...s.records];
  if (s.phase === 'tossup_result') {
    const i = records.length - 1;
    const rec = records[i];
    if (!rec || rec.kind !== 'tossup' || rec.correct) return s;
    const points = ruleOf(s).tossupValue;
    records[i] = { ...rec, correct: true, points, overridden: true };
    return { ...s, records, score: s.score - rec.points + points };
  }
  const r = ruleOf(s);
  if (s.phase === 'bonus_part_result') {
    const idx = part ?? s.currentBonusParts.length - 1;
    const rec = s.currentBonusParts[idx];
    if (!rec || rec.correct) return s;
    const parts = [...s.currentBonusParts];
    parts[idx] = { ...rec, correct: true, points: r.bonus.pointsPerPart, overridden: true };
    return { ...s, currentBonusParts: parts };
  }
  if (s.phase === 'bonus_result') {
    const i = records.length - 1;
    const rec = records[i];
    if (!rec || rec.kind !== 'bonus' || part === undefined) return s;
    const p = rec.parts[part];
    if (!p || p.correct) return s;
    const parts = [...rec.parts];
    parts[part] = { ...p, correct: true, points: r.bonus.pointsPerPart, overridden: true };
    records[i] = { ...rec, parts, points: rec.points + r.bonus.pointsPerPart };
    return { ...s, records, score: s.score + r.bonus.pointsPerPart };
  }
  return s;
}

/** Number shown on the scoreboard ("Question 3"). */
export function questionNumber(s: SessionState): number {
  return s.kind === 'bonus' ? s.bonusIndex + 1 : s.tossupIndex + 1;
}
export function questionTotal(s: SessionState): number {
  return s.kind === 'bonus' ? s.bonuses.length : s.maxTossups;
}
