import { describe, expect, it } from 'vitest';
import seed from '../../seed/questions.json';
import { buildTossupSequence } from './pool';
import { getRuleset } from './rulesets';
import {
  createSession, currentBonus, currentTossup, reduce,
  type SessionInput, type SessionState,
} from './session';
import { aggregate, summarize } from './stats';
import { questionSchema, type Question } from './types';

const pool: Question[] = (seed as unknown[]).map((q) => questionSchema.parse(q));
const NOW = '2026-11-02T00:00:00.000Z';

const input = (over: Partial<SessionInput> = {}): SessionInput => ({
  pool, seed: 'abc', rulesetId: 'ncal', levels: ['novice'], cumulative: true, kind: 'sim',
  filter: { subjects: [], fullDistribution: false },
  settings: { tossupSeconds: 10, bonusSeconds: 20, bonusesOn: true },
  length: { kind: 'all' }, nowIso: NOW, ...over,
});

function answerCorrectly(s: SessionState): SessionState {
  return reduce(s, { type: 'submitAnswer', answer: currentTossup(s)!.answer });
}

describe('deterministic ordering', () => {
  it('gives identical sequences for the same seed and pool', () => {
    const a = createSession(input());
    const b = createSession(input());
    expect(a.tossups.map((q) => q.id)).toEqual(b.tossups.map((q) => q.id));
    expect(a.bonuses.map((q) => q.id)).toEqual(b.bonuses.map((q) => q.id));
  });
  it('does not depend on the order of the pool', () => {
    const a = createSession(input());
    const b = createSession(input({ pool: [...pool].reverse() }));
    expect(a.tossups.map((q) => q.id)).toEqual(b.tossups.map((q) => q.id));
  });
  it('gives different sequences for different seeds', () => {
    const a = createSession(input({ seed: 'one' })).tossups.map((q) => q.id);
    const b = createSession(input({ seed: 'two' })).tossups.map((q) => q.id);
    expect(a).not.toEqual(b);
  });
});

describe('pool selection', () => {
  it('only serves active, unexpired questions of the right ruleset and level', () => {
    const s = createSession(input({ nowIso: '2030-01-01T00:00:00.000Z' }));
    expect(s.tossups.every((q) => q.rulesets.includes('ncal') && q.level === 'novice')).toBe(true);
    expect(s.tossups.some((q) => q.category === 'Current Events')).toBe(false); // expired
    const retired = pool.map((q) => (q.type === 'tossup' ? { ...q, status: 'retired' as const } : q));
    expect(createSession(input({ pool: retired })).tossups).toHaveLength(0);
  });
  it('draws a share from lower levels for NCAL JV (cumulative pools)', () => {
    const s = createSession(input({ levels: ['jv'] }));
    expect(s.tossups.some((q) => q.level === 'novice')).toBe(true);
    expect(s.tossups.some((q) => q.level === 'jv')).toBe(true);
    const q = createSession(input({ rulesetId: 'quizbowl', levels: ['jv'] }));
    expect(q.tossups.every((t) => t.level === 'jv')).toBe(true);
  });
  it('draws from any combination of levels and can exclude the rest', () => {
    const both = createSession(input({ levels: ['novice', 'varsity'], cumulative: false }));
    expect(new Set(both.tossups.map((q) => q.level))).toEqual(new Set(['novice', 'varsity']));
    const noNovice = createSession(input({ levels: ['jv', 'varsity'], cumulative: false }));
    expect(noNovice.tossups.some((q) => q.level === 'novice')).toBe(false);
    const all = createSession(input({ levels: ['novice', 'jv', 'varsity'] }));
    expect(new Set(all.tossups.map((q) => q.level)).size).toBe(3);
    expect(all.level).toBe('varsity');
  });
  it('cumulative pools add lower levels only when turned on', () => {
    const on = createSession(input({ levels: ['varsity'], cumulative: true }));
    expect(on.tossups.some((q) => q.level !== 'varsity')).toBe(true);
    const off = createSession(input({ levels: ['varsity'], cumulative: false }));
    expect(off.tossups.every((q) => q.level === 'varsity')).toBe(true);
  });
  it('honors subject filters', () => {
    const s = createSession(input({ filter: { subjects: ['Math/Geometry'], fullDistribution: false } }));
    expect(s.tossups.length).toBeGreaterThan(0);
    expect(s.tossups.every((q) => q.subcategory === 'Geometry')).toBe(true);
  });
  it('full distribution includes the NCAL current events count', () => {
    const ncal = getRuleset('ncal');
    const seq = buildTossupSequence({
      pool: pool.filter((q) => q.type === 'tossup') as never, ruleset: ncal, levels: ['novice'], cumulative: true, seed: 's',
      filter: { subjects: ['Math/Geometry'], fullDistribution: true }, limit: 20, nowIso: NOW,
    });
    // only one (non-expired) current events tossup exists in the seed, so we get exactly that one
    expect(seq.filter((q) => q.category === 'Current Events')).toHaveLength(1);
  });
});

