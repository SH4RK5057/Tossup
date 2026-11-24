import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEAD_IN_MS, type RoomMode } from '../core/room';
import {
  pickCaptains, RoomHost, sendAnswer, sendBonusSubmit, sendBuzz, sendDraft, writePlayer, type HostBonus, type HostQuestion,
} from './host';
import { LocalRoomStore, MemoryHub } from './localStore';
import { getAt } from './store';

const CODE = 'ABCD';
const tossup: HostQuestion = { wordCount: 10, answerSeconds: 5, judge: (t) => (t.trim().toLowerCase() === 'right' ? 'correct' : 'wrong') };
const bonus: HostBonus = {
  wordCount: 8, partCount: 2, answerSeconds: 10,
  judge: (answers) => [0, 1].map((i) => (answers[i] ?? '').trim().toLowerCase() === 'right'),
};
const SCORING = { correct: 3, wrong: -1, bonusPart: 5 };

/** Players: p1 (team A, joined first), p2 (team B), p3 (team A). Team A's captain is p1, team B's is p2. */
async function setup(opts: { mode?: RoomMode; teamMode?: 'teams' | 'ffa'; tossups?: number; bonuses?: number } = {}) {
  const hub = new MemoryHub();
  const hostStore = new LocalRoomStore('host', hub);
  const p1 = new LocalRoomStore('p1', hub);
  const p2 = new LocalRoomStore('p2', hub);
  const p3 = new LocalRoomStore('p3', hub);
  await writePlayer(p1, CODE, 'Ann', 'A');
  await vi.advanceTimersByTimeAsync(5);
  await writePlayer(p2, CODE, 'Bo', 'B');
  await vi.advanceTimersByTimeAsync(5);
  await writePlayer(p3, CODE, 'Cy', 'A');
  const host = new RoomHost({
    store: hostStore, code: CODE, mode: opts.mode ?? 'tossup', teamMode: opts.teamMode ?? 'teams', wordsPerSecond: 2, scoring: SCORING,
    tossups: Array(opts.tossups ?? 2).fill(tossup), bonuses: Array(opts.bonuses ?? 2).fill(bonus),
  });
  await vi.advanceTimersByTimeAsync(0);
  return { hub, host, p1, p2, p3 };
}
const stateOf = (hub: MemoryHub) => getAt(hub.read(), `rooms/${CODE}/state`) as { phase: string };

