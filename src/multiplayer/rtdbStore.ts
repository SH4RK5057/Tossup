// RoomStore on Firebase Realtime Database. Loaded only when rooms are used and the database is configured.
// Uses its own Firebase app instance so the anonymous sign-in never touches the admin email/password session.

import { initializeApp } from 'firebase/app';
import { browserSessionPersistence, initializeAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getDatabase, onValue, ref, remove, set } from 'firebase/database';
import type { RoomStore, Unsubscribe } from './store';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string,
};

let pending: Promise<RoomStore> | null = null;

/** One store per page: starting it twice (React does in development) would sign in two different anonymous users. */
export function createRealtimeStore(): Promise<RoomStore> {
  pending ??= build().catch((e) => { pending = null; throw e; });
  return pending;
}

async function build(): Promise<RoomStore> {
  const app = initializeApp(config, 'rooms');
  // Session persistence: each browser tab is its own player (a reload keeps you in the room, a new tab is someone new).
  const auth = initializeAuth(app, { persistence: browserSessionPersistence });
  const uid = await new Promise<string>((resolve, reject) => {
    const off = onAuthStateChanged(auth, (u) => {
      if (u) { off(); resolve(u.uid); }
    }, reject);
    if (!auth.currentUser) signInAnonymously(auth).catch(reject);
  });
  const db = getDatabase(app);

  // The difference between this device's clock and the server's, so every screen agrees on "now".
  let offset = 0;
  onValue(ref(db, '.info/serverTimeOffset'), (snap) => { offset = Number(snap.val()) || 0; });

  return {
    kind: 'network',
    uid,
    now: () => Date.now() + offset,
    // A value of { ".sv": "timestamp" } is turned into the server's time by Realtime Database itself.
    // Realtime Database rejects undefined values, so they are stripped first.
    set: (path, value) => set(ref(db, path), (value === undefined ? null : JSON.parse(JSON.stringify(value))) as never),
    remove: (path) => remove(ref(db, path)),
    onValue(path, cb): Unsubscribe {
      return onValue(ref(db, path), (snap) => cb(snap.val()));
    },
  };
}
