// Multiplayer room engine: the rules of a buzz-in game, as a pure state machine.
// No React, DOM, Firebase or timers. The host's screen feeds it events (with server-synced times) and writes the
// resulting state for everyone to see; every screen derives what to draw from that state plus the current time.
//
// Three modes, the same as solo practice:
//   tossup  Tossups only. The question is revealed word by word; the first buzz freezes it; the buzzer answers
//           (correct, wrong or a pass); a wrong answer or pass locks that player out and the reveal resumes for the
//           others; if nobody buzzes within BUZZ_WINDOW_MS after the last word, the question is dead.
//   bonus   Bonus drill. Every team gets the same bonus at once.
//   sim     Game sim. A tossup, and if a player answers it correctly their team gets the next bonus.
// A bonus is read out word by word; once it is fully read the teams may type, and each team's captain submits all
// the answers (or the clock closes and whatever is typed is submitted). The host presses Next between rounds.
// When the last round ends (or the host ends the game) the room goes back to the lobby, with the results kept.

export const BUZZ_WINDOW_MS = 5000;
/** Pause after "Next" before the first word appears, so everyone is looking. */
export const LEAD_IN_MS = 1500;
/** Buzzes that arrive this close together are ordered by their server timestamps before a winner is picked. */
export const BUZZ_TIE_WINDOW_MS = 200;
/** How long before the reading starts a buzz still counts. */
export const EARLY_BUZZ_MS = 300;
/** After a miss the reading restarts this long after the verdict, so players who hear of it later (network delay) are not behind the host. */
export const RESUME_DELAY_MS = 600;
/** Once every player is locked out the reading still finishes, then the question ends after this short beat. */
export const ALL_OUT_TAIL_MS = 1500;

export type RoomMode = 'tossup' | 'bonus' | 'sim';
export type RoomPhase = 'lobby' | 'reading' | 'answering' | 'result' | 'bonus' | 'bonus_result';

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

/** What a team did with a bonus. */
export interface BonusTeamResult {
  answers: string[];
  /** One per part: was the answer right? */
  verdicts: boolean[];
  points: number;
  /** The captain who submitted, or null when the clock closed and the typed answers were taken. */
  by: string | null;
}

export interface BonusRound {
  /** Which bonus in the room's bonus list this is. */
  index: number;
  /** The teams answering it (the team that won the tossup in a sim; every team in a bonus drill). */
  teams: string[];
  partCount: number;
  /** Words in the whole bonus text (lead-in and every part). */
  wordCount: number;
  /** Server time the reveal started; may be slightly in the future (the lead-in). */
  readStartAt: number;
  /** The text has been fully read and teams may type. */
  open: boolean;
  /** Server time the answer window closes (set when it opens). */
  answerDeadline: number | null;
  /** Teams that have submitted. */
  submitted: string[];
  results: Record<string, BonusTeamResult>;
}

/** The scores of a finished game, kept so the lobby can show them. */
export interface GameSummary {
  mode: RoomMode;
  rounds: number;
  teamOf: Record<string, string>;
  teamScores: Record<string, number>;
  playerScores: Record<string, PlayerScore>;
}

export interface Scoring {
  correct: number;
  wrong: number;
  /** Points for each correct bonus part. */
  bonusPart: number;
}

export interface RoomState {
  phase: RoomPhase;
  mode: RoomMode;
  /** Index of the round in play (a tossup, or a bonus in a bonus drill). */
  q: number;
  total: number;
  /** Words in the current tossup. */
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
  /** The one player on each team who may submit its bonus answers (earliest to join). */
  captains: Record<string, string>;
  scoring: Scoring;
  teamScores: Record<string, number>;
  playerScores: Record<string, PlayerScore>;
  last: Outcome | null;
  bonus: BonusRound | null;
  /** The finished game's scores, shown in the lobby until the next game starts. */
  lastGame: GameSummary | null;
  /** Game sim: how many bonuses this game has used so far (the next one to play is at this index). */
  bonusesUsed: number;
  /** How many games this room has finished. */
  games: number;
  /** Bumped on every change so listeners can ignore stale deliveries. */
  version: number;
}

