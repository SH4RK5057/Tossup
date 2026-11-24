// Things both the Practice screen (hosting and joining) and the room view need: remembering your name and which room
// this tab is in, reading a value once, and adding yourself to a lobby.

import { PACE_MULTIPLIER, PACES } from '../core/clock';
import { getRuleset } from '../core/rulesets';
import type { Question } from '../core/types';
import type { Settings } from '../storage/storage';
import { writePlayer, type RoomPlayer } from './host';
import { buildRoomBonuses, buildRoomQuestions, poolSignature, TEAM_IDS, type RoomSettings } from './questions';
import { makeRoomCode, roomPath, SERVER_TIME, type RoomStore } from './store';


export interface Meta { hostUid: string; createdAt: number; settings: RoomSettings }

export const MAX_PLAYERS = 30;
const NAME_KEY = 'tossup.room.name';
const ROOM_KEY = 'tossup.room.active';

const read = (k: string) => { try { return window.localStorage.getItem(k) ?? ''; } catch { return ''; } };
const write = (k: string, v: string) => { try { window.localStorage.setItem(k, v); } catch { /* ignore */ } };
// The room you are in is remembered per tab (a reload keeps you in it; a new tab starts fresh).
const readTab = (k: string) => { try { return window.sessionStorage.getItem(k) ?? ''; } catch { return ''; } };
const writeTab = (k: string, v: string) => { try { window.sessionStorage.setItem(k, v); } catch { /* ignore */ } };

export const savedName = () => read(NAME_KEY);
export const saveName = (n: string) => write(NAME_KEY, n);
/** The room this tab is in, or null. */
export const activeRoomCode = (): string | null => readTab(ROOM_KEY) || null;
export const setActiveRoom = (code: string | null) => writeTab(ROOM_KEY, code ?? '');

/** Reads a path once. */
export function readOnce(store: RoomStore, path: string): Promise<unknown> {
  return new Promise((resolve) => {
    let off: (() => void) | null = null;
    let done = false;
    off = store.onValue(path, (v) => {
      if (done) return;
      done = true;
      resolve(v);
      queueMicrotask(() => off?.());
    });
  });
}

/** Adds this device to a room's lobby on the smallest team. Returns an error message, or null on success. */
export async function joinAsPlayer(store: RoomStore, code: string, meta: Meta, name: string): Promise<string | null> {
  const players = ((await readOnce(store, roomPath(code, 'players'))) as Record<string, RoomPlayer> | null) ?? {};
  if (players[store.uid]) return null;
  if (Object.keys(players).length >= MAX_PLAYERS) return `That room is full (${MAX_PLAYERS} players).`;
  const counts = new Map<string, number>(TEAM_IDS.slice(0, meta.settings.teamCount).map((t) => [t, 0]));
  for (const p of Object.values(players)) counts.set(p.team, (counts.get(p.team) ?? 0) + 1);
  const team = [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
  await writePlayer(store, code, name, team);
  return null;
}

/** Creates a room with a fresh code, with you as the host and first player. Returns the code. */
export async function createRoom(store: RoomStore, settings: RoomSettings, name: string): Promise<string> {
  let code = makeRoomCode();
  for (let i = 0; i < 20 && (await readOnce(store, roomPath(code, 'meta'))) !== null; i++) code = makeRoomCode();
  await store.set(roomPath(code, 'meta'), { hostUid: store.uid, createdAt: SERVER_TIME, settings });
  await writePlayer(store, code, name, 'A');
  return code;
}

// ------------------------------------------------------------------ settings <-> a room's settings

/** The most questions an "unlimited" room can run (it stops earlier if the question pool runs out). */
export const UNLIMITED_CAP = 400;

/**
 * Turns the app's settings (the same ones solo practice uses, plus the room options) into the settings a room runs
 * on. Bonuses in a room are answered all parts at once, so a ruleset that asks one part at a time is tossups only.
 */
export function makeRoomSettings(s: Settings, pool: Question[], fresh: { seed: string; nowIso: string }): RoomSettings {
  const rs = getRuleset(s.ruleset);
  const unlimited = s.roomQuestions === 0;
  return {
    mode: rs.bonus.timing === 'together' ? s.roomMode : 'tossup',
    rulesetId: rs.id,
    level: s.level,
    subjects: s.fullDistribution ? [] : s.subjects,
    fullDistribution: s.fullDistribution,
    difficulties: s.difficulties,
    answerMode: s.tossupTiming === 'scaled' ? 'scaled' : 'flat',
    pace: PACE_MULTIPLIER[s.tossupPace],
    flatSeconds: s.tossupSeconds,
    bonusMode: s.bonusTiming === 'scaled' ? 'scaled' : 'flat',
    bonusFlatSeconds: s.bonusSeconds,
    wordsPerSecond: s.roomSpeed,
    teamMode: s.roomTeamMode,
    teamCount: s.roomTeams,
    questions: unlimited ? UNLIMITED_CAP : s.roomQuestions,
    unlimited,
    seed: fresh.seed,
    nowIso: fresh.nowIso,
    bankSig: poolSignature(pool),
  };
}

/** The other way: what the settings panels should show for a room that already exists. */
export function roomToSettings(r: RoomSettings, base: Settings): Settings {
  const pace = PACES.reduce((best, p) => (Math.abs(PACE_MULTIPLIER[p] - r.pace) < Math.abs(PACE_MULTIPLIER[best] - r.pace) ? p : best), PACES[0]);
  return {
    ...base,
    ruleset: r.rulesetId,
    level: r.level,
    subjects: r.subjects,
    fullDistribution: r.fullDistribution,
    difficulties: r.difficulties.length ? r.difficulties : base.difficulties,
    tossupTiming: r.answerMode === 'scaled' ? 'scaled' : 'fixed',
    tossupPace: pace,
    tossupSeconds: r.flatSeconds,
    bonusTiming: r.bonusMode === 'scaled' ? 'scaled' : 'fixed',
    bonusSeconds: r.bonusFlatSeconds,
    roomMode: r.mode,
    roomTeamMode: r.teamMode,
    roomTeams: r.teamCount,
    roomSpeed: r.wordsPerSecond,
    roomQuestions: r.unlimited ? 0 : r.questions,
  };
}

/** Why a room's settings cannot run (no matching questions), or null when they can. */
export function questionProblem(pool: Question[], room: RoomSettings): string | null {
  const noTossups = room.mode !== 'bonus' && buildRoomQuestions(pool, room).length === 0;
  const noBonuses = room.mode !== 'tossup' && buildRoomBonuses(pool, room).length === 0;
  return noTossups || noBonuses ? `No ${noTossups ? 'tossups' : 'bonuses'} match those settings. Try other subjects, difficulty or level.` : null;
}

/**
 * When the number of teams is lowered, players on a team that no longer exists move to the smallest remaining team.
 * Returns the new team for each player who has to move.
 */
export function reassignTeams(players: Record<string, RoomPlayer>, teamCount: number): Record<string, string> {
  const teams = TEAM_IDS.slice(0, teamCount);
  const counts = new Map<string, number>(teams.map((t) => [t, 0]));
  const stray: string[] = [];
  for (const [uid, p] of Object.entries(players).sort((a, b) => a[1].joinedAt - b[1].joinedAt)) {
    if (counts.has(p.team)) counts.set(p.team, (counts.get(p.team) ?? 0) + 1);
    else stray.push(uid);
  }
  const moves: Record<string, string> = {};
  for (const uid of stray) {
    const team = [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
    counts.set(team, (counts.get(team) ?? 0) + 1);
    moves[uid] = team;
  }
  return moves;
}