describe('tossup scoring', () => {
  it('scores NCAL +3 / -1 and quizbowl +10 / 0', () => {
    let s = createSession(input({ kind: 'tossup' }));
    s = answerCorrectly(s);
    expect(s.score).toBe(3);
    s = reduce(s, { type: 'next' });
    s = reduce(s, { type: 'submitAnswer', answer: 'definitely wrong zzz' });
    expect(s.score).toBe(2);
    let q = createSession(input({ kind: 'tossup', rulesetId: 'quizbowl' }));
    q = answerCorrectly(q);
    expect(q.score).toBe(10);
    q = reduce(q, { type: 'next' });
    q = reduce(q, { type: 'submitAnswer', answer: 'definitely wrong zzz' });
    expect(q.score).toBe(10);
  });
  it('treats a timeout with an empty box as incorrect', () => {
    let s = createSession(input({ kind: 'tossup' }));
    s = reduce(s, { type: 'timeout' });
    expect(s.phase).toBe('tossup_result');
    expect(s.records[0]).toMatchObject({ correct: false, timedOut: true, points: -1 });
  });
  it('submits whatever is typed at timeout', () => {
    let s = createSession(input({ kind: 'tossup' }));
    s = reduce(s, { type: 'timeout', answer: currentTossup(s)!.answer });
    expect(s.records[0]).toMatchObject({ correct: true });
  });
  it('allows exactly one more attempt after a prompt', () => {
    const s0 = createSession(input({ kind: 'tossup', levels: ['varsity'], filter: { subjects: ['Science/Biology 2'], fullDistribution: false } }));
    expect(currentTossup(s0)!.prompt_on).toContain('RNA');
    const s1 = reduce(s0, { type: 'submitAnswer', answer: 'RNA' });
    expect(s1.phase).toBe('tossup_prompt');
    expect(s1.clockKey).toBe(s0.clockKey + 1);
    const s2 = reduce(s1, { type: 'submitAnswer', answer: 'RNA' });
    expect(s2.phase).toBe('tossup_result');
    expect(s2.records[0]).toMatchObject({ correct: false });
    const s3 = reduce(reduce(s0, { type: 'submitAnswer', answer: 'RNA' }), { type: 'submitAnswer', answer: 'transfer RNA' });
    expect(s3.records[0]).toMatchObject({ correct: true });
  });
  it('does not prompt again at timeout', () => {
    const s0 = createSession(input({ kind: 'tossup', levels: ['varsity'], filter: { subjects: ['Science/Biology 2'], fullDistribution: false } }));
    const s1 = reduce(reduce(s0, { type: 'submitAnswer', answer: 'RNA' }), { type: 'timeout', answer: 'RNA' });
    expect(s1.phase).toBe('tossup_result');
  });
  it('"I was right" fixes the score and is recorded', () => {
    let s = createSession(input({ kind: 'tossup' }));
    s = reduce(s, { type: 'submitAnswer', answer: 'nope nope' });
    expect(s.score).toBe(-1);
    s = reduce(s, { type: 'override' });
    expect(s.score).toBe(3);
    expect(s.records[0]).toMatchObject({ correct: true, overridden: true });
  });
  it('ends when the pool is exhausted', () => {
    let s = createSession(input({ kind: 'tossup' }));
    const n = s.tossups.length;
    for (let i = 0; i < n; i++) s = reduce(reduce(s, { type: 'submitAnswer', answer: 'x1' }), { type: 'next' });
    expect(s.phase).toBe('done');
    expect(s.records).toHaveLength(n);
  });
});

