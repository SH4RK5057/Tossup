// Multiplayer room engine: the rules of a buzz-in tossup round, as a pure state machine.
// No React, DOM, Firebase or timers. The host's screen feeds it events (with server-synced times) and writes the
// resulting state for everyone to see; every screen derives what to draw from that state plus the current time.
//
// A round: the question is revealed word by word; the first buzz freezes it; the buzzer answers (correct, wrong or a
// pass); a wrong answer or pass locks that player out and the reveal resumes for the others; if nobody buzzes within
// BUZZ_WINDOW_MS after the last word, the question is dead. The host then presses Next.

export const BUZZ_WINDOW_MS = 5000;
/** Pause after "Next" before the first word appears, so everyone is looking. */
export const LEAD_IN_MS = 1500;
/** Buzzes that arrive this close together are ordered by their server timestamps before a winner is picked. */
export const BUZZ_TIE_WINDOW_MS = 200;

export type RoomPhase = 'lobby' | 'reading' | 'answering' | 'result' | 'done';

export interface PlayerScore {
  points: number;
  correct: number;
  wrong: number;
  passes: number;
}

export type OutcomeKind = 'correct' | 'wrong' | 'pass' | 'nobody';

export interface Outcome {
  kind: OutcomeKind;
  /** Who answered (not set for 'nobody'). */
  uid?: string;
  typed?: string;
  /** Points this outcome was worth to the answerer's team. */
  points: number;
}

export interface RoomState {
  phase: RoomPhase;
  /** Index of the question in play. */
  q: number;
  total: number;
  /** Words in the current question. */
  wordCount: number;
  /** Words already showing when the reveal (re)started. */
  readFrom: number;
  /** Server time the reveal (re)started; may be slightly in the future (the lead-in). */
  readStartAt: number;
  wordsPerSecond: number;
  /** Server time the buzz window closes (all words shown, then BUZZ_WINDOW_MS). */
  endAt: number;
  /** Buzzes received but not yet resolved into a winner. */
  pending: { uid: string; at: number }[];
  buzzer: string | null;
  /** Server time the buzzer's answer window closes. */
  answerDeadline: number | null;
  /** Words showing when the reveal froze. */
  frozenWords: number;
  lockedOut: string[];
  /** Team of each player taking part (free-for-all: a player's own uid). */
  teamOf: Record<string, string>;
  scoring: { correct: number; wrong: number };
  teamScores: Record<string, number>;
  playerScores: Record<string, PlayerScore>;
  last: Outcome | null;
  /** Bumped on every change so listeners can ignore stale deliveries. */
  version: number;
}

export type RoomEvent =
  | { type: 'start'; at: number; total: number; wordCount: number; wordsPerSecond: number; teamOf: Record<string, string>; scoring: { correct: number; wrong: number } }
  | { type: 'buzz'; uid: string; at: number }
  | { type: 'resolve'; at: number; answerMs: number }
  | { type: 'answer'; uid: string; at: number; typed: string; verdict: 'correct' | 'wrong' }
  | { type: 'timeout'; at: number }
  | { type: 'next'; at: number; wordCount: number }
  | { type: 'end' };

export function initialRoomState(): RoomState {
  return {
    phase: 'lobby', q: 0, total: 0, wordCount: 0, readFrom: 0, readStartAt: 0, wordsPerSecond: 3.3, endAt: 0,
    pending: [], buzzer: null, answerDeadline: null, frozenWords: 0, lockedOut: [], teamOf: {},
    scoring: { correct: 3, wrong: -1 }, teamScores: {}, playerScores: {}, last: null, version: 0,
  };
}

/** Words showing at server time `t` while the reveal is running. */
export function wordsShown(s: RoomState, t: number): number {
  if (s.phase === 'reading') {
    const elapsed = Math.max(0, t - s.readStartAt) / 1000;
    return Math.min(s.wordCount, s.readFrom + Math.floor(elapsed * s.wordsPerSecond));
  }
  if (s.phase === 'answering') return s.frozenWords;
  if (s.phase === 'result') return s.wordCount;
  return 0;
}

