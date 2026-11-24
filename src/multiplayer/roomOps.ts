// Things both the Practice screen (hosting and joining) and the room view need: remembering your name and which room
// this tab is in, reading a value once, and adding yourself to a lobby.

import { writePlayer, type RoomPlayer } from './host';
import { TEAM_IDS, type RoomSettings } from './questions';
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
