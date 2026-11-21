import { describe, expect, it } from 'vitest';
import { deckFor, MASTERED_BOX, updateDeck, type Deck } from './deck';
import { createSession, reduce } from './session';
import type { Question } from './types';

const tossup = (id: string, answer: string): Question => ({
  id, type: 'tossup', rulesets: ['ncal'], level: 'jv', difficulty: 'medium', category: 'English', subcategory: 'Literary Terms',
  status: 'active', source: 'test', created_at: '', updated_at: '', report_count: 0, random: 0.5, expires_at: null,
  text: `Question for ${answer}?`, answer, required: null, alternates: [], prompt_on: [],
  answer_type: 'general', duplicate_name: false, accepts_partial_name: false,
} as unknown as Question);

/** Plays every question: `right(id)` decides whether it is answered correctly. */
function play(pool: Question[], right: (id: string) => boolean) {
  let s = createSession({
    pool, seed: 'x', rulesetId: 'ncal', level: 'jv', kind: 'tossup', filter: { subjects: [], fullDistribution: false },
    length: { kind: 'all' }, settings: { tossupSeconds: 10, bonusSeconds: 20, bonusesOn: false }, nowIso: '2026-12-01T00:00:00.000Z',
  });
  while (s.phase !== 'done') {
    const q = s.tossups[s.tossupIndex];
    s = reduce(s, { type: 'submitAnswer', answer: right(q.id) ? q.answer : 'wrong zzz' });
    s = reduce(s, { type: 'next' });
  }
  return s;
}

const pool = [tossup('a', 'alpha'), tossup('b', 'bravo'), tossup('c', 'charlie')];
const NOW = '2026-12-01T00:00:00.000Z';

describe('missed deck', () => {
  it('adds missed questions and leaves correct ones out', () => {
    const deck = updateDeck({}, play(pool, (id) => id !== 'b'), NOW);
    expect(Object.keys(deck)).toEqual(['b']);
    expect(deck.b).toMatchObject({ box: 0, misses: 1, level: 'jv', rulesetId: 'ncal' });
  });
  it('treats a blank pass as a miss', () => {
    let s = createSession({
      pool: [tossup('a', 'alpha')], seed: 'x', rulesetId: 'ncal', level: 'jv', kind: 'tossup', filter: { subjects: [], fullDistribution: false },
      length: { kind: 'all' }, settings: { tossupSeconds: 10, bonusSeconds: 20, bonusesOn: false }, nowIso: NOW,
    });
    s = reduce(s, { type: 'submitAnswer', answer: '' });
    expect(updateDeck({}, s, NOW).a).toBeDefined();
  });
  it('moves a card up on each correct answer and removes it once mastered', () => {
    let deck: Deck = updateDeck({}, play(pool, (id) => id !== 'b'), NOW);
    for (let i = 1; i < MASTERED_BOX; i++) {
      deck = updateDeck(deck, play(pool, () => true), NOW);
      expect(deck.b.box).toBe(i);
    }
    deck = updateDeck(deck, play(pool, () => true), NOW);
    expect(deck.b).toBeUndefined();
  });
  it('sends a card back to box 0 on another miss and counts the misses', () => {
    let deck = updateDeck({}, play(pool, (id) => id !== 'b'), NOW);
    deck = updateDeck(deck, play(pool, () => true), NOW);
    deck = updateDeck(deck, play(pool, (id) => id !== 'b'), NOW);
    expect(deck.b).toMatchObject({ box: 0, misses: 2 });
  });
  it('lists a ruleset and level, least known first', () => {
    let deck = updateDeck({}, play(pool, (id) => id === 'c'), NOW); // a, b missed
    deck = updateDeck(deck, play(pool, (id) => id === 'a'), NOW); // a up a box, b missed again, c missed
    const list = deckFor(deck, 'ncal', 'jv');
    expect(list[list.length - 1].id).toBe('a');
    expect(deckFor(deck, 'ncal', 'novice')).toHaveLength(0);
    expect(deckFor(deck, 'ncal', 'jv', 'bonus')).toHaveLength(0);
  });
});

describe('weak subjects', () => {
  it('ranks the lowest-accuracy subjects first and ignores thinly-played ones', async () => {
    const { weakSubjects } = await import('./stats');
    const out = weakSubjects({
      'Math/Algebra 2': { seen: 10, correct: 3 },
      'English/Literary Terms': { seen: 10, correct: 8 },
      'Science/Biology 1': { seen: 4, correct: 0 }, // too few answers to judge
      'Math/Trigonometry': { seen: 6, correct: 1 },
    });
    expect(out.map((w) => w.key)).toEqual(['Math/Trigonometry', 'Math/Algebra 2', 'English/Literary Terms']);
  });
});
