import { describe, expect, it } from 'vitest';
import { PACE_MULTIPLIER, scaledBonusSeconds, scaledTossupSeconds, type ClockQuestion } from './clock';
import { activeClockSeconds, createSession } from './session';
import type { Question } from './types';

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
const q = (n: number, answer = 'twelve chars', type: ClockQuestion['answer_type'] = 'general'): ClockQuestion =>
  ({ text: words(n), answer, answer_type: type });

describe('scaledTossupSeconds', () => {
  it('adds reading, thinking and typing time', () => {
    // 20 words / 4 = 5, +5 to start answering, +12 chars / 3.3 = 3.64 -> 13.64 -> 14
    expect(scaledTossupSeconds(q(20), 1)).toBe(14);
  });
  it('gives long questions more time than short ones', () => {
    expect(scaledTossupSeconds(q(40), 1)).toBeGreaterThan(scaledTossupSeconds(q(10), 1));
  });
  it('scales with the pace multiplier', () => {
    expect(scaledTossupSeconds(q(20), PACE_MULTIPLIER.generous)).toBeGreaterThan(scaledTossupSeconds(q(20), PACE_MULTIPLIER.relaxed));
    expect(scaledTossupSeconds(q(20), PACE_MULTIPLIER.relaxed)).toBeGreaterThan(scaledTossupSeconds(q(20), 1));
  });
  it('skips reading time for the follow-up prompt', () => {
    expect(scaledTossupSeconds(q(40), 1, false)).toBeLessThan(scaledTossupSeconds(q(40), 1, true));
  });
  it('allows extra time for math and foreign-language answers', () => {
    expect(scaledTossupSeconds(q(20, 'x', 'math'), 1)).toBeGreaterThan(scaledTossupSeconds(q(20, 'x'), 1));
    expect(scaledTossupSeconds(q(20, 'x', 'foreign_language'), 1)).toBeGreaterThan(scaledTossupSeconds(q(20, 'x'), 1));
  });
  it('stays within bounds', () => {
    expect(scaledTossupSeconds(q(1, 'a'), 1)).toBe(9); // 0.25 + 5 to start + 3 minimum answer time
    expect(scaledTossupSeconds(q(2000), 1.6)).toBe(60);
  });
});

describe('session clock', () => {
  const tossup = {
    id: 't1', type: 'tossup', rulesets: ['ncal'], level: 'novice', difficulty: 'medium', category: 'Math', subcategory: 'Arithmetic',
    status: 'active', source: 'test', created_at: '', updated_at: '', report_count: 0, random: 0.5, expires_at: null,
    text: words(20), answer: 'twelve chars', required: null, alternates: [], prompt_on: [],
    answer_type: 'general', duplicate_name: false, accepts_partial_name: false,
  } as unknown as Question;
  const make = (settings: { tossupSeconds: number | null; tossupPace?: number }) => createSession({
    pool: [tossup], seed: 's', rulesetId: 'ncal', level: 'novice', kind: 'tossup',
    filter: { subjects: [], fullDistribution: false }, length: { kind: 'all' }, nowIso: '2026-01-01T00:00:00.000Z',
    settings: { ...settings, bonusSeconds: 20, bonusesOn: false },
  });
  it('uses the flat clock when no pace is set', () => {
    expect(activeClockSeconds(make({ tossupSeconds: 10 }))).toBe(10);
  });
  it('uses the scaled clock when a pace is set', () => {
    expect(activeClockSeconds(make({ tossupSeconds: 10, tossupPace: 1 }))).toBe(14);
  });
  it('stays untimed when untimed, even with a pace', () => {
    expect(activeClockSeconds(make({ tossupSeconds: null, tossupPace: 1 }))).toBeNull();
  });
});

describe('scaledBonusSeconds', () => {
  const bonus = (words: number, answers: string[]) => ({
    leadin: words ? Array.from({ length: words }, () => 'w').join(' ') : '',
    parts: answers.map((a) => ({ text: '', answer: a, answer_type: 'general' as const })),
  });
  it('adds reading, the 20 second confer window and typing', () => {
    // 40 words / 4 = 10, + 20 confer, + 30 chars / 3.3 = 9.09 -> 39.09 -> 40
    expect(scaledBonusSeconds(bonus(40, ['aaaaaaaaaa', 'bbbbbbbbbb', 'cccccccccc']), 1)).toBe(40);
  });
  it('always allows at least 5 seconds of answering', () => {
    expect(scaledBonusSeconds(bonus(0, ['a']), 1)).toBe(25);
  });
  it('scales with pace', () => {
    expect(scaledBonusSeconds(bonus(40, ['aaaaaaaaaa']), 1.6)).toBeGreaterThan(scaledBonusSeconds(bonus(40, ['aaaaaaaaaa']), 1));
  });
});