/** When the clock that ends this phase fires (reading: the buzz window closes; answering: the answer window closes). */
export function nextDeadline(s: RoomState): number | null {
  if (s.phase === 'reading') return s.endAt;
  if (s.phase === 'answering') return s.answerDeadline;
  return null;
}

function revealEnd(readStartAt: number, readFrom: number, wordCount: number, wps: number): number {
  const remaining = Math.max(0, wordCount - readFrom);
  return readStartAt + Math.ceil((remaining / wps) * 1000) + BUZZ_WINDOW_MS;
}

const blankScore = (): PlayerScore => ({ points: 0, correct: 0, wrong: 0, passes: 0 });

function award(s: RoomState, uid: string, kind: 'correct' | 'wrong' | 'pass'): { teamScores: Record<string, number>; playerScores: Record<string, PlayerScore>; points: number } {
  const points = kind === 'correct' ? s.scoring.correct : kind === 'wrong' ? s.scoring.wrong : 0;
  const team = s.teamOf[uid] ?? uid;
  const prev = s.playerScores[uid] ?? blankScore();
  return {
    points,
    teamScores: { ...s.teamScores, [team]: (s.teamScores[team] ?? 0) + points },
    playerScores: {
      ...s.playerScores,
      [uid]: {
        points: prev.points + points,
        correct: prev.correct + (kind === 'correct' ? 1 : 0),
        wrong: prev.wrong + (kind === 'wrong' ? 1 : 0),
        passes: prev.passes + (kind === 'pass' ? 1 : 0),
      },
    },
  };
}

function bump(s: RoomState): RoomState {
  return { ...s, version: s.version + 1 };
}

/** The answerer failed (wrong or pass): lock them out and either resume the reveal or end the question. */
function afterMiss(s: RoomState, uid: string, kind: 'wrong' | 'pass', typed: string | undefined, at: number): RoomState {
  const scored = award(s, uid, kind);
  const lockedOut = [...s.lockedOut, uid];
  const base: RoomState = {
    ...s, ...scored, lockedOut, buzzer: null, answerDeadline: null, pending: [],
    last: { kind, uid, typed, points: scored.points },
  };
  const everyoneOut = Object.keys(s.teamOf).every((p) => lockedOut.includes(p));
  if (everyoneOut) return bump({ ...base, phase: 'result', last: { kind, uid, typed, points: scored.points } });
  return bump({
    ...base, phase: 'reading', readFrom: s.frozenWords, readStartAt: at,
    endAt: revealEnd(at, s.frozenWords, s.wordCount, s.wordsPerSecond),
  });
}