export interface BonusInfo { index: number; wordCount: number; partCount: number }

export type RoomEvent =
  | {
    type: 'start'; at: number; mode: RoomMode; total: number; wordsPerSecond: number;
    teamOf: Record<string, string>; captains: Record<string, string>; scoring: Scoring;
    /** The first tossup's length (tossup and sim modes). */
    wordCount: number;
    /** The first bonus (bonus drill). */
    bonus?: BonusInfo;
  }
  | { type: 'buzz'; uid: string; at: number }
  | { type: 'resolve'; at: number; answerMs: number }
  | { type: 'answer'; uid: string; at: number; typed: string; verdict: 'correct' | 'wrong' }
  | { type: 'timeout'; at: number }
  /** Next round. `wordCount` is the next tossup's length; `bonus` is the bonus that comes next (sim: after a correct tossup). */
  | { type: 'next'; at: number; wordCount: number; bonus?: BonusInfo }
  | { type: 'bonusOpen'; at: number; answerMs: number }
  | { type: 'bonusSubmit'; at: number; team: string; by: string; answers: string[]; verdicts: boolean[] }
  | { type: 'bonusClose'; at: number; entries: { team: string; answers: string[]; verdicts: boolean[] }[] }
  | { type: 'end' };

export function initialRoomState(): RoomState {
  return {
    phase: 'lobby', mode: 'tossup', q: 0, total: 0, wordCount: 0, readFrom: 0, readStartAt: 0, wordsPerSecond: 3.3, endAt: 0,
    pending: [], buzzer: null, answerDeadline: null, frozenWords: 0, lockedOut: [], teamOf: {}, captains: {},
    scoring: { correct: 3, wrong: -1, bonusPart: 5 }, teamScores: {}, playerScores: {}, last: null, bonus: null,
    lastGame: null, bonusesUsed: 0, games: 0, version: 0,
  };
}

/** Words showing at server time `t` while a tossup is being read. */
export function wordsShown(s: RoomState, t: number): number {
  if (s.phase === 'reading') {
    const elapsed = Math.max(0, t - s.readStartAt) / 1000;
    return Math.min(s.wordCount, s.readFrom + Math.floor(elapsed * s.wordsPerSecond));
  }
  if (s.phase === 'answering') return s.frozenWords;
  if (s.phase === 'result') return s.wordCount;
  return 0;
}

/** Words of the bonus showing at server time `t`. */
export function bonusWordsShown(s: RoomState, t: number): number {
  const b = s.bonus;
  if (!b) return 0;
  if (b.open || s.phase === 'bonus_result') return b.wordCount;
  const elapsed = Math.max(0, t - b.readStartAt) / 1000;
  return Math.min(b.wordCount, Math.floor(elapsed * s.wordsPerSecond));
}

/** Server time the bonus has been fully read. */
export function bonusRevealEnd(s: Pick<RoomState, 'wordsPerSecond'>, b: Pick<BonusRound, 'readStartAt' | 'wordCount'>): number {
  return b.readStartAt + Math.ceil((b.wordCount / s.wordsPerSecond) * 1000);
}

/**
 * When the clock that ends this phase fires: reading, the buzz window closes; answering, the answer window closes;
 * bonus, first the reveal ends (teams may type), then the answer window closes.
 */
export function nextDeadline(s: RoomState): number | null {
  if (s.phase === 'reading') return s.endAt;
  if (s.phase === 'answering') return s.answerDeadline;
  if (s.phase === 'bonus' && s.bonus) return s.bonus.open ? s.bonus.answerDeadline : bonusRevealEnd(s, s.bonus);
  return null;
}

/** After the last word the buzz window stays open for `tailMs` (shorter once nobody is left who could buzz). */
function revealEnd(readStartAt: number, readFrom: number, wordCount: number, wps: number, tailMs = BUZZ_WINDOW_MS): number {
  const remaining = Math.max(0, wordCount - readFrom);
  return readStartAt + Math.ceil((remaining / wps) * 1000) + tailMs;
}

