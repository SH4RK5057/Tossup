// The host's screen is the referee: it listens for buzzes and bonus submissions, runs the room engine, owns the clocks,
// and writes the resulting RoomState for everyone to see. No server is needed. Players only ever write their own
// buzz, their own answer or draft, and their own player record.
//
// Where things live under rooms/<code>/ (all writes by players are to their own uid node under answer/):
//   buzz/<segment>/<uid>                 a buzz (server time)
//   answer/<segment>/<uid>               a tossup answer      { text, at }
//   answer/d<q>_<team>_<part>/<uid>      a teammate's draft of one bonus part   { text, at }   (latest wins)
//   answer/s<q>_<team>/<uid>             a captain's submission of all parts    { text:'', at, answers:[...] }

import {
  BUZZ_TIE_WINDOW_MS, bonusKeyOf, initialRoomState, nextDeadline, reduceRoom, segmentOf, type BonusInfo, type RoomEvent,
  type RoomMode, type RoomState, type Scoring,
} from '../core/room';
import { roomPath, SERVER_TIME, type RoomStore, type Unsubscribe } from './store';

export interface HostQuestion {
  wordCount: number;
  /** Seconds a player who has buzzed gets to type the answer. */
  answerSeconds: number;
  /** Grades typed text against the answer key. */
  judge(typed: string): 'correct' | 'wrong';
}

export interface HostBonus {
  wordCount: number;
  partCount: number;
  /** Seconds a team gets to answer once the bonus has been fully read. */
  answerSeconds: number;
  /** Grades one typed answer per part. */
  judge(answers: string[]): boolean[];
}

export interface RoomPlayer {
  name: string;
  /** Team id ('A', 'B', ...) in team mode; ignored in free-for-all. */
  team: string;
  joinedAt: number;
}

export interface HostContent {
  tossups: HostQuestion[];
  bonuses: HostBonus[];
}

/** What a game is played with; the host can change it between games. */
export interface HostConfig {
  teamMode: 'teams' | 'ffa';
  wordsPerSecond: number;
  scoring: Scoring;
}

export interface HostOptions extends HostContent {
  store: RoomStore;
  code: string;
  mode: RoomMode;
  teamMode: 'teams' | 'ffa';
  wordsPerSecond: number;
  scoring: Scoring;
  /** Resume a game already in progress (a host who reloaded the page). */
  initialState?: RoomState | null;
  /** Injected for tests; defaults to the real timers. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

/** Keys a bonus's drafts and submission are filed under. */
export const draftKey = (q: number, team: string, part: number) => `d${q}_${team}_${part}`;
export const submitKey = (q: number, team: string) => `s${q}_${team}`;

/** The captain of each team: the earliest to join (ties broken by id). A free-for-all player is their own captain. */
export function pickCaptains(players: Record<string, RoomPlayer>, teamOf: Record<string, string>): Record<string, string> {
  const captains: Record<string, string> = {};
  const byJoin = Object.keys(teamOf).sort((a, b) => (players[a]?.joinedAt ?? 0) - (players[b]?.joinedAt ?? 0) || (a < b ? -1 : 1));
  for (const uid of byJoin) captains[teamOf[uid]] ??= uid;
  return captains;
}

export class RoomHost {
  state: RoomState;
  private players: Record<string, RoomPlayer> = {};
  private content: HostContent;
  private mode: RoomMode;
  private config: HostConfig;
  private subs: Unsubscribe[] = [];
  private questionSubs: Unsubscribe[] = [];
  private subscribedSegment = '';
  private bonusSubs: Unsubscribe[] = [];
  private subscribedBonus = '';
  private handledBuzz = new Set<string>();
  private handledAnswer = new Set<string>();
  private handledSubmit = new Set<string>();
  private deadlineTimer: unknown = null;
  private resolveTimer: unknown = null;
  private listeners = new Set<(s: RoomState) => void>();
  private disposed = false;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (id: unknown) => void;