export function reduceRoom(s: RoomState, e: RoomEvent): RoomState {
  switch (e.type) {
    case 'start': {
      if (s.phase !== 'lobby') return s;
      const readStartAt = e.at + LEAD_IN_MS;
      return bump({
        ...initialRoomState(), version: s.version,
        phase: 'reading', q: 0, total: e.total, wordCount: e.wordCount, wordsPerSecond: e.wordsPerSecond,
        readFrom: 0, readStartAt, endAt: revealEnd(readStartAt, 0, e.wordCount, e.wordsPerSecond),
        teamOf: e.teamOf, scoring: e.scoring,
      });
    }
    case 'buzz': {
      if (s.phase !== 'reading') return s;
      if (!(e.uid in s.teamOf) || s.lockedOut.includes(e.uid) || s.pending.some((p) => p.uid === e.uid)) return s;
      return bump({ ...s, pending: [...s.pending, { uid: e.uid, at: e.at }] });
    }
    case 'resolve': {
      if (s.phase !== 'reading' || s.pending.length === 0) return s;
      const winner = [...s.pending].sort((a, b) => a.at - b.at || (a.uid < b.uid ? -1 : 1))[0];
      return bump({
        ...s, phase: 'answering', buzzer: winner.uid, pending: [],
        frozenWords: wordsShown(s, winner.at), answerDeadline: e.at + e.answerMs,
      });
    }
    case 'answer': {
      if (s.phase !== 'answering' || s.buzzer !== e.uid) return s;
      if (e.verdict === 'correct') {
        const scored = award(s, e.uid, 'correct');
        return bump({
          ...s, ...scored, phase: 'result', buzzer: null, answerDeadline: null,
          last: { kind: 'correct', uid: e.uid, typed: e.typed, points: scored.points },
        });
      }
      // A blank answer is a pass (no penalty); anything else that is wrong is a miss.
      return afterMiss(s, e.uid, e.typed.trim() === '' ? 'pass' : 'wrong', e.typed, e.at);
    }
    case 'timeout': {
      if (s.phase === 'answering' && s.answerDeadline !== null && e.at >= s.answerDeadline && s.buzzer) {
        return afterMiss(s, s.buzzer, 'pass', '', e.at);
      }
      if (s.phase === 'reading' && s.pending.length === 0 && e.at >= s.endAt) {
        return bump({ ...s, phase: 'result', last: { kind: 'nobody', points: 0 } });
      }
      return s;
    }
    case 'next': {
      if (s.phase !== 'result') return s;
      if (s.q + 1 >= s.total) return bump({ ...s, phase: 'done' });
      const readStartAt = e.at + LEAD_IN_MS;
      return bump({
        ...s, phase: 'reading', q: s.q + 1, wordCount: e.wordCount, readFrom: 0, readStartAt,
        endAt: revealEnd(readStartAt, 0, e.wordCount, s.wordsPerSecond),
        pending: [], buzzer: null, answerDeadline: null, frozenWords: 0, lockedOut: [], last: null,
      });
    }
    case 'end':
      return s.phase === 'done' ? s : bump({ ...s, phase: 'done', buzzer: null, answerDeadline: null, pending: [] });
  }
}

/** Teams ranked by score, highest first. */
export function rankTeams(s: RoomState): { team: string; points: number }[] {
  const teams = new Set([...Object.values(s.teamOf), ...Object.keys(s.teamScores)]);
  return [...teams].map((team) => ({ team, points: s.teamScores[team] ?? 0 })).sort((a, b) => b.points - a.points || (a.team < b.team ? -1 : 1));
}

/**
 * Identifies one uninterrupted stretch of reveal: the question number plus how many players have already been locked
 * out. Buzzes and answers are filed under it, so a player whose buzz was too late can buzz again once the reveal resumes.
 */
export function segmentOf(s: Pick<RoomState, 'q' | 'lockedOut'>): string {
  return `${s.q}.${s.lockedOut.length}`;
}

/**
 * Rebuilds a full RoomState from what a database returned. Realtime Database drops empty lists, empty objects and
 * nulls, so a state read back from it can be missing fields the engine always expects.
 */
export function normalizeRoomState(raw: unknown): RoomState {
  const base = initialRoomState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<RoomState> & Record<string, unknown>;
  const list = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : v && typeof v === 'object' ? (Object.values(v) as T[]) : []);
  return {
    ...base,
    ...r,
    pending: list<{ uid: string; at: number }>(r.pending),
    lockedOut: list<string>(r.lockedOut),
    teamOf: (r.teamOf as Record<string, string>) ?? {},
    teamScores: (r.teamScores as Record<string, number>) ?? {},
    playerScores: (r.playerScores as Record<string, PlayerScore>) ?? {},
    buzzer: (r.buzzer as string | null | undefined) ?? null,
    answerDeadline: (r.answerDeadline as number | null | undefined) ?? null,
    last: (r.last as Outcome | null | undefined) ?? null,
  };
}
