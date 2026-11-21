import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LEAD_IN_MS } from '../core/room';
import { RoomHost, sendAnswer, sendBuzz, writePlayer, type HostQuestion } from './host';
import { LocalRoomStore, MemoryHub } from './localStore';
import { getAt } from './store';

const CODE = 'ABCD';
const question: HostQuestion = { wordCount: 10, answerSeconds: 5, judge: (t) => (t.trim().toLowerCase() === 'right' ? 'correct' : 'wrong') };

async function setup(teamMode: 'teams' | 'ffa' = 'teams') {
  const hub = new MemoryHub();
  const hostStore = new LocalRoomStore('host', hub);
  const p1 = new LocalRoomStore('p1', hub);
  const p2 = new LocalRoomStore('p2', hub);
  await writePlayer(p1, CODE, 'Ann', 'A');
  await writePlayer(p2, CODE, 'Bo', 'B');
  const host = new RoomHost({
    store: hostStore, code: CODE, questions: [question, question], teamMode, wordsPerSecond: 2, scoring: { correct: 3, wrong: -1 },
  });
  await vi.advanceTimersByTimeAsync(0);
  return { hub, host, p1, p2 };
}
const stateOf = (hub: MemoryHub) => getAt(hub.read(), `rooms/${CODE}/state`) as ReturnType<typeof Object>;

describe('RoomHost', () => {
  beforeEach(() => { vi.useFakeTimers({ now: 1_000_000 }); });
  afterEach(() => { vi.useRealTimers(); });

  it('runs a question: buzz, wrong answer, second buzz, correct answer, next', async () => {
    const { hub, host, p1, p2 } = await setup();
    host.start();
    expect(host.state.phase).toBe('reading');
    expect(host.state.teamOf).toEqual({ p1: 'A', p2: 'B' });
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 2000); // four words showing

    await sendBuzz(p1, CODE, '0.0');
    await vi.advanceTimersByTimeAsync(400); // past the tie window
    expect(host.state).toMatchObject({ phase: 'answering', buzzer: 'p1', frozenWords: 4 });

    await sendAnswer(p1, CODE, '0.0', 'nope');
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state).toMatchObject({ phase: 'reading', lockedOut: ['p1'], teamScores: { A: -1 } });
    expect((stateOf(hub) as { phase: string }).phase).toBe('reading'); // everyone can see it

    await sendBuzz(p2, CODE, '0.1');
    await vi.advanceTimersByTimeAsync(400);
    expect(host.state).toMatchObject({ phase: 'answering', buzzer: 'p2' });
    await sendAnswer(p2, CODE, '0.1', 'RIGHT');
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state).toMatchObject({ phase: 'result', teamScores: { A: -1, B: 3 } });
    expect(host.state.last).toMatchObject({ kind: 'correct', uid: 'p2' });

    host.next();
    expect(host.state).toMatchObject({ phase: 'reading', q: 1, lockedOut: [] });
    host.dispose();
  });

  it('gives a near-simultaneous buzz race to the earlier server timestamp', async () => {
    const { host, p1, p2 } = await setup();
    host.start();
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 1000);
    await sendBuzz(p2, CODE, '0.0'); // stamped first
    await vi.advanceTimersByTimeAsync(80);
    await sendBuzz(p1, CODE, '0.0'); // stamped 80 ms later, inside the tie window
    await vi.advanceTimersByTimeAsync(400);
    expect(host.state.buzzer).toBe('p2');
    host.dispose();
  });

  it('lets a player who buzzed too late buzz again once the reveal resumes', async () => {
    const { host, p1, p2 } = await setup();
    host.start();
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 1000);
    await sendBuzz(p1, CODE, '0.0');
    await vi.advanceTimersByTimeAsync(400);
    await sendBuzz(p2, CODE, '0.0'); // too late: p1 is already answering
    await vi.advanceTimersByTimeAsync(10);
    await sendAnswer(p1, CODE, '0.0', 'nope');
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state.phase).toBe('reading');
    await sendBuzz(p2, CODE, '0.1'); // a fresh segment, so this buzz counts
    await vi.advanceTimersByTimeAsync(400);
    expect(host.state).toMatchObject({ phase: 'answering', buzzer: 'p2' });
    host.dispose();
  });

  it('passes when the answer window runs out, and ends a question nobody buzzes on', async () => {
    const { host, p1 } = await setup();
    host.start();
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 1000);
    await sendBuzz(p1, CODE, '0.0');
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(5100); // answer window (5 s) closes
    expect(host.state.last).toMatchObject({ kind: 'pass', uid: 'p1', points: 0 });
    expect(host.state.teamScores).toEqual({ A: 0 });
    await vi.advanceTimersByTimeAsync(60_000); // p2 never buzzes either
    expect(host.state).toMatchObject({ phase: 'result' });
    expect(host.state.last).toMatchObject({ kind: 'nobody' });
    host.dispose();
  });

  it('scores free-for-all players individually', async () => {
    const { host, p1 } = await setup('ffa');
    host.start();
    expect(host.state.teamOf).toEqual({ p1: 'p1', p2: 'p2' });
    await vi.advanceTimersByTimeAsync(LEAD_IN_MS + 500);
    await sendBuzz(p1, CODE, '0.0');
    await vi.advanceTimersByTimeAsync(400);
    await sendAnswer(p1, CODE, '0.0', 'right');
    await vi.advanceTimersByTimeAsync(10);
    expect(host.state.teamScores).toEqual({ p1: 3 });
    host.dispose();
  });

  it('does not start with nobody in the room', async () => {
    const hub = new MemoryHub();
    const host = new RoomHost({
      store: new LocalRoomStore('host', hub), code: CODE, questions: [question], teamMode: 'teams', wordsPerSecond: 2, scoring: { correct: 3, wrong: -1 },
    });
    await vi.advanceTimersByTimeAsync(0);
    host.start();
    expect(host.state.phase).toBe('lobby');
    host.dispose();
  });
});
