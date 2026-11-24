import { describe, expect, it } from 'vitest';
import {
  BUZZ_WINDOW_MS, LEAD_IN_MS, initialRoomState, nextDeadline, normalizeRoomState, rankTeams, reduceRoom, segmentOf, wordsShown,
  type RoomEvent, type RoomState,
} from './room';

const SCORING = { correct: 3, wrong: -1, bonusPart: 5 };
// Two teams of two: a1, a2 on team A; b1, b2 on team B. Ten words per question, 2 words per second.
const TEAM_OF = { a1: 'A', a2: 'A', b1: 'B', b2: 'B' };
const start = (extra: Partial<Extract<RoomEvent, { type: 'start' }>> = {}): RoomState =>
  reduceRoom(initialRoomState(), { type: 'start', at: 1000, mode: 'tossup', total: 3, wordCount: 10, wordsPerSecond: 2, teamOf: TEAM_OF, captains: {}, scoring: SCORING, ...extra });
const READ_AT = 1000 + LEAD_IN_MS; // the reveal starts here

describe('starting and the reveal', () => {
  it('starts reading after a short lead-in', () => {
    const s = start();
    expect(s.phase).toBe('reading');
    expect(s.readStartAt).toBe(READ_AT);
    expect(wordsShown(s, READ_AT - 1)).toBe(0);
    expect(wordsShown(s, READ_AT + 1000)).toBe(2);
    expect(wordsShown(s, READ_AT + 99_000)).toBe(10); // never more than the question has
  });
  it('closes the buzz window five seconds after the last word', () => {
    const s = start(); // 10 words at 2/s = 5 s of reveal
    expect(s.endAt).toBe(READ_AT + 5000 + BUZZ_WINDOW_MS);
    expect(nextDeadline(s)).toBe(s.endAt);
  });
  it('ignores a second start', () => {
    const s = start();
    expect(reduceRoom(s, { type: 'start', at: 9, mode: 'tossup', total: 9, wordCount: 9, wordsPerSecond: 9, teamOf: {}, captains: {}, scoring: SCORING })).toBe(s);
  });
});

describe('buzzing', () => {
  it('picks the earliest server timestamp, whatever order the buzzes arrived in', () => {
    let s = start();
    s = reduceRoom(s, { type: 'buzz', uid: 'b1', at: READ_AT + 2100 });
    s = reduceRoom(s, { type: 'buzz', uid: 'a1', at: READ_AT + 2000 }); // arrived later, buzzed sooner
    s = reduceRoom(s, { type: 'resolve', at: READ_AT + 2300, answerMs: 6000 });
    expect(s.phase).toBe('answering');
    expect(s.buzzer).toBe('a1');
    expect(s.frozenWords).toBe(4); // 2 s at 2 words a second
    expect(s.answerDeadline).toBe(READ_AT + 2300 + 6000);
  });
  it('ignores buzzes from strangers, locked-out players, repeats, and buzzes outside reading', () => {
    let s = start();
    s = reduceRoom(s, { type: 'buzz', uid: 'nobody', at: READ_AT + 1 });
    expect(s.pending).toHaveLength(0);
    s = reduceRoom(s, { type: 'buzz', uid: 'a1', at: READ_AT + 1 });
    s = reduceRoom(s, { type: 'buzz', uid: 'a1', at: READ_AT + 2 });
    expect(s.pending).toHaveLength(1);
    s = reduceRoom(s, { type: 'resolve', at: READ_AT + 100, answerMs: 5000 });
    expect(reduceRoom(s, { type: 'buzz', uid: 'b1', at: READ_AT + 200 })).toBe(s); // already answering
  });
  it('does nothing when resolving with no buzzes', () => {
    const s = start();
    expect(reduceRoom(s, { type: 'resolve', at: READ_AT, answerMs: 5000 })).toBe(s);
  });
});

function buzzAndAnswer(s: RoomState, uid: string, typed: string, verdict: 'correct' | 'wrong', at: number): RoomState {
  let n = reduceRoom(s, { type: 'buzz', uid, at });
  n = reduceRoom(n, { type: 'resolve', at: at + 100, answerMs: 6000 });
  return reduceRoom(n, { type: 'answer', uid, at: at + 2000, typed, verdict });
}