const everyoneLockedOut = (s: Pick<RoomState, 'teamOf' | 'lockedOut'>): boolean => Object.keys(s.teamOf).every((p) => s.lockedOut.includes(p));

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

/**
 * The answerer failed (wrong or pass): lock them out and resume the reveal from where it stopped. The reading carries on
 * even when nobody is left to buzz, so the rest of the question is read before it ends.
 */
function afterMiss(s: RoomState, uid: string, kind: 'wrong' | 'pass', typed: string | undefined, at: number): RoomState {
  const scored = award(s, uid, kind);
  const lockedOut = [...s.lockedOut, uid];
  const base: RoomState = {
    ...s, ...scored, lockedOut, buzzer: null, answerDeadline: null, pending: [],
    last: { kind, uid, typed, points: scored.points },
  };
  const tail = everyoneLockedOut({ teamOf: s.teamOf, lockedOut }) ? ALL_OUT_TAIL_MS : BUZZ_WINDOW_MS;
  return bump({
    ...base, phase: 'reading', readFrom: s.frozenWords, readStartAt: at + RESUME_DELAY_MS,
    endAt: revealEnd(at + RESUME_DELAY_MS, s.frozenWords, s.wordCount, s.wordsPerSecond, tail),
  });
}

const teamsOf = (teamOf: Record<string, string>): string[] => [...new Set(Object.values(teamOf))].sort();

function newBonus(info: BonusInfo, teams: string[], at: number): BonusRound {
  return {
    index: info.index, teams, partCount: info.partCount, wordCount: info.wordCount, readStartAt: at + LEAD_IN_MS,
    open: false, answerDeadline: null, submitted: [], results: {},
  };
}

/** The game is over: back to the lobby, keeping the scores for the lobby to show. */
function finish(s: RoomState): RoomState {
  const lastGame: GameSummary = {
    mode: s.mode, rounds: Math.min(s.total, s.q + 1), teamOf: s.teamOf, teamScores: s.teamScores, playerScores: s.playerScores,
  };
  return { ...initialRoomState(), wordsPerSecond: s.wordsPerSecond, lastGame, games: s.games + 1, version: s.version + 1 };
}

function nextTossup(s: RoomState, e: Extract<RoomEvent, { type: 'next' }>): RoomState {
  if (s.q + 1 >= s.total) return finish(s);
  const readStartAt = e.at + LEAD_IN_MS;
  return bump({
    ...s, phase: 'reading', q: s.q + 1, wordCount: e.wordCount, readFrom: 0, readStartAt,
    endAt: revealEnd(readStartAt, 0, e.wordCount, s.wordsPerSecond),
    pending: [], buzzer: null, answerDeadline: null, frozenWords: 0, lockedOut: [], last: null, bonus: null,
  });
}

function recordBonus(s: RoomState, b: BonusRound, team: string, by: string | null, answers: string[], verdicts: boolean[]): RoomState {
  const points = verdicts.filter(Boolean).length * s.scoring.bonusPart;
  const nextB: BonusRound = {
    ...b, submitted: [...b.submitted, team], results: { ...b.results, [team]: { answers, verdicts, points, by } },
  };
  const teamScores = { ...s.teamScores, [team]: (s.teamScores[team] ?? 0) + points };
  const allIn = b.teams.every((t) => nextB.submitted.includes(t));
  return bump({ ...s, teamScores, bonus: nextB, phase: allIn ? 'bonus_result' : 'bonus' });
}

