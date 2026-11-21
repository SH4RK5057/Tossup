// The missed-question deck: questions you got wrong (or passed on) come back until you have them down. Pure.
//
// Each missed question sits in a "box". A miss puts it in box 0. Every later correct answer moves it up one box, and
// once it has been answered correctly MASTERED_BOX times in a row it leaves the deck. A new miss sends it back to box 0.

import type { SessionState } from './session';
import type { Level, RulesetId } from './types';

export const MASTERED_BOX = 3;

export interface DeckEntry {
  id: string;
  type: 'tossup' | 'bonus';
  rulesetId: RulesetId;
  level: Level;
  category: string;
  subcategory: string;
  /** Consecutive correct answers since the last miss. */
  box: number;
  /** How many times it has been missed in all. */
  misses: number;
  /** ISO time of the last time it was seen. */
  lastSeen: string;
}

export type Deck = Record<string, DeckEntry>;

/** Applies a finished session to the deck: misses go in (or back to box 0), correct answers move cards up and out. */
export function updateDeck(deck: Deck, s: SessionState, nowIso: string): Deck {
  const next: Deck = { ...deck };
  const tossups = new Map(s.tossups.map((t) => [t.id, t]));
  const bonuses = new Map(s.bonuses.map((b) => [b.id, b]));
  for (const r of s.records) {
    const q = r.kind === 'tossup' ? tossups.get(r.questionId) : bonuses.get(r.questionId);
    if (!q) continue;
    const correct = r.kind === 'tossup' ? r.correct : r.parts.every((p) => p.correct);
    const existing = next[q.id];
    if (!correct) {
      next[q.id] = {
        id: q.id, type: r.kind, rulesetId: s.rulesetId, level: s.level, category: q.category, subcategory: q.subcategory,
        box: 0, misses: (existing?.misses ?? 0) + 1, lastSeen: nowIso,
      };
    } else if (existing) {
      const box = existing.box + 1;
      if (box >= MASTERED_BOX) delete next[q.id];
      else next[q.id] = { ...existing, box, lastSeen: nowIso };
    }
  }
  return next;
}

/** Deck entries for one ruleset and level, lowest box (least known) first. */
export function deckFor(deck: Deck, rulesetId: RulesetId, level: Level, type?: 'tossup' | 'bonus'): DeckEntry[] {
  return Object.values(deck)
    .filter((e) => e.rulesetId === rulesetId && e.level === level && (!type || e.type === type))
    .sort((a, b) => a.box - b.box || b.misses - a.misses);
}
