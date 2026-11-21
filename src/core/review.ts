// End-of-session review: what was asked, what the player typed, and the correct answer. Pure.

import type { SessionState } from './session';
import type { Bonus, Tossup } from './types';

export interface ReviewPart {
  /** The question text (a tossup's text, or a bonus part's text). */
  text: string;
  answer: string;
  typed: string;
  correct: boolean;
  timedOut: boolean;
}

export interface ReviewItem {
  kind: 'tossup' | 'bonus';
  questionId: string;
  category: string;
  subcategory: string;
  /** Bonuses only. */
  leadin?: string;
  parts: ReviewPart[];
  /** True when every part was answered correctly. */
  allCorrect: boolean;
}

/** One entry per question played, in the order played. */
export function buildReview(s: SessionState): ReviewItem[] {
  const tossups = new Map(s.tossups.map((t) => [t.id, t]));
  const bonuses = new Map(s.bonuses.map((b) => [b.id, b]));
  const out: ReviewItem[] = [];
  for (const r of s.records) {
    if (r.kind === 'tossup') {
      const q = tossups.get(r.questionId);
      if (!q) continue;
      out.push({
        kind: 'tossup', questionId: q.id, category: q.category, subcategory: q.subcategory,
        parts: [{ text: q.text, answer: q.answer, typed: r.typed, correct: r.correct, timedOut: r.timedOut }],
        allCorrect: r.correct,
      });
    } else {
      const q = bonuses.get(r.questionId);
      if (!q) continue;
      const parts = r.parts.map((p, i) => ({
        text: q.parts[i]?.text ?? '', answer: q.parts[i]?.answer ?? '', typed: p.typed, correct: p.correct, timedOut: p.timedOut,
      }));
      out.push({
        kind: 'bonus', questionId: q.id, category: q.category, subcategory: q.subcategory, leadin: q.leadin,
        parts, allCorrect: parts.every((p) => p.correct),
      });
    }
  }
  return out;
}

/** The questions the player got wrong (any wrong part for a bonus), ready to be practiced again. */
export function missedQuestions(s: SessionState): { tossups: Tossup[]; bonuses: Bonus[] } {
  const items = buildReview(s).filter((i) => !i.allCorrect);
  const ids = new Set(items.map((i) => i.questionId));
  return {
    tossups: s.tossups.filter((t) => ids.has(t.id) && items.some((i) => i.kind === 'tossup' && i.questionId === t.id)),
    bonuses: s.bonuses.filter((b) => ids.has(b.id) && items.some((i) => i.kind === 'bonus' && i.questionId === b.id)),
  };
}
