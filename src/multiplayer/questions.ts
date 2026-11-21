// Turns room settings into the same question list on every screen. Nothing about the questions travels over the
// network: everyone loads the baked question bank and builds the order from the host's seed and filters.

import { check } from '../core/checker';
import { buzzAnswerSeconds } from '../core/clock';
import { buildTossupSequence } from '../core/pool';
import { getRuleset } from '../core/rulesets';
import type { Difficulty, Level, Question, RulesetId, Tossup } from '../core/types';
import type { HostQuestion } from './host';

export interface RoomSettings {
  rulesetId: RulesetId;
  level: Level;
  /** "Category/Subcategory" keys; empty = everything at the level. */
  subjects: string[];
  difficulties: Difficulty[];
  /** How fast the question is revealed. */
  wordsPerSecond: number;
  teamMode: 'teams' | 'ffa';
  teamCount: number;
  /** Number of tossups in the game. */
  questions: number;
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
    filter: { subjects: s.subjects, fullDistribution: false, difficulties: s.difficulties },
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
export function toHostQuestions(tossups: Tossup[], rulesetId: RulesetId): HostQuestion[] {
  const rs = getRuleset(rulesetId);
  return tossups.map((q) => ({
    wordCount: wordsOf(q.text).length,
    answerSeconds: buzzAnswerSeconds(q),
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