describe('answering and scoring', () => {
  it('scores a correct answer for the player and their team and ends the question', () => {
    const s = buzzAndAnswer(start(), 'a1', 'Texas', 'correct', READ_AT + 1000);
    expect(s.phase).toBe('result');
    expect(s.last).toMatchObject({ kind: 'correct', uid: 'a1', points: 3 });
    expect(s.teamScores).toEqual({ A: 3 });
    expect(s.playerScores.a1).toMatchObject({ points: 3, correct: 1 });
  });
  it('penalizes a wrong guess, locks the player out, and resumes the reveal where it froze', () => {
    const s = buzzAndAnswer(start(), 'a1', 'Ohio', 'wrong', READ_AT + 1000);
    expect(s.phase).toBe('reading');
    expect(s.teamScores).toEqual({ A: -1 });
    expect(s.lockedOut).toEqual(['a1']);
    expect(s.readFrom).toBe(2); // frozen after one second at 2 words a second
    const t = s.readStartAt;
    expect(wordsShown(s, t + 1000)).toBe(4);
    // the locked-out player cannot buzz again; a teammate can
    expect(reduceRoom(s, { type: 'buzz', uid: 'a1', at: t + 10 })).toBe(s);
    expect(reduceRoom(s, { type: 'buzz', uid: 'a2', at: t + 10 }).pending).toHaveLength(1);
  });
  it('treats a blank answer as a pass: no penalty, still locked out', () => {
    let s = reduceRoom(start(), { type: 'buzz', uid: 'a1', at: READ_AT + 500 });
    s = reduceRoom(s, { type: 'resolve', at: READ_AT + 600, answerMs: 6000 });
    s = reduceRoom(s, { type: 'answer', uid: 'a1', at: READ_AT + 900, typed: '   ', verdict: 'wrong' });
    expect(s.last).toMatchObject({ kind: 'pass', points: 0 });
    expect(s.teamScores).toEqual({ A: 0 });
    expect(s.playerScores.a1).toMatchObject({ points: 0, passes: 1, wrong: 0 });
    expect(s.lockedOut).toContain('a1');
  });
  it('treats an answer window that runs out as a pass', () => {
    let s = reduceRoom(start(), { type: 'buzz', uid: 'b2', at: READ_AT + 500 });
    s = reduceRoom(s, { type: 'resolve', at: READ_AT + 600, answerMs: 6000 });
    expect(reduceRoom(s, { type: 'timeout', at: READ_AT + 5000 })).toBe(s); // too early
    s = reduceRoom(s, { type: 'timeout', at: READ_AT + 600 + 6000 });
    expect(s.last).toMatchObject({ kind: 'pass', uid: 'b2', points: 0 });
    expect(s.phase).toBe('reading');
  });
  it('ignores an answer from someone who did not win the buzz', () => {
    let s = reduceRoom(start(), { type: 'buzz', uid: 'a1', at: READ_AT + 500 });
    s = reduceRoom(s, { type: 'resolve', at: READ_AT + 600, answerMs: 6000 });
    expect(reduceRoom(s, { type: 'answer', uid: 'b1', at: READ_AT + 700, typed: 'x', verdict: 'correct' })).toBe(s);
  });
  it('gives a free-for-all player their own score (team = uid)', () => {
    const solo = start({ teamOf: { p: 'p', q: 'q' } });
    const s = buzzAndAnswer(solo, 'q', 'Texas', 'correct', READ_AT + 1000);
    expect(s.teamScores).toEqual({ q: 3 });
  });
});

