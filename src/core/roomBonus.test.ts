import { describe, expect, it } from 'vitest';
import {
  bonusKeyOf, bonusRevealEnd, bonusWordsShown, initialRoomState, LEAD_IN_MS, nextDeadline, normalizeRoomState, reduceRoom,
  type RoomEvent, type RoomMode, type RoomState,
} from './room';

const SCORING = { correct: 3, wrong: -1, bonusPart: 5 };
const TEAM_OF = { a1: 'A', a2: 'A', b1: 'B', b2: 'B' };
const CAPTAINS = { A: 'a1', B: 'b1' };
const BONUS = { index: 0, wordCount: 20, partCount: 3 };

const start = (mode: RoomMode, total = 2): RoomState => reduceRoom(initialRoomState(), {
  type: 'start', at: 1000, mode, total, wordCount: 10, wordsPerSecond: 2, teamOf: TEAM_OF, captains: CAPTAINS, scoring: SCORING,
  ...(mode === 'bonus' ? { bonus: BONUS } : {}),
});
const READ_AT = 1000 + LEAD_IN_MS;

/** Opens a bonus round's answer window (the host's timer fires when the reveal ends). */
function open(s: RoomState, answerMs = 20_000): RoomState {
  return reduceRoom(s, { type: 'bonusOpen', at: bonusRevealEnd(s, s.bonus!), answerMs });
}
const submit = (s: RoomState, team: string, by: string, verdicts: boolean[]): RoomState =>
  reduceRoom(s, { type: 'bonusSubmit', at: s.bonus!.answerDeadline! - 1000, team, by, answers: verdicts.map((_v, i) => `a${i}`), verdicts });

describe('bonus drill', () => {
  it('starts straight into a bonus for every team', () => {
    const s = start('bonus');
    expect(s).toMatchObject({ phase: 'bonus', mode: 'bonus', q: 0 });
    expect(s.bonus).toMatchObject({ teams: ['A', 'B'], partCount: 3, open: false, readStartAt: READ_AT });
  });
  it('reads the bonus out, then lets teams type, then closes', () => {
    let s = start('bonus');
    expect(bonusWordsShown(s, READ_AT - 5)).toBe(0);
    expect(bonusWordsShown(s, READ_AT + 2000)).toBe(4); // 2 s at 2 words a second
    expect(nextDeadline(s)).toBe(READ_AT + 10_000); // 20 words at 2/s
    s = open(s);
    expect(s.bonus?.open).toBe(true);
    expect(bonusWordsShown(s, READ_AT)).toBe(20); // fully shown once open
    expect(nextDeadline(s)).toBe(READ_AT + 10_000 + 20_000);
  });
  it('does not accept answers before the text has been read', () => {
    const s = start('bonus');
    const n = reduceRoom(s, { type: 'bonusSubmit', at: READ_AT + 10, team: 'A', by: 'a1', answers: ['x'], verdicts: [true] });
    expect(n).toBe(s);
  });
  it('scores each team by its correct parts when its captain submits', () => {
    let s = open(start('bonus'));
    s = submit(s, 'A', 'a1', [true, true, false]);
    expect(s.phase).toBe('bonus'); // team B has not submitted yet
    expect(s.teamScores).toEqual({ A: 10 });
    s = submit(s, 'B', 'b1', [true, false, false]);
    expect(s.phase).toBe('bonus_result');
    expect(s.teamScores).toEqual({ A: 10, B: 5 });
    expect(s.bonus?.results.A).toMatchObject({ points: 10, by: 'a1' });
  });
  it('lets only the team captain submit', () => {
    const s = open(start('bonus'));
    expect(reduceRoom(s, { type: 'bonusSubmit', at: s.bonus!.answerDeadline! - 1, team: 'A', by: 'a2', answers: ['x'], verdicts: [true] })).toBe(s);
    expect(reduceRoom(s, { type: 'bonusSubmit', at: s.bonus!.answerDeadline! - 1, team: 'A', by: 'b1', answers: ['x'], verdicts: [true] })).toBe(s);
  });
  it('ignores a second submission from the same team', () => {
    let s = open(start('bonus'));
    s = submit(s, 'A', 'a1', [true, true, true]);
    expect(submit(s, 'A', 'a1', [false, false, false])).toBe(s);
  });
  it('closes at the deadline taking whatever each unsubmitted team typed', () => {
    let s = open(start('bonus'));
    s = submit(s, 'A', 'a1', [true, true, true]);
    const closed = reduceRoom(s, {
      type: 'bonusClose', at: s.bonus!.answerDeadline!, entries: [{ team: 'B', answers: ['x', 'y'], verdicts: [true, false] }],
    });
    expect(closed.phase).toBe('bonus_result');
    expect(closed.bonus?.results.B).toMatchObject({ points: 5, by: null });
    expect(closed.teamScores).toEqual({ A: 15, B: 5 });
  });
  it('scores a team that typed nothing at zero when the clock closes', () => {
    const s = open(start('bonus'));
    const closed = reduceRoom(s, { type: 'bonusClose', at: s.bonus!.answerDeadline!, entries: [] });
    expect(closed.phase).toBe('bonus_result');
    expect(closed.bonus?.results.A).toMatchObject({ points: 0, verdicts: [] });
    expect(closed.bonus?.results.B).toMatchObject({ points: 0 });
  });
  it('does not close early', () => {
    const s = open(start('bonus'));
    expect(reduceRoom(s, { type: 'bonusClose', at: s.bonus!.answerDeadline! - 1, entries: [] })).toBe(s);
  });
  it('moves to the next bonus, then back to the lobby after the last', () => {
    let s = open(start('bonus', 2));
    s = reduceRoom(submit(submit(s, 'A', 'a1', [true, true, true]), 'B', 'b1', [false, false, false]), { type: 'next', at: 80_000, wordCount: 0, bonus: { index: 1, wordCount: 12, partCount: 3 } });
    expect(s).toMatchObject({ phase: 'bonus', q: 1 });
    expect(s.bonus).toMatchObject({ index: 1, open: false, submitted: [], readStartAt: 80_000 + LEAD_IN_MS });
    expect(bonusKeyOf(s)).toBe('b1');
    s = open(s);
    s = reduceRoom(submit(submit(s, 'A', 'a1', [true, false, false]), 'B', 'b1', [true, true, false]), { type: 'next', at: 150_000, wordCount: 0 });
    expect(s.phase).toBe('lobby');
    expect(s.lastGame).toMatchObject({ mode: 'bonus', teamScores: { A: 20, B: 10 } });
  });
});