describe('RoomHost: tossups', () => {
  beforeEach(() => { vi.useFakeTimers({ now: 1_000_000 }); });
  afterEach(() => { vi.useRealTimers(); });

  it('runs a question: buzz, wrong answer, second buzz, correct answer, next', async () => {
    const { hub, host, p1, p2 } = await setup();
    host.start();
    expect(host.state.phase).toBe('reading');
    expect(host.state.teamOf).toEqual({ p1: 'A', p2: 'B', p3: 'A' });
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 2000); // four words showing

    await sendBuzz(p1, CODE, 'q0_0');
    await vi.advanceTimersByTimeAsync(400); // past the tie window
    expect(host.state).toMatchObject({ phase: 'answering', buzzer: 'p1', frozenWords: 4 });

    await sendAnswer(p1, CODE, 'q0_0', 'nope');
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state).toMatchObject({ phase: 'reading', lockedOut: ['p1'], teamScores: { A: -1 } });
    expect(stateOf(hub).phase).toBe('reading'); // everyone can see it

    await sendBuzz(p2, CODE, 'q0_1');
    await vi.advanceTimersByTimeAsync(400);
    expect(host.state).toMatchObject({ phase: 'answering', buzzer: 'p2' });
    await sendAnswer(p2, CODE, 'q0_1', 'RIGHT');
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state).toMatchObject({ phase: 'result', teamScores: { A: -1, B: 3 } });

    host.next();
    expect(host.state).toMatchObject({ phase: 'reading', q: 1, lockedOut: [] });
    host.dispose();
  });

  it('gives a near-simultaneous buzz race to the earlier server timestamp', async () => {
    const { host, p1, p2 } = await setup();
    host.start();
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 1000);
    await sendBuzz(p2, CODE, 'q0_0'); // stamped first
    await vi.advanceTimersByTimeAsync(80);
    await sendBuzz(p1, CODE, 'q0_0'); // stamped 80 ms later, inside the tie window
    await vi.advanceTimersByTimeAsync(400);
    expect(host.state.buzzer).toBe('p2');
    host.dispose();
  });

  it('lets a player who buzzed too late buzz again once the reveal resumes', async () => {
    const { host, p1, p2 } = await setup();
    host.start();
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 1000);
    await sendBuzz(p1, CODE, 'q0_0');
    await vi.advanceTimersByTimeAsync(400);
    await sendBuzz(p2, CODE, 'q0_0'); // too late: p1 is already answering
    await vi.advanceTimersByTimeAsync(10);
    await sendAnswer(p1, CODE, 'q0_0', 'nope');
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state.phase).toBe('reading');
    await sendBuzz(p2, CODE, 'q0_1'); // a fresh segment, so this buzz counts
    await vi.advanceTimersByTimeAsync(400);
    expect(host.state).toMatchObject({ phase: 'answering', buzzer: 'p2' });
    host.dispose();
  });

  it('passes when the answer window runs out, and ends a question nobody buzzes on', async () => {
    const { host, p1 } = await setup();
    host.start();
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 1000);
    await sendBuzz(p1, CODE, 'q0_0');
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(5100); // answer window (5 s) closes
    expect(host.state.last).toMatchObject({ kind: 'pass', uid: 'p1', points: 0 });
    expect(host.state.teamScores).toEqual({ A: 0 });
    await vi.advanceTimersByTimeAsync(60_000); // nobody else buzzes either
    expect(host.state).toMatchObject({ phase: 'result' });
    expect(host.state.last).toMatchObject({ kind: 'nobody' });
    host.dispose();
  });

  it('scores free-for-all players individually', async () => {
    const { host, p1 } = await setup({ teamMode: 'ffa' });
    host.start();
    expect(host.state.teamOf).toEqual({ p1: 'p1', p2: 'p2', p3: 'p3' });
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 500);
    await sendBuzz(p1, CODE, 'q0_0');
    await vi.advanceTimersByTimeAsync(400);
    await sendAnswer(p1, CODE, 'q0_0', 'right');
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state.teamScores).toEqual({ p1: 3 });
    host.dispose();
  });

  it('does not start with nobody in the room', async () => {
    const hub = new MemoryHub();
    const host = new RoomHost({
      store: new LocalRoomStore('host', hub), code: CODE, mode: 'tossup', teamMode: 'teams', wordsPerSecond: 2, scoring: SCORING,
      tossups: [tossup], bonuses: [],
    });
    await vi.advanceTimersByTimeAsync(0);
    host.start();
    expect(host.state.phase).toBe('lobby');
    host.dispose();
  });

  it('goes back to the lobby when the game ends, keeping everyone and the results', async () => {
    const { hub, host, p1 } = await setup({ tossups: 1 });
    host.start();
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 500);
    await sendBuzz(p1, CODE, 'q0_0');
    await vi.advanceTimersByTimeAsync(400);
    await sendAnswer(p1, CODE, 'q0_0', 'right');
    await vi.advanceTimersByTimeAsync(10);
    host.next(); // that was the only question
    expect(host.state.phase).toBe('lobby');
    expect(host.state.lastGame?.teamScores).toEqual({ A: 3 });
    expect(stateOf(hub).phase).toBe('lobby');
    expect(Object.keys(getAt(hub.read(), `rooms/${CODE}/players`) as object)).toEqual(['p1', 'p2', 'p3']); // all still in the room
    host.start(); // and a new game can start straight away
    expect(host.state).toMatchObject({ phase: 'reading', games: 1 });
    expect(host.state.teamScores).toEqual({});
    host.dispose();
  });

  it('can be ended early by the host', async () => {
    const { host } = await setup();
    host.start();
    host.end();
    expect(host.state.phase).toBe('lobby');
    expect(host.state.games).toBe(1);
    host.dispose();
  });
});

describe('captains', () => {
  it('picks the earliest joiner on each team, and each free-for-all player for themselves', () => {
    const players = { x: { name: 'X', team: 'A', joinedAt: 30 }, y: { name: 'Y', team: 'A', joinedAt: 10 }, z: { name: 'Z', team: 'B', joinedAt: 20 } };
    expect(pickCaptains(players, { x: 'A', y: 'A', z: 'B' })).toEqual({ A: 'y', B: 'z' });
    expect(pickCaptains(players, { x: 'x', y: 'y', z: 'z' })).toEqual({ x: 'x', y: 'y', z: 'z' });
  });
});