export function reduceRoom(s: RoomState, e: RoomEvent): RoomState {
  switch (e.type) {
    case 'start': {
      if (s.phase !== 'lobby') return s;
      const base: RoomState = {
        ...initialRoomState(), version: s.version, games: s.games, lastGame: s.lastGame,
        mode: e.mode, total: e.total, wordsPerSecond: e.wordsPerSecond, teamOf: e.teamOf, captains: e.captains, scoring: e.scoring,
      };
      if (e.mode === 'bonus') {
        if (!e.bonus) return s;
        return bump({ ...base, phase: 'bonus', q: 0, bonus: newBonus(e.bonus, teamsOf(e.teamOf), e.at) });
      }
      const readStartAt = e.at + LEAD_IN_MS;
      return bump({
        ...base, phase: 'reading', q: 0, wordCount: e.wordCount, readFrom: 0, readStartAt,
        endAt: revealEnd(readStartAt, 0, e.wordCount, e.wordsPerSecond),
      });
    }
    case 'buzz': {
      if (s.phase !== 'reading') return s;
      // Buzzes stamped before the reading opens are ignored, so nobody gains from seeing a restart first.
      if (e.at < s.readStartAt - EARLY_BUZZ_MS) return s;
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
      // Buzzing is a commitment: a blank answer is a miss like any other wrong answer.
      return afterMiss(s, e.uid, 'wrong', e.typed, e.at);
    }
    case 'timeout': {
      if (s.phase === 'answering' && s.answerDeadline !== null && e.at >= s.answerDeadline && s.buzzer) {
        return afterMiss(s, s.buzzer, 'wrong', '', e.at);
      }
      if (s.phase === 'reading' && s.pending.length === 0 && e.at >= s.endAt) {
        // Nobody left to buzz keeps the last miss as the outcome; otherwise nobody buzzed at all.
        return bump({ ...s, phase: 'result', last: everyoneLockedOut(s) && s.last ? s.last : { kind: 'nobody', points: 0 } });
      }
      return s;
    }
    case 'next': {
      if (s.phase === 'result') {
        // Game sim: the team that got the tossup gets the next bonus.
        if (s.mode === 'sim' && s.last?.kind === 'correct' && s.last.uid && e.bonus) {
          const team = s.teamOf[s.last.uid] ?? s.last.uid;
          return bump({ ...s, phase: 'bonus', bonus: newBonus(e.bonus, [team], e.at), bonusesUsed: s.bonusesUsed + 1, pending: [], buzzer: null, answerDeadline: null });
        }
        return nextTossup(s, e);
      }
      if (s.phase === 'bonus_result') {
        if (s.mode === 'bonus') {
          if (s.q + 1 >= s.total || !e.bonus) return finish(s);
          return bump({ ...s, phase: 'bonus', q: s.q + 1, bonus: newBonus(e.bonus, teamsOf(s.teamOf), e.at) });
        }
        return nextTossup(s, e);
      }
      return s;
    }
    case 'bonusOpen': {
      if (s.phase !== 'bonus' || !s.bonus || s.bonus.open) return s;
      return bump({ ...s, bonus: { ...s.bonus, open: true, answerDeadline: e.at + e.answerMs } });
    }
    case 'bonusSubmit': {
      const b = s.bonus;
      if (s.phase !== 'bonus' || !b || !b.open) return s;
      if (!b.teams.includes(e.team) || b.submitted.includes(e.team)) return s;
      if (s.captains[e.team] !== e.by) return s; // only the captain may submit
      return recordBonus(s, b, e.team, e.by, e.answers, e.verdicts);
    }
    case 'bonusClose': {
      const b = s.bonus;
      if (s.phase !== 'bonus' || !b || !b.open || b.answerDeadline === null || e.at < b.answerDeadline) return s;
      let next = s;
      for (const t of b.teams) {
        if (next.bonus?.submitted.includes(t)) continue;
        const entry = e.entries.find((x) => x.team === t);
        next = recordBonus(next, next.bonus as BonusRound, t, null, entry?.answers ?? [], entry?.verdicts ?? []);
      }
      return next.phase === 'bonus' ? bump({ ...next, phase: 'bonus_result' }) : next;
    }
    case 'end':
      return s.phase === 'lobby' ? s : finish(s);
  }
}

