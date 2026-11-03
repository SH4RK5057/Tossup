import type { SessionKind, SessionSettings, SessionState } from './session';
import type { Level, PartDifficulty, RulesetId } from './types';

export interface Tally { seen: number; correct: number }

export interface SessionSummary {
  id: string;
  date: string;
  rulesetId: RulesetId;
  level: Level;
  kind: SessionKind;
  /** Snapshot of the settings this session was played with. */
  settings: SessionSettings;
  /** Any applicable timer was turned off. */
  untimed: boolean;
  score: number;
  tossups: Tally;
  /** Longest run of correct tossups in a row. */
  bestStreak: number;
  bonuses: { played: number; points: number; parts: Record<PartDifficulty, Tally> };
  /** Tally per "Category/Subcategory", counting tossups and bonus parts. */
  bySubject: Record<string, Tally>;
}

const emptyTally = (): Tally => ({ seen: 0, correct: 0 });
const bump = (t: Tally, correct: boolean) => { t.seen++; if (correct) t.correct++; };

export function isUntimed(kind: SessionKind, settings: SessionSettings): boolean {
  const tossupUntimed = kind !== 'bonus' && settings.tossupSeconds === null;
  const bonusUntimed = (kind === 'bonus' || (kind === 'sim' && settings.bonusesOn)) && settings.bonusSeconds === null;
  return tossupUntimed || bonusUntimed;
}

export function summarize(s: SessionState, id: string, dateIso: string): SessionSummary {
  const tossups = emptyTally();
  const parts: Record<PartDifficulty, Tally> = { easy: emptyTally(), medium: emptyTally(), hard: emptyTally() };
  const bySubject: Record<string, Tally> = {};
  let played = 0;
  let bonusPoints = 0;
  let streak = 0;
  let bestStreak = 0;
  const subj = (c: string, sc: string) => (bySubject[`${c}/${sc}`] ??= emptyTally());
  for (const r of s.records) {
    if (r.kind === 'tossup') {
      bump(tossups, r.correct);
      bump(subj(r.category, r.subcategory), r.correct);
      streak = r.correct ? streak + 1 : 0;
      bestStreak = Math.max(bestStreak, streak);
    } else {
      played++;
      bonusPoints += r.points;
      for (const p of r.parts) {
        bump(parts[p.difficulty], p.correct);
        bump(subj(r.category, r.subcategory), p.correct);
      }
    }
  }
  return {
    id, date: dateIso, rulesetId: s.rulesetId, level: s.level, kind: s.kind, settings: s.settings,
    untimed: isUntimed(s.kind, s.settings), score: s.score, tossups, bestStreak,
    bonuses: { played, points: bonusPoints, parts }, bySubject,
  };
}

export interface AggregateOptions {
  rulesetId: RulesetId;
  includeUntimed: boolean;
}

export interface Aggregate {
  sessions: number;
  tossups: Tally;
  bySubject: Record<string, Tally>;
  /** Points per bonus, over sessions that included bonuses. null if none. */
  ppb: number | null;
  bonusesPlayed: number;
  parts: Record<PartDifficulty, Tally>;
}

/** NCAL and quizbowl are never mixed: callers pick one ruleset. */
export function aggregate(all: SessionSummary[], opts: AggregateOptions): Aggregate {
  const out: Aggregate = {
    sessions: 0, tossups: emptyTally(), bySubject: {}, ppb: null, bonusesPlayed: 0,
    parts: { easy: emptyTally(), medium: emptyTally(), hard: emptyTally() },
  };
  let bonusPoints = 0;
  for (const s of all) {
    if (s.rulesetId !== opts.rulesetId) continue;
    if (s.untimed && !opts.includeUntimed) continue;
    out.sessions++;
    out.tossups.seen += s.tossups.seen;
    out.tossups.correct += s.tossups.correct;
    for (const [k, t] of Object.entries(s.bySubject)) {
      const dest = (out.bySubject[k] ??= emptyTally());
      dest.seen += t.seen;
      dest.correct += t.correct;
    }
    const withBonuses = s.kind === 'bonus' || (s.kind === 'sim' && s.settings.bonusesOn);
    if (withBonuses) {
      out.bonusesPlayed += s.bonuses.played;
      bonusPoints += s.bonuses.points;
      for (const d of ['easy', 'medium', 'hard'] as const) {
        out.parts[d].seen += s.bonuses.parts[d].seen;
        out.parts[d].correct += s.bonuses.parts[d].correct;
      }
    }
  }
  out.ppb = out.bonusesPlayed ? bonusPoints / out.bonusesPlayed : null;
  return out;
}

export const accuracy = (t: Tally): number | null => (t.seen ? t.correct / t.seen : null);