describe('RoomHost: team bonuses', () => {
  beforeEach(() => { vi.useFakeTimers({ now: 1_000_000 }); });
  afterEach(() => { vi.useRealTimers(); });

  /** Starts a sim, has p3 (team A) answer the first tossup correctly, and presses Next into the bonus. */
  async function intoBonus() {
    const ctx = await setup({ mode: 'sim' });
    ctx.host.start();
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 500);
    await sendBuzz(ctx.p3, CODE, 'q0_0');
    await vi.advanceTimersByTimeAsync(400);
    await sendAnswer(ctx.p3, CODE, 'q0_0', 'right');
    await vi.advanceTimersByTimeAsync(10);
    ctx.host.next();
    return ctx;
  }

  it('game sim: the team that got the tossup gets the bonus, read out first and then opened for typing', async () => {
    const { host } = await intoBonus();
    expect(host.state).toMatchObject({ phase: 'bonus', mode: 'sim' });
    expect(host.state.bonus).toMatchObject({ teams: ['A'], open: false, partCount: 2 });
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 4000 + 50); // 8 words at 2 a second
    expect(host.state.bonus?.open).toBe(true);
    host.dispose();
  });

  it('lets teammates draft answers but only the captain can submit them', async () => {
    const { hub, host, p1, p3 } = await intoBonus();
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 4100);
    await sendDraft(p3, CODE, 0, 'A', 0, 'right'); // a teammate types part 1
    await sendDraft(p1, CODE, 0, 'A', 1, 'right'); // the captain types part 2
    await vi.advanceTimersByTimeAsync(10);
    await sendBonusSubmit(p3, CODE, 0, 'A', ['right', 'right']); // not the captain: ignored
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state.phase).toBe('bonus');
    await sendBonusSubmit(p1, CODE, 0, 'A', ['right', 'wrong']); // the captain
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state).toMatchObject({ phase: 'bonus_result', teamScores: { A: 3 + 5 } });
    expect(host.state.bonus?.results.A).toMatchObject({ by: 'p1', verdicts: [true, false], points: 5 });
    expect(stateOf(hub).phase).toBe('bonus_result');
    host.next(); // on to the next tossup
    expect(host.state).toMatchObject({ phase: 'reading', q: 1 });
    host.dispose();
  });

  it('when the clock closes, takes the latest draft from any teammate', async () => {
    const { host, p1, p3 } = await intoBonus();
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 4100);
    await sendDraft(p1, CODE, 0, 'A', 0, 'wrong');
    await vi.advanceTimersByTimeAsync(20);
    await sendDraft(p3, CODE, 0, 'A', 0, 'right'); // newer, so it wins
    await sendDraft(p3, CODE, 0, 'A', 1, 'right');
    await vi.advanceTimersByTimeAsync(10_500); // the answer window (10 s) closes
    expect(host.state.phase).toBe('bonus_result');
    expect(host.state.bonus?.results.A).toMatchObject({ by: null, verdicts: [true, true], points: 10 });
    host.dispose();
  });

  it('bonus drill: every team gets the bonus and the game ends back in the lobby', async () => {
    const { host, p1, p2 } = await setup({ mode: 'bonus', bonuses: 1 });
    host.start();
    expect(host.state).toMatchObject({ phase: 'bonus', mode: 'bonus' });
    expect(host.state.bonus?.teams).toEqual(['A', 'B']);
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 4100);
    await sendBonusSubmit(p1, CODE, 0, 'A', ['right', 'right']);
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state.phase).toBe('bonus'); // team B has not submitted
    await sendBonusSubmit(p2, CODE, 0, 'B', ['right', 'nope']);
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state).toMatchObject({ phase: 'bonus_result', teamScores: { A: 10, B: 5 } });
    host.next(); // that was the only bonus
    expect(host.state.phase).toBe('lobby');
    expect(host.state.lastGame).toMatchObject({ mode: 'bonus', teamScores: { A: 10, B: 5 } });
    host.dispose();
  });

  it('game sim: a tossup nobody gets has no bonus', async () => {
    const { host } = await setup({ mode: 'sim' });
    host.start();
    await vi.advanceTimersByTimeAsync(60_000); // nobody buzzes
    expect(host.state.phase).toBe('result');
    host.next();
    expect(host.state).toMatchObject({ phase: 'reading', q: 1 });
    expect(host.state.bonus).toBeNull();
    host.dispose();
  });

  it('game sim: each correct tossup uses the next unused bonus', async () => {
    const { host, p1, p3 } = await setup({ mode: 'sim', tossups: 3, bonuses: 3 });
    host.start();
    for (let round = 0; round < 2; round++) {
      await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 500);
      const seg = `q${round}_0`;
      await sendBuzz(p3, CODE, seg);
      await vi.advanceTimersByTimeAsync(400);
      await sendAnswer(p3, CODE, seg, 'right');
      await vi.advanceTimersByTimeAsync(10);
      host.next();
      expect(host.state.bonus?.index).toBe(round);
      await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 4100);
      await sendBonusSubmit(p1, CODE, round, 'A', ['right', 'right']);
      await vi.advanceTimersByTimeAsync(10);
      host.next();
    }
    expect(host.state).toMatchObject({ phase: 'reading', q: 2, bonusesUsed: 2 });
    host.dispose();
  });
});
