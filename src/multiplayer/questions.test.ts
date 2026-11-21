import { describe, expect, it } from 'vitest';
import { buildRoomQuestions, normalizeSettings, poolSignature, revealedText, toHostQuestions, wordsOf, type RoomSettings } from './questions';
import type { Question } from '../core/types';

const t = (id: string, text: string, answer: string, sub = 'Literary Terms'): Question => ({
  id, type: 'tossup', rulesets: ['ncal'], level: 'jv', difficulty: 'medium', category: 'English', subcategory: sub,
  status: 'active', source: 'test', created_at: '', updated_at: '', report_count: 0, random: 0.5, expires_at: null,
  text, answer, required: null, alternates: [], prompt_on: [], answer_type: 'general', duplicate_name: false, accepts_partial_name: false,
} as unknown as Question);

const pool = Array.from({ length: 12 }, (_, i) => t(`q${i}`, `Which word number ${i} is the answer here?`, `answer${i}`));
const settings: RoomSettings = {
  rulesetId: 'ncal', level: 'jv', subjects: [], difficulties: ['easy', 'medium', 'hard'], wordsPerSecond: 3.3,
  teamMode: 'teams', teamCount: 2, questions: 5, seed: 'abc', nowIso: '2026-12-01T00:00:00.000Z', bankSig: poolSignature(pool),
};

describe('room questions', () => {
  it('builds the same question order for the same seed, and a different one for another seed', () => {
    const a = buildRoomQuestions(pool, settings).map((q) => q.id);
    const b = buildRoomQuestions([...pool].reverse(), settings).map((q) => q.id);
    expect(a).toHaveLength(5);
    expect(b).toEqual(a); // the order of the loaded pool does not matter
    expect(buildRoomQuestions(pool, { ...settings, seed: 'xyz' }).map((q) => q.id)).not.toEqual(a);
  });
  it('fingerprints the pool', () => {
    expect(poolSignature(pool)).toBe(poolSignature([...pool].reverse()));
    expect(poolSignature(pool)).not.toBe(poolSignature(pool.slice(1)));
  });
  it('reveals a question word by word', () => {
    expect(wordsOf('  a  b c ')).toEqual(['a', 'b', 'c']);
    expect(revealedText('one two three four', 2)).toBe('one two');
    expect(revealedText('one two', 0)).toBe('');
  });
  it('judges typed answers with the real checker', () => {
    const [q] = toHostQuestions([pool[0] as never], 'ncal');
    expect(q.wordCount).toBe(8);
    expect(q.answerSeconds).toBeGreaterThanOrEqual(5);
    expect(q.judge('Answer0')).toBe('correct');
    expect(q.judge('nope')).toBe('wrong');
    expect(q.judge('')).toBe('wrong');
  });
});

describe('normalizeSettings', () => {
  it('restores the empty subject list a database drops, so questions still build', () => {
    const stripped: Record<string, unknown> = { ...settings };
    delete stripped.subjects; // what Realtime Database returns for an empty list
    const back = normalizeSettings(stripped);
    expect(back.subjects).toEqual([]);
    expect(buildRoomQuestions(pool, back).map((q) => q.id)).toEqual(buildRoomQuestions(pool, settings).map((q) => q.id));
  });
  it('accepts lists that came back as objects', () => {
    expect(normalizeSettings({ ...settings, subjects: { 0: 'English/Literary Terms' } as never }).subjects).toEqual(['English/Literary Terms']);
  });
});
