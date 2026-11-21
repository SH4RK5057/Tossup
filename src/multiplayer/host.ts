// The host's screen is the referee: it listens for buzzes and answers, runs the room engine, owns the clocks, and
// writes the resulting RoomState for everyone to see. No server is needed. Players only ever write their own buzz,
// their own answer, and their own player record.

import {
  BUZZ_TIE_WINDOW_MS, initialRoomState, nextDeadline, reduceRoom, segmentOf, type RoomEvent, type RoomState,
} from '../core/room';
import { roomPath, SERVER_TIME, type RoomStore, type Unsubscribe } from './store';

export interface HostQuestion {
  wordCount: number;
  /** Seconds a player who has buzzed gets to type the answer. */
  answerSeconds: number;
  /** Grades typed text against the answer key. */
  judge(typed: string): 'correct' | 'wrong';
}

export interface RoomPlayer {
  name: string;
  /** Team id ('A', 'B', ...) in team mode; ignored in free-for-all. */
  team: string;
  joinedAt: number;
}

export interface HostOptions {
  store: RoomStore;
  code: string;
  questions: HostQuestion[];
  teamMode: 'teams' | 'ffa';
  wordsPerSecond: number;
  scoring: { correct: number; wrong: number };
  /** Resume a game already in progress (a host who reloaded the page). */
  initialState?: RoomState | null;
  /** Injected for tests; defaults to the real timers. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export class RoomHost {
  state: RoomState = initialRoomState();
  private players: Record<string, RoomPlayer> = {};
  private subs: Unsubscribe[] = [];
  private questionSubs: Unsubscribe[] = [];
  private subscribedSegment = '';
  private handledBuzz = new Set<string>();
  private handledAnswer = new Set<string>();
  private deadlineTimer: unknown = null;
  private resolveTimer: unknown = null;
  private listeners = new Set<(s: RoomState) => void>();
  private disposed = false;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (id: unknown) => void;

  constructor(private o: HostOptions) {
    this.setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = o.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
    this.subs.push(o.store.onValue(roomPath(o.code, 'players'), (v) => {
      this.players = (v as Record<string, RoomPlayer> | null) ?? {};
    }));
    if (o.initialState && o.initialState.phase !== 'lobby') {
      this.state = o.initialState;
      this.afterChange();
    }
  }

  /** Called whenever the host's own state changes (for the host's screen). */
  onChange(cb: (s: RoomState) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Locks the lobby and starts question 1. */
  start(): void {
    if (this.state.phase !== 'lobby') return;
    const uids = Object.keys(this.players);
    if (uids.length === 0 || this.o.questions.length === 0) return;
    const teamOf: Record<string, string> = {};
    for (const uid of uids) teamOf[uid] = this.o.teamMode === 'teams' ? this.players[uid].team : uid;
    this.apply({
      type: 'start', at: this.o.store.now(), total: this.o.questions.length, wordCount: this.o.questions[0].wordCount,
      wordsPerSecond: this.o.wordsPerSecond, teamOf, scoring: this.o.scoring,
    });
  }

  /** The host pressed Next (only does anything from a result screen). */
  next(): void {
    const q = this.state.q + 1;
    this.apply({ type: 'next', at: this.o.store.now(), wordCount: this.o.questions[q]?.wordCount ?? 0 });
  }

  end(): void { this.apply({ type: 'end' }); }

  dispose(): void {
    this.disposed = true;
    this.subs.forEach((u) => u());
    this.questionSubs.forEach((u) => u());
    if (this.deadlineTimer !== null) this.clearTimer(this.deadlineTimer);
    if (this.resolveTimer !== null) this.clearTimer(this.resolveTimer);
    this.listeners.clear();
  }

  private apply(e: RoomEvent): void {
    if (this.disposed) return;
    const next = reduceRoom(this.state, e);
    if (next === this.state) return;
    this.state = next;
    void this.o.store.set(roomPath(this.o.code, 'state'), next);
    this.listeners.forEach((cb) => cb(next));
    this.afterChange();
  }

  private afterChange(): void {
    const s = this.state;
    if (s.phase === 'reading' || s.phase === 'answering') this.watchSegment(segmentOf(s));
    // Clock that ends the current phase.
    if (this.deadlineTimer !== null) { this.clearTimer(this.deadlineTimer); this.deadlineTimer = null; }
    const deadline = nextDeadline(s);
    if (deadline !== null) {
      const wait = Math.max(0, deadline - this.o.store.now()) + 5;
      this.deadlineTimer = this.setTimer(() => this.apply({ type: 'timeout', at: this.o.store.now() }), wait);
    }
    // Buzzes in flight: wait a moment so near-simultaneous buzzes can be ordered by server time.
    if (s.phase === 'reading' && s.pending.length > 0 && this.resolveTimer === null) {
      this.resolveTimer = this.setTimer(() => {
        this.resolveTimer = null;
        const q = this.o.questions[this.state.q];
        if (q) this.apply({ type: 'resolve', at: this.o.store.now(), answerMs: q.answerSeconds * 1000 });
      }, BUZZ_TIE_WINDOW_MS);
    }
  }

  /** Listens for the buzzes and answers filed under this stretch of reveal. */
  private watchSegment(segment: string): void {
    if (this.subscribedSegment === segment) return;
    this.questionSubs.forEach((u) => u());
    this.questionSubs = [];
    this.subscribedSegment = segment;
    this.handledBuzz = new Set();
    this.handledAnswer = new Set();
    this.questionSubs.push(this.o.store.onValue(roomPath(this.o.code, 'buzz', segment), (v) => {
      for (const [uid, at] of Object.entries((v as Record<string, number> | null) ?? {})) {
        if (this.handledBuzz.has(uid) || typeof at !== 'number') continue;
        this.handledBuzz.add(uid);
        this.apply({ type: 'buzz', uid, at });
      }
    }));
    this.questionSubs.push(this.o.store.onValue(roomPath(this.o.code, 'answer', segment), (v) => {
      for (const [uid, a] of Object.entries((v as Record<string, { text: string; at: number }> | null) ?? {})) {
        if (this.handledAnswer.has(uid) || !a || typeof a.text !== 'string') continue;
        if (this.state.phase !== 'answering' || this.state.buzzer !== uid) continue;
        this.handledAnswer.add(uid);
        const question = this.o.questions[this.state.q];
        this.apply({ type: 'answer', uid, at: this.o.store.now(), typed: a.text, verdict: question ? question.judge(a.text) : 'wrong' });
      }
    }));
  }
}

// ----------------------------------------------------------------- what players (and the host) write

export async function writePlayer(store: RoomStore, code: string, name: string, team: string): Promise<void> {
  await store.set(roomPath(code, 'players', store.uid), { name, team, joinedAt: SERVER_TIME });
}

export async function sendBuzz(store: RoomStore, code: string, segment: string): Promise<void> {
  await store.set(roomPath(code, 'buzz', segment, store.uid), SERVER_TIME);
}

export async function sendAnswer(store: RoomStore, code: string, segment: string, text: string): Promise<void> {
  await store.set(roomPath(code, 'answer', segment, store.uid), { text, at: SERVER_TIME });
}
