import { describe, expect, it } from 'vitest';
import type { Question } from '../core/types';
import { settingsSchema, type Settings } from '../storage/storage';
import { makeRoomSettings, questionProblem, reassignTeams, roomToSettings, UNLIMITED_CAP } from './roomOps';
import type { RoomPlayer } from './host';

const base = (patch: Partial<Settings> = {}): Settings => ({ ...settingsSchema.parse({}), ...patch });
const FRESH = { seed: 'seed1', nowIso: '2026-12-01T00:00:00.000Z' };

const tossup = (id: string, sub = 'Algebra 2', cat = 'Math'): Question => ({
  id, type: 'tossup', rulesets: ['ncal'], level: 'jv', difficulty: 'medium', category: cat, subcategory: sub,
  status: 'active', source: 'test', created_at: '', updated_at: '', report_count: 0, random: 0.5, expires_at: null,
  text: `Question number ${id}?`, answer: `a${id}`, required: null, alternates: [], prompt_on: [], answer_type: 'general',
  duplicate_name: false, accepts_partial_name: false,
} as unknown as Question);
const bonus = (id: string): Question => ({
  id, type: 'bonus', rulesets: ['ncal'], level: 'jv', difficulty: 'medium', category: 'Math', subcategory: 'Algebra 2',
  status: 'active', source: 'test', created_at: '', updated_at: '', report_count: 0, random: 0.5, expires_at: null,
  leadin: 'Answer these.', parts: [1, 2, 3].map((n) => ({
    text: `Part ${n} of ${id}?`, part_difficulty: 'medium', answer: `p${n}`, required: null, alternates: [], prompt_on: [],
    answer_type: 'general', duplicate_name: false, accepts_partial_name: false,
  })),
} as unknown as Question);
const pool = [...Array.from({ length: 12 }, (_, i) => tossup(`t${i}`)), ...Array.from({ length: 6 }, (_, i) => bonus(`b${i}`))];

describe('makeRoomSettings', () => {
  it('copies the shared settings and the room options', () => {
    const s = base({
      level: 'jv', difficulties: ['easy', 'medium'], subjects: ['Math/Algebra 2'], tossupTiming: 'fixed', tossupSeconds: 8,
      bonusTiming: 'fixed', bonusSeconds: 40, roomMode: 'sim', roomTeamMode: 'teams', roomTeams: 3, roomSpeed: 4.4, roomQuestions: 20,
    });
    const r = makeRoomSettings(s, pool, FRESH);
    expect(r).toMatchObject({
      mode: 'sim', rulesetId: 'ncal', level: 'jv', difficulties: ['easy', 'medium'], subjects: ['Math/Algebra 2'], fullDistribution: false,
      answerMode: 'flat', flatSeconds: 8, bonusMode: 'flat', bonusFlatSeconds: 40, wordsPerSecond: 4.4, teamMode: 'teams', teamCount: 3,
      questions: 20, unlimited: false, seed: 'seed1',
    });
  });
  it('ignores the subject boxes under full distribution, and caps an unlimited room', () => {
    const r = makeRoomSettings(base({ fullDistribution: true, subjects: ['Math/Algebra 2'], roomQuestions: 0 }), pool, FRESH);
    expect(r.subjects).toEqual([]);
    expect(r.fullDistribution).toBe(true);
    expect(r).toMatchObject({ unlimited: true, questions: UNLIMITED_CAP });
  });
  it('is tossups only for a ruleset whose bonuses are answered one part at a time', () => {
    expect(makeRoomSettings(base({ ruleset: 'quizbowl', roomMode: 'sim' }), pool, FRESH).mode).toBe('tossup');
  });
});

describe('roomToSettings', () => {
  it('turns a room back into what the settings panels show', () => {
    const original = base({ level: 'varsity', difficulties: ['hard'], tossupPace: 'relaxed', roomMode: 'bonus', roomTeams: 4, roomQuestions: 0, roomSpeed: 2.5 });
    const back = roomToSettings(makeRoomSettings(original, pool, FRESH), base());
    expect(back).toMatchObject({
      ruleset: 'ncal', level: 'varsity', difficulties: ['hard'], tossupPace: 'relaxed', roomMode: 'bonus', roomTeams: 4, roomQuestions: 0, roomSpeed: 2.5,
    });
  });
  it('keeps the user\'s other settings (like the theme)', () => {
    expect(roomToSettings(makeRoomSettings(base(), pool, FRESH), base({ theme: 'dark' })).theme).toBe('dark');
  });
});

describe('questionProblem', () => {
  it('is null when there are questions, and says what is missing when there are not', () => {
    const ok = makeRoomSettings(base({ level: 'jv', roomMode: 'sim', roomQuestions: 5 }), pool, FRESH);
    expect(questionProblem(pool, ok)).toBeNull();
    const none = makeRoomSettings(base({ level: 'jv', subjects: ['Science/Physics'] }), pool, FRESH);
    expect(questionProblem(pool, none)).toMatch(/No tossups/);
    expect(questionProblem(pool.filter((q) => q.type === 'tossup'), { ...ok, mode: 'bonus' })).toMatch(/No bonuses/);
  });
});

describe('reassignTeams', () => {
  const p = (team: string, joinedAt: number): RoomPlayer => ({ name: team, team, joinedAt });
  it('leaves players alone when every team still exists', () => {
    expect(reassignTeams({ a: p('A', 1), b: p('B', 2), c: p('C', 3) }, 3)).toEqual({});
  });
  it('moves players from removed teams to the smallest remaining team', () => {
    const moves = reassignTeams({ a: p('A', 1), a2: p('A', 2), b: p('B', 3), c: p('C', 4), d: p('D', 5) }, 2);
    // A has 2, B has 1: the first stray goes to B (now 2), the second to whichever is smallest
    expect(Object.keys(moves).sort()).toEqual(['c', 'd']);
    const finalCounts = { A: 2, B: 1 } as Record<string, number>;
    for (const t of Object.values(moves)) finalCounts[t]++;
    expect(Math.abs(finalCounts.A - finalCounts.B)).toBeLessThanOrEqual(1);
  });
});