  constructor(private o: HostOptions) {
    this.state = initialRoomState();
    this.content = { tossups: o.tossups, bonuses: o.bonuses };
    this.mode = o.mode;
    this.config = { teamMode: o.teamMode, wordsPerSecond: o.wordsPerSecond, scoring: o.scoring };
    this.setTimer = o.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = o.clearTimer ?? ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));
    this.subs.push(o.store.onValue(roomPath(o.code, 'players'), (v) => {
      this.players = (v as Record<string, RoomPlayer> | null) ?? {};
    }));
    if (o.initialState && o.initialState.phase !== 'lobby') {
      this.state = o.initialState;
      this.afterChange();
    } else if (o.initialState) {
      this.state = o.initialState; // a lobby that already has results from an earlier game
    }
  }

  /** Called whenever the host's own state changes (for the host's screen). */
  onChange(cb: (s: RoomState) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** New team mode, reading speed and scoring for the next game (the host changed the settings in the lobby). */
  setConfig(config: HostConfig): void {
    this.config = config;
  }

  /** New questions for the next game (the room reseeds between games). */
  setContent(content: HostContent, mode: RoomMode = this.mode): void {
    this.content = content;
    this.mode = mode;
  }

  /** Locks the lobby and starts round 1. */
  start(): void {
    if (this.state.phase !== 'lobby') return;
    const uids = Object.keys(this.players);
    const { tossups, bonuses } = this.content;
    const total = this.mode === 'bonus' ? bonuses.length : tossups.length;
    if (uids.length === 0 || total === 0) return;
    const teamOf: Record<string, string> = {};
    for (const uid of uids) teamOf[uid] = this.config.teamMode === 'teams' ? this.players[uid].team : uid;
    this.apply({
      type: 'start', at: this.o.store.now(), mode: this.mode, total, wordsPerSecond: this.config.wordsPerSecond, teamOf,
      captains: pickCaptains(this.players, teamOf), scoring: this.config.scoring,
      wordCount: tossups[0]?.wordCount ?? 0,
      bonus: this.mode === 'bonus' ? this.bonusInfo(0) : undefined,
    });
  }

  /** The host pressed Next (only does anything from a result screen). */
  next(): void {
    const s = this.state;
    const q = s.q + 1;
    // A sim bonus is the next unused bonus (one per correct tossup); a bonus drill uses them in order.
    const bonusIndex = this.mode === 'bonus' ? q : s.bonusesUsed;
    this.apply({
      type: 'next', at: this.o.store.now(), wordCount: this.content.tossups[q]?.wordCount ?? 0, bonus: this.bonusInfo(bonusIndex),
    });
  }

  end(): void { this.apply({ type: 'end' }); }

  dispose(): void {
    this.disposed = true;
    this.subs.forEach((u) => u());
    this.questionSubs.forEach((u) => u());
    this.bonusSubs.forEach((u) => u());
    if (this.deadlineTimer !== null) this.clearTimer(this.deadlineTimer);
    if (this.resolveTimer !== null) this.clearTimer(this.resolveTimer);
    this.listeners.clear();
  }

  private bonusInfo(index: number): BonusInfo | undefined {
    const b = this.content.bonuses[index];
    return b ? { index, wordCount: b.wordCount, partCount: b.partCount } : undefined;
  }

  private apply(e: RoomEvent): void {
    if (this.disposed) return;
    const before = this.state;
    const next = reduceRoom(before, e);
    if (next === before) return;
    this.state = next;
    void this.o.store.set(roomPath(this.o.code, 'state'), next);
    this.listeners.forEach((cb) => cb(next));
    this.afterChange();
  }

  private afterChange(): void {
    const s = this.state;
    if (s.phase === 'reading' || s.phase === 'answering') this.watchSegment(segmentOf(s));
    if (s.phase === 'bonus') this.watchBonus(bonusKeyOf(s));
    // Clock that ends the current phase.
    if (this.deadlineTimer !== null) { this.clearTimer(this.deadlineTimer); this.deadlineTimer = null; }
    const deadline = nextDeadline(s);
    if (deadline !== null) {
      const wait = Math.max(0, deadline - this.o.store.now()) + 5;
      this.deadlineTimer = this.setTimer(() => this.onDeadline(), wait);
    }
    // Buzzes in flight: wait a moment so near-simultaneous buzzes can be ordered by server time.
    if (s.phase === 'reading' && s.pending.length > 0 && this.resolveTimer === null) {
      this.resolveTimer = this.setTimer(() => {
        this.resolveTimer = null;
        const q = this.content.tossups[this.state.q];
        if (q) this.apply({ type: 'resolve', at: this.o.store.now(), answerMs: q.answerSeconds * 1000 });
      }, BUZZ_TIE_WINDOW_MS);
    }
  }

  private async onDeadline(): Promise<void> {
    const s = this.state;
    const at = this.o.store.now();
    if (s.phase === 'bonus' && s.bonus) {
      const bonus = this.content.bonuses[s.bonus.index];
      if (!s.bonus.open) {
        this.apply({ type: 'bonusOpen', at, answerMs: (bonus?.answerSeconds ?? 30) * 1000 });
        return;
      }
      // The clock ran out: take whatever each team that has not submitted has typed.
      const entries: { team: string; answers: string[]; verdicts: boolean[] }[] = [];
      for (const team of s.bonus.teams) {
        if (s.bonus.submitted.includes(team)) continue;
        const answers = await this.readDrafts(s.q, team, s.bonus.partCount);
        entries.push({ team, answers, verdicts: bonus ? bonus.judge(answers) : [] });
      }
      this.apply({ type: 'bonusClose', at: this.o.store.now(), entries });
      return;
    }
    this.apply({ type: 'timeout', at });
  }

  /** The latest draft of each part for a team (teammates may all have typed into the same part; the newest wins). */
  private async readDrafts(q: number, team: string, parts: number): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < parts; i++) {
      const v = (await readValue(this.o.store, roomPath(this.o.code, 'answer', draftKey(q, team, i)))) as Record<string, { text?: string; at?: number }> | null;
      const latest = Object.values(v ?? {}).filter((d) => typeof d?.text === 'string').sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
      out.push(latest?.text ?? '');
    }
    return out;
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
        const question = this.content.tossups[this.state.q];
        this.apply({ type: 'answer', uid, at: this.o.store.now(), typed: a.text, verdict: question ? question.judge(a.text) : 'wrong' });
      }
    }));
  }

  /** Listens for each team's captain submitting its bonus answers. */
  private watchBonus(key: string): void {
    const s = this.state;
    const id = `${key}:${s.bonus?.index ?? ''}`;
    if (this.subscribedBonus === id || !s.bonus) return;
    this.bonusSubs.forEach((u) => u());
    this.bonusSubs = [];
    this.subscribedBonus = id;
    this.handledSubmit = new Set();
    for (const team of s.bonus.teams) {
      this.bonusSubs.push(this.o.store.onValue(roomPath(this.o.code, 'answer', submitKey(s.q, team)), (v) => {
        for (const [uid, sub] of Object.entries((v as Record<string, { answers?: unknown; at: number }> | null) ?? {})) {
          const handled = `${team}:${uid}`;
          if (this.handledSubmit.has(handled) || !sub) continue;
          const st = this.state;
          if (st.phase !== 'bonus' || !st.bonus || !st.bonus.open || st.captains[team] !== uid) continue; // only the captain, once the text has been read
          this.handledSubmit.add(handled);
          const raw = Array.isArray(sub.answers) ? sub.answers : sub.answers && typeof sub.answers === 'object' ? Object.values(sub.answers) : [];
          const answers = Array.from({ length: st.bonus.partCount }, (_, i) => String(raw[i] ?? ''));
          const bonus = this.content.bonuses[st.bonus.index];
          this.apply({ type: 'bonusSubmit', at: this.o.store.now(), team, by: uid, answers, verdicts: bonus ? bonus.judge(answers) : [] });
        }
      }));
    }
  }
}

function readValue(store: RoomStore, path: string): Promise<unknown> {
  return new Promise((resolve) => {
    let done = false;
    let off: (() => void) | null = null;
    off = store.onValue(path, (v) => {
      if (done) return;
      done = true;
      resolve(v);
      queueMicrotask(() => off?.());
    });
  });
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

/** A teammate's draft of one bonus part, shared with the rest of the team. */
export async function sendDraft(store: RoomStore, code: string, q: number, team: string, part: number, text: string): Promise<void> {
  await store.set(roomPath(code, 'answer', draftKey(q, team, part), store.uid), { text, at: SERVER_TIME });
}

/** The captain submitting all the team's bonus answers. */
export async function sendBonusSubmit(store: RoomStore, code: string, q: number, team: string, answers: string[]): Promise<void> {
  await store.set(roomPath(code, 'answer', submitKey(q, team), store.uid), { text: '', at: SERVER_TIME, answers });
}
