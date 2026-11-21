import { describe, expect, it } from 'vitest';
import { buildReview, missedQuestions } from './review';
import { createSession, reduce } from './session';
import type { Question } from './types';

const tossup = (id: string, answer: string): Question => ({
  id, type: 'tossup', rulesets: ['ncal'], level: 'novice', difficulty: 'medium', category: 'English', subcategory: 'Literary Terms',
  status: 'active', source: 'test', created_at: '', updated_at: '', report_count: 0, random: 0.5, expires_at: null,
  text: `Question for ${answer}?`, answer, required: null, alternates: [], prompt_on: [],
  answer_type: 'general', duplicate_name: false, accepts_partial_name: false,
} as unknown as Question);

const start = (n: number, length: { kind: 'all' } | { kind: 'count'; n: number }, kind: 'tossup' | 'sim' = 'tossup') => createSession({
  pool: Array.from({ length: n }, (_, i) => tossup(`t${i}`, `answer${i}`)),
  seed: 'seed', rulesetId: 'ncal', level: 'novice', kind,
  filter: { subjects: [], fullDistribution: false }, length,
  settings: { tossupSeconds: 10, bonusSeconds: 20, bonusesOn: false }, nowIso: '2026-12-01T00:00:00.000Z',
});

describe('review', () => {
  it('lists each question played with what was typed and the key', () => {
    let s = start(3, { kind: 'all' });
    const first = s.tossups[s.tossupIndex];
    s = reduce(s, { type: 'submitAnswer', answer: first.answer }); // right
    s = reduce(s, { type: 'next' });
    s = reduce(s, { type: 'submitAnswer', answer: 'nonsense' }); // wrong
    const items = buildReview(s);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ allCorrect: true });
    expect(items[1].parts[0]).toMatchObject({ typed: 'nonsense', correct: false });
    expect(items[1].parts[0].answer).toMatch(/^answer\d$/);
  });
  it('collects only the missed questions for a retry', () => {
    let s = start(3, { kind: 'all' });
    s = reduce(s, { type: 'submitAnswer', answer: 'wrong' });
    s = reduce(s, { type: 'next' });
    s = reduce(s, { type: 'submitAnswer', answer: s.tossups[s.tossupIndex].answer });
    const missed = missedQuestions(s);
    expect(missed.tossups).toHaveLength(1);
    expect(missed.bonuses).toHaveLength(0);
  });
  it('marks an unlimited game sim as endless', () => {
    expect(start(5, { kind: 'all' }, 'sim').endless).toBe(true);
    expect(start(5, { kind: 'count', n: 3 }, 'sim').endless).toBe(false);
  });
});
