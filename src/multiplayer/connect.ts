// Chooses where rooms run: Firebase Realtime Database when it is configured, otherwise a same-browser test store
// (open the page in two tabs and they play each other).

import { LocalRoomStore } from './localStore';
import type { RoomStore } from './store';

export interface Connection {
  store: RoomStore;
  /** Shown on the Rooms screen when it is not the real network. */
  note: string | null;
}

const databaseUrl = (import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined) || '';
const apiKey = (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined) || '';

/** Each browser tab gets its own id for the local test store, so two tabs are two players. */
function tabId(): string {
  try {
    let id = window.sessionStorage.getItem('tossup.room.tabid');
    if (!id) {
      id = `tab-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem('tossup.room.tabid', id);
    }
    return id;
  } catch {
    return `tab-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export const realtimeConfigured = Boolean(databaseUrl && apiKey);

export async function connect(forceLocal: boolean): Promise<Connection> {
  if (realtimeConfigured && !forceLocal) {
    try {
      const { createRealtimeStore } = await import('./rtdbStore');
      return { store: await createRealtimeStore(), note: null };
    } catch (e) {
      return {
        store: new LocalRoomStore(tabId()),
        note: `Could not reach the online rooms service (${e instanceof Error ? e.message : String(e)}). Showing the same-browser test mode instead.`,
      };
    }
  }
  return {
    store: new LocalRoomStore(tabId()),
    note: realtimeConfigured
      ? 'Test mode: rooms only work between tabs of this browser.'
      : 'Online rooms are not set up yet, so this is test mode: open this page in two tabs of the same browser and they can play each other.',
  };
}