/** Teams ranked by score, highest first. */
export function rankTeams(s: Pick<RoomState, 'teamOf' | 'teamScores'>): { team: string; points: number }[] {
  const teams = new Set([...Object.values(s.teamOf), ...Object.keys(s.teamScores)]);
  return [...teams].map((team) => ({ team, points: s.teamScores[team] ?? 0 })).sort((a, b) => b.points - a.points || (a.team < b.team ? -1 : 1));
}

/**
 * Identifies one uninterrupted stretch of reveal: the question number plus how many players have already been locked
 * out. Buzzes and answers are filed under it, so a player whose buzz was too late can buzz again once the reveal resumes.
 * The characters are all valid in a database key.
 */
export function segmentOf(s: Pick<RoomState, 'q' | 'lockedOut' | 'games'>): string {
  return `${gamePrefix(s)}q${s.q}_${s.lockedOut.length}`;
}

/** Every game in a room files its buzzes and answers under its own prefix, so one game never reads the last game's leftovers. */
const gamePrefix = (s: Pick<RoomState, 'games'>): string => (s.games > 0 ? `g${s.games}_` : '');

/** The question number as filed in the database (with the game prefix). */
export function roundKey(s: Pick<RoomState, 'q' | 'games'>): string {
  return `${gamePrefix(s)}${s.q}`;
}

/** Key a bonus's drafts and submissions are filed under: one per round. */
export function bonusKeyOf(s: Pick<RoomState, 'q' | 'games'>): string {
  return `${gamePrefix(s)}b${s.q}`;
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
  const obj = <T,>(v: unknown): Record<string, T> => (v && typeof v === 'object' ? (v as Record<string, T>) : {});
  const bonusRaw = r.bonus as (Partial<BonusRound> & Record<string, unknown>) | null | undefined;
  const bonus: BonusRound | null = bonusRaw && typeof bonusRaw === 'object'
    ? {
      index: Number(bonusRaw.index ?? 0), teams: list<string>(bonusRaw.teams), partCount: Number(bonusRaw.partCount ?? 0),
      wordCount: Number(bonusRaw.wordCount ?? 0), readStartAt: Number(bonusRaw.readStartAt ?? 0), open: bonusRaw.open === true,
      answerDeadline: (bonusRaw.answerDeadline as number | null | undefined) ?? null, submitted: list<string>(bonusRaw.submitted),
      results: Object.fromEntries(Object.entries(obj<Partial<BonusTeamResult>>(bonusRaw.results)).map(([t, v]) => [t, {
        answers: list<string>(v.answers), verdicts: list<boolean>(v.verdicts), points: Number(v.points ?? 0), by: (v.by as string | null | undefined) ?? null,
      }])),
    }
    : null;
  const lastRaw = r.lastGame as (Partial<GameSummary> & Record<string, unknown>) | null | undefined;
  const lastGame: GameSummary | null = lastRaw && typeof lastRaw === 'object'
    ? {
      mode: (lastRaw.mode as RoomMode | undefined) ?? 'tossup', rounds: Number(lastRaw.rounds ?? 0), teamOf: obj<string>(lastRaw.teamOf),
      teamScores: obj<number>(lastRaw.teamScores), playerScores: obj<PlayerScore>(lastRaw.playerScores),
    }
    : null;
  return {
    ...base,
    ...r,
    pending: list<{ uid: string; at: number }>(r.pending),
    lockedOut: list<string>(r.lockedOut),
    teamOf: obj<string>(r.teamOf),
    captains: obj<string>(r.captains),
    scoring: { ...base.scoring, ...(r.scoring as Partial<Scoring> | undefined) },
    teamScores: obj<number>(r.teamScores),
    playerScores: obj<PlayerScore>(r.playerScores),
    buzzer: (r.buzzer as string | null | undefined) ?? null,
    answerDeadline: (r.answerDeadline as number | null | undefined) ?? null,
    last: (r.last as Outcome | null | undefined) ?? null,
    bonus,
    lastGame,
    bonusesUsed: Number(r.bonusesUsed ?? 0),
    games: Number(r.games ?? 0),
  };
}