describe('bonus flow', () => {
  it('NCAL: all parts at once, 5 per correct part', () => {
    let s = createSession(input({ kind: 'bonus' }));
    expect(s.phase).toBe('bonus_intro');
    s = reduce(s, { type: 'startBonus' });
    const b = currentBonus(s)!;
    const answers = b.parts.map((p, i) => (i === 0 ? p.answer : 'wrong'));
    s = reduce(s, { type: 'submitBonus', answers });
    expect(s.phase).toBe('bonus_result');
    expect(s.score).toBe(5);
  });
  it('NCAL: timeout scores whatever is typed', () => {
    let s = createSession(input({ kind: 'bonus' }));
    s = reduce(s, { type: 'startBonus' });
    const b = currentBonus(s)!;
    s = reduce(s, { type: 'timeout', answers: [b.parts[0].answer, b.parts[1].answer] });
    expect(s.score).toBe(10);
    expect(s.records[0]).toMatchObject({ kind: 'bonus' });
  });
  it('quizbowl: one part at a time, 10 per part', () => {
    let s = createSession(input({ kind: 'bonus', rulesetId: 'quizbowl' }));
    s = reduce(s, { type: 'startBonus' });
    const b = currentBonus(s)!;
    s = reduce(s, { type: 'submitAnswer', answer: b.parts[0].answer });
    expect(s.phase).toBe('bonus_part_result');
    s = reduce(s, { type: 'next' });
    expect(s.phase).toBe('bonus');
    expect(s.partIndex).toBe(1);
    s = reduce(s, { type: 'submitAnswer', answer: 'wrong' });
    s = reduce(s, { type: 'next' });
    s = reduce(s, { type: 'submitAnswer', answer: b.parts[2].answer });
    expect(s.phase).toBe('bonus_result');
    expect(s.score).toBe(20);
  });
  it('sim: a correct tossup is followed by a bonus; incorrect is not', () => {
    let s = createSession(input());
    s = answerCorrectly(s);
    s = reduce(s, { type: 'next' });
    expect(s.phase).toBe('bonus_intro');
    s = reduce(s, { type: 'startBonus' });
    s = reduce(s, { type: 'timeout' });
    s = reduce(s, { type: 'next' });
    expect(s.phase).toBe('tossup');
    expect(s.tossupIndex).toBe(1);
    s = reduce(s, { type: 'submitAnswer', answer: 'wrong wrong' });
    s = reduce(s, { type: 'next' });
    expect(s.phase).toBe('tossup');
  });
  it('sim with bonuses off never shows a bonus', () => {
    let s = createSession(input({ settings: { tossupSeconds: 10, bonusSeconds: 20, bonusesOn: false } }));
    s = answerCorrectly(s);
    s = reduce(s, { type: 'next' });
    expect(s.phase).toBe('tossup');
  });
  it('a corrected tossup unlocks its bonus', () => {
    let s = createSession(input());
    s = reduce(s, { type: 'submitAnswer', answer: 'wrong wrong' });
    s = reduce(s, { type: 'override' });
    s = reduce(s, { type: 'next' });
    expect(s.phase).toBe('bonus_intro');
  });
});

describe('match sim', () => {
  it('finishes the cycle in progress when the game clock expires', () => {
    let s = createSession(input({ length: { kind: 'match' } }));
    expect(s.gameClockSeconds).toBe(15 * 60);
    s = answerCorrectly(s);
    s = reduce(s, { type: 'clockExpired' });
    s = reduce(s, { type: 'next' });
    expect(s.phase).toBe('bonus_intro'); // bonus cycle still played
    s = reduce(reduce(s, { type: 'startBonus' }), { type: 'timeout' });
    s = reduce(s, { type: 'next' });
    expect(s.phase).toBe('done');
  });
  it('quizbowl match is 20 tossups (or the pool, if smaller)', () => {
    const s = createSession(input({ rulesetId: 'quizbowl', length: { kind: 'match' } }));
    expect(s.gameClockSeconds).toBeNull();
    expect(s.tossups.length).toBeLessThanOrEqual(20);
  });
  it('count sessions are capped at the requested length', () => {
    expect(createSession(input({ length: { kind: 'count', n: 4 } })).tossups).toHaveLength(4);
  });
});

describe('stats', () => {
  it('summarizes a session and separates rulesets', () => {
    let s = createSession(input());
    s = answerCorrectly(s);
    s = reduce(s, { type: 'next' });
    s = reduce(reduce(s, { type: 'startBonus' }), { type: 'timeout', answers: [currentBonus(s)!.parts[0].answer] });
    const sum = summarize(s, 'id1', NOW);
    expect(sum.tossups).toEqual({ seen: 1, correct: 1 });
    expect(sum.bonuses.played).toBe(1);
    expect(sum.untimed).toBe(false);
    const agg = aggregate([sum], { rulesetId: 'ncal', includeUntimed: false });
    expect(agg.ppb).toBe(5);
    expect(aggregate([sum], { rulesetId: 'quizbowl', includeUntimed: false }).sessions).toBe(0);
  });
  it('excludes untimed sessions by default', () => {
    const s = createSession(input({ settings: { tossupSeconds: null, bonusSeconds: 20, bonusesOn: true } }));
    const sum = summarize(s, 'u', NOW);
    expect(sum.untimed).toBe(true);
    expect(aggregate([sum], { rulesetId: 'ncal', includeUntimed: false }).sessions).toBe(0);
    expect(aggregate([sum], { rulesetId: 'ncal', includeUntimed: true }).sessions).toBe(1);
  });
  it('ignores PPB for sessions with bonuses off', () => {
    let s = createSession(input({ settings: { tossupSeconds: 10, bonusSeconds: 20, bonusesOn: false } }));
    s = answerCorrectly(s);
    const agg = aggregate([summarize(s, 'x', NOW)], { rulesetId: 'ncal', includeUntimed: false });
    expect(agg.ppb).toBeNull();
  });
});