describe('questions that nobody answers', () => {
  it('ends when the buzz window closes with no buzz', () => {
    const s = start();
    expect(reduceRoom(s, { type: 'timeout', at: s.endAt - 1 })).toBe(s);
    const n = reduceRoom(s, { type: 'timeout', at: s.endAt });
    expect(n.phase).toBe('result');
    expect(n.last).toMatchObject({ kind: 'nobody', points: 0 });
  });
  it('ends at once when everyone has been locked out', () => {
    let s = start({ teamOf: { p: 'p', q: 'q' } });
    s = buzzAndAnswer(s, 'p', 'bad', 'wrong', READ_AT + 500);
    s = buzzAndAnswer(s, 'q', 'bad', 'wrong', s.readStartAt + 500);
    expect(s.phase).toBe('result');
    expect(s.teamScores).toEqual({ p: -1, q: -1 });
  });
  it('does not end the question while a buzz is waiting to be resolved', () => {
    let s = start();
    s = reduceRoom(s, { type: 'buzz', uid: 'a1', at: s.endAt - 5 });
    expect(reduceRoom(s, { type: 'timeout', at: s.endAt + 50 })).toBe(s);
  });
});

describe('next question and the end', () => {
  it('moves to the next question with fresh lockouts, then finishes', () => {
    let s = buzzAndAnswer(start(), 'a1', 'x', 'wrong', READ_AT + 500);
    s = reduceRoom(s, { type: 'timeout', at: s.endAt }); // nobody else buzzes
    expect(s.phase).toBe('result');
    s = reduceRoom(s, { type: 'next', at: 50_000, wordCount: 12 });
    expect(s).toMatchObject({ phase: 'reading', q: 1, wordCount: 12, lockedOut: [], readFrom: 0, readStartAt: 50_000 + LEAD_IN_MS });
    expect(s.teamScores).toEqual({ A: -1 }); // scores carry over
    s = reduceRoom(s, { type: 'timeout', at: s.endAt });
    s = reduceRoom(s, { type: 'next', at: 90_000, wordCount: 5 });
    s = reduceRoom(s, { type: 'timeout', at: s.endAt });
    s = reduceRoom(s, { type: 'next', at: 99_000, wordCount: 5 });
    expect(s.phase).toBe('lobby'); // the game is over: back to the lobby
    expect(s.lastGame?.teamScores).toEqual({ A: -1 }); // with the results kept
    expect(s.games).toBe(1);
  });
  it('can be ended early by the host', () => {
    expect(reduceRoom(start(), { type: 'end' }).phase).toBe('lobby');
  });
  it('only advances from a result', () => {
    const s = start();
    expect(reduceRoom(s, { type: 'next', at: 5, wordCount: 3 })).toBe(s);
  });
  it('ranks teams by points', () => {
    let s = buzzAndAnswer(start(), 'b1', 'x', 'correct', READ_AT + 500);
    s = reduceRoom(s, { type: 'next', at: 70_000, wordCount: 10 });
    s = buzzAndAnswer(s, 'a1', 'x', 'wrong', s.readStartAt + 500);
    expect(rankTeams(s)).toEqual([{ team: 'B', points: 3 }, { team: 'A', points: -1 }]);
  });
  it('bumps the version on every change', () => {
    const a = start();
    const b = reduceRoom(a, { type: 'buzz', uid: 'a1', at: READ_AT + 1 });
    expect(b.version).toBeGreaterThan(a.version);
  });
});

describe('normalizeRoomState', () => {
  it('restores fields a database drops when they are empty', () => {
    const fresh = start();
    // What Realtime Database hands back: empty lists, empty objects and nulls are gone.
    const stripped: Record<string, unknown> = { ...fresh };
    for (const k of ['pending', 'lockedOut', 'teamScores', 'playerScores', 'buzzer', 'answerDeadline', 'last']) delete stripped[k];
    const back = normalizeRoomState(stripped);
    expect(back).toEqual(fresh);
    expect(reduceRoom(back, { type: 'buzz', uid: 'a1', at: READ_AT + 5 }).pending).toHaveLength(1);
  });
  it('turns a missing or invalid value into an empty lobby', () => {
    expect(normalizeRoomState(null).phase).toBe('lobby');
    expect(normalizeRoomState('nope').phase).toBe('lobby');
  });
});

describe('segmentOf', () => {
  it('is a valid database key (no dots, slashes, $, # or brackets) and changes with each lockout', () => {
    const a = start();
    const key = segmentOf(a);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
    const b = buzzAndAnswer(a, 'a1', 'x', 'wrong', READ_AT + 500);
    expect(segmentOf(b)).not.toBe(key);
    expect(segmentOf(b)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
