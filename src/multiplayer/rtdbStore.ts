// RoomStore on Firebase Realtime Database. Loaded only when rooms are used and the database is configured.
// Uses its own Firebase app instance so the anonymous sign-in never touches the admin email/password session.

import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getDatabase, onValue, ref, remove, set } from 'firebase/database';
import type { RoomStore, Unsubscribe } from './store';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string,
};

export async function createRealtimeStore(): Promise<RoomStore> {
  const app = initializeApp(config, 'rooms');
  const auth = getAuth(app);
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
    set: (path, value) => set(ref(db, path), value as never),
    remove: (path) => remove(ref(db, path)),
    onValue(path, cb): Unsubscribe {
      return onValue(ref(db, path), (snap) => cb(snap.val()));
    },
  };
}
