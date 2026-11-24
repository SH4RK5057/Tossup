// Turns room settings into the same question list on every screen. Nothing about the questions travels over the
// network: everyone loads the baked question bank and builds the order from the host's seed and filters.

import { check } from '../core/checker';
import { bonusAnswerSeconds, buzzAnswerSeconds } from '../core/clock';
import { buildBonusSequence, buildTossupSequence } from '../core/pool';
import type { RoomMode } from '../core/room';
import { getRuleset } from '../core/rulesets';
import type { Bonus, Difficulty, Level, Question, RulesetId, Tossup } from '../core/types';
import type { HostBonus, HostQuestion } from './host';

export interface RoomSettings {
  /** tossup, bonus (bonus drill) or sim (game sim), the same three modes as solo practice. */
  mode: RoomMode;
  rulesetId: RulesetId;
  level: Level;
  /** "Category/Subcategory" keys; empty = everything at the level. */
  subjects: string[];
  /** Draw by the ruleset's subject distribution instead of the chosen subjects (same switch as solo practice). */
  fullDistribution: boolean;
  difficulties: Difficulty[];
  /** Answer time after a buzz: scaled to the answer length (times `pace`), or a flat number of seconds. */
  answerMode: 'scaled' | 'flat';
  pace: number;
  flatSeconds: number;
  /** Answer time for a bonus once it has been read: scaled to its answers (times `pace`), or flat seconds. */
  bonusMode: 'scaled' | 'flat';
  bonusFlatSeconds: number;
  /** How fast the question is revealed. */
  wordsPerSecond: number;
  teamMode: 'teams' | 'ffa';
  teamCount: number;
  /** Number of tossups in the game (for an unlimited game, the most it can run). */
  questions: number;
  /** No fixed length: the host ends the game (or the question pool runs out). */
  unlimited?: boolean;
  seed: string;
  /** Fixed at room creation so every screen drops the same expired questions. */
  nowIso: string;
  /** Fingerprint of the question bank the host loaded; a different one means a different site version. */
  bankSig: string;
}

/** A cheap fingerprint of a question pool (count plus a hash of the ids). */
export function poolSignature(pool: Question[]): string {
  let h = 5381;
  for (const id of pool.map((q) => q.id).sort()) for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0;
  return `${pool.length}:${h.toString(36)}`;
}

/** The game's tossups, identical on every screen for the same pool and settings. */
export function buildRoomQuestions(pool: Question[], s: RoomSettings): Tossup[] {
  const rs = getRuleset(s.rulesetId);
  return buildTossupSequence({
    pool: pool.filter((q): q is Tossup => q.type === 'tossup'),
    ruleset: rs,
    level: s.level,
    filter: { subjects: s.subjects, fullDistribution: s.fullDistribution, difficulties: s.difficulties },
    seed: s.seed,
    limit: s.questions,
    nowIso: s.nowIso,
  });
}

export const wordsOf = (text: string): string[] => text.trim().split(/\s+/).filter(Boolean);

/** The first `n` words of a question, as revealed so far. */
export function revealedText(text: string, n: number): string {
  return wordsOf(text).slice(0, n).join(' ');
}

/** What the host's referee needs to know about each question. */
export function toHostQuestions(tossups: Tossup[], rulesetId: RulesetId, timing: Pick<RoomSettings, 'answerMode' | 'pace' | 'flatSeconds'>): HostQuestion[] {
  const rs = getRuleset(rulesetId);
  return tossups.map((q) => ({
    wordCount: wordsOf(q.text).length,
    answerSeconds: timing.answerMode === 'flat' ? timing.flatSeconds : Math.min(60, Math.ceil(buzzAnswerSeconds(q) * timing.pace)),
    judge: (typed) => (check(typed, q, rs) === 'correct' ? 'correct' : 'wrong'),
  }));
}

export const READING_SPEEDS = [
  { label: 'Slow', wordsPerSecond: 2.5 },
  { label: 'Normal', wordsPerSecond: 3.3 },
  { label: 'Fast', wordsPerSecond: 4.4 },
] as const;

export const TEAM_IDS = ['A', 'B', 'C', 'D'] as const;
export const teamLabel = (id: string) => (TEAM_IDS as readonly string[]).includes(id) ? `Team ${id}` : id;

/**
 * Fills in settings a database may have dropped: Realtime Database does not store empty lists, so "no subject
 * filter" (an empty list) comes back as a missing field.
 */
export function normalizeSettings(raw: Partial<RoomSettings> & Record<string, unknown>): RoomSettings {
  const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : v && typeof v === 'object' ? (Object.values(v) as T[]) : []);
  return {
    ...(raw as RoomSettings),
    subjects: list<string>(raw.subjects),
    mode: raw.mode === 'bonus' || raw.mode === 'sim' ? raw.mode : 'tossup',
    fullDistribution: raw.fullDistribution === true,
    bonusMode: raw.bonusMode === 'flat' ? 'flat' : 'scaled',
    bonusFlatSeconds: typeof raw.bonusFlatSeconds === 'number' ? raw.bonusFlatSeconds : 30,
    answerMode: raw.answerMode === 'flat' ? 'flat' : 'scaled',
    pace: typeof raw.pace === 'number' ? raw.pace : 1,
    flatSeconds: typeof raw.flatSeconds === 'number' ? raw.flatSeconds : 10,
    difficulties: list<Difficulty>(raw.difficulties).length ? list<Difficulty>(raw.difficulties) : ['easy', 'medium', 'hard'],
  };
}

// ------------------------------------------------------------------ bonuses

/** The game's bonuses, identical on every screen for the same pool and settings. */
export function buildRoomBonuses(pool: Question[], s: RoomSettings): Bonus[] {
  if (s.mode === 'tossup') return [];
  return buildBonusSequence({
    pool: pool.filter((q): q is Bonus => q.type === 'bonus'),
    ruleset: getRuleset(s.rulesetId),
    level: s.level,
    filter: { subjects: s.subjects, fullDistribution: s.fullDistribution, difficulties: s.difficulties },
    seed: s.seed,
    limit: s.questions,
    nowIso: s.nowIso,
  });
}

/** Every word of a bonus in reading order: the lead-in, then each part. */
export function bonusWordCount(b: Pick<Bonus, 'leadin' | 'parts'>): number {
  return wordsOf(b.leadin).length + b.parts.reduce((n, p) => n + wordsOf(p.text).length, 0);
}

/** The lead-in and each part as revealed so far when `n` words have been read. */
export function revealedBonus(b: Pick<Bonus, 'leadin' | 'parts'>, n: number): { leadin: string; parts: string[] } {
  let left = n;
  const take = (text: string) => {
    const w = wordsOf(text);
    const got = w.slice(0, Math.max(0, left));
    left -= w.length;
    return got.join(' ');
  };
  const leadin = take(b.leadin);
  return { leadin, parts: b.parts.map((p) => take(p.text)) };
}

/** What the host's referee needs to know about each bonus. */
export function toHostBonuses(
  bonuses: Bonus[], rulesetId: RulesetId, timing: Pick<RoomSettings, 'bonusMode' | 'bonusFlatSeconds' | 'pace'>,
): HostBonus[] {
  const rs = getRuleset(rulesetId);
  return bonuses.map((b) => ({
    wordCount: bonusWordCount(b),
    partCount: b.parts.length,
    answerSeconds: timing.bonusMode === 'flat' ? timing.bonusFlatSeconds : bonusAnswerSeconds(b, timing.pace),
    judge: (answers) => b.parts.map((p, i) => check(answers[i] ?? '', p, rs) === 'correct'),
  }));
}