/** A sim question where `uid` buzzes and answers correctly. */
function tossupCorrect(s: RoomState, uid: string): RoomState {
  let n = reduceRoom(s, { type: 'buzz', uid, at: s.readStartAt + 500 });
  n = reduceRoom(n, { type: 'resolve', at: s.readStartAt + 600, answerMs: 6000 });
  return reduceRoom(n, { type: 'answer', uid, at: s.readStartAt + 1500, typed: 'right', verdict: 'correct' });
}

describe('game sim', () => {
  it('gives the bonus only to the team that got the tossup', () => {
    let s = tossupCorrect(start('sim'), 'b2');
    expect(s.phase).toBe('result');
    s = reduceRoom(s, { type: 'next', at: 40_000, wordCount: 9, bonus: BONUS });
    expect(s.phase).toBe('bonus');
    expect(s.bonus?.teams).toEqual(['B']);
    s = open(s);
    s = submit(s, 'B', 'b1', [true, true, true]);
    expect(s.phase).toBe('bonus_result'); // only team B was answering
    expect(s.teamScores).toEqual({ B: 3 + 15 });
  });
  it('goes straight to the next tossup when nobody got the question', () => {
    let s = start('sim');
    s = reduceRoom(s, { type: 'timeout', at: s.endAt });
    expect(s.last?.kind).toBe('nobody');
    s = reduceRoom(s, { type: 'next', at: 40_000, wordCount: 9, bonus: BONUS });
    expect(s).toMatchObject({ phase: 'reading', q: 1, bonus: null });
  });
  it('goes to the next tossup after a bonus, and ends the game after the last tossup', () => {
    let s = tossupCorrect(start('sim', 2), 'a1');
    s = open(reduceRoom(s, { type: 'next', at: 40_000, wordCount: 9, bonus: BONUS }));
    s = submit(s, 'A', 'a1', [true, false, false]);
    s = reduceRoom(s, { type: 'next', at: 70_000, wordCount: 9, bonus: BONUS });
    expect(s).toMatchObject({ phase: 'reading', q: 1 });
    s = tossupCorrect(s, 'b1'); // the last tossup, answered correctly: its bonus still happens
    s = open(reduceRoom(s, { type: 'next', at: 100_000, wordCount: 0, bonus: { ...BONUS, index: 1 } }));
    s = submit(s, 'B', 'b1', [true, true, false]);
    s = reduceRoom(s, { type: 'next', at: 130_000, wordCount: 0 });
    expect(s.phase).toBe('lobby');
    expect(s.lastGame?.teamScores).toEqual({ A: 3 + 5, B: 3 + 10 });
  });
  it('keeps the previous game results until the next game starts, then replaces them', () => {
    let s = reduceRoom(start('tossup', 1), { type: 'end' });
    expect(s.phase).toBe('lobby');
    const first = s.lastGame;
    expect(first).not.toBeNull();
    s = reduceRoom(s, { type: 'start', at: 5000, mode: 'tossup', total: 1, wordCount: 4, wordsPerSecond: 2, teamOf: TEAM_OF, captains: CAPTAINS, scoring: SCORING });
    expect(s.phase).toBe('reading');
    expect(s.lastGame).toBe(first); // still there while the next game is on
    expect(s.teamScores).toEqual({}); // but the new game's scores start from zero
    s = reduceRoom(s, { type: 'end' });
    expect(s.games).toBe(2);
  });
});

describe('normalizeRoomState with a bonus round', () => {
  it('restores the lists and objects a database drops when empty', () => {
    let s = open(start('bonus'));
    s = submit(s, 'A', 'a1', [true, true, true]);
    const stripped = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    // what Realtime Database returns: no empty lists, objects or nulls
    delete stripped.pending; delete stripped.lockedOut; delete stripped.buzzer; delete stripped.last; delete stripped.lastGame;
    const back = normalizeRoomState(stripped);
    expect(back.bonus?.submitted).toEqual(['A']);
    expect(back.bonus?.results.A.verdicts).toEqual([true, true, true]);
    expect(back.captains).toEqual(CAPTAINS);
    expect(back.pending).toEqual([]);
    expect(back.lastGame).toBeNull();
    expect(reduceRoom(back, { type: 'bonusSubmit', at: back.bonus!.answerDeadline! - 1, team: 'B', by: 'b1', answers: ['x'], verdicts: [true] }).phase).toBe('bonus_result');
  });
});

describe('events typing', () => {
  it('has a type for every bonus event', () => {
    const e: RoomEvent[] = [{ type: 'bonusOpen', at: 1, answerMs: 1 }, { type: 'bonusClose', at: 1, entries: [] }];
    expect(e).toHaveLength(2);
  });
});
