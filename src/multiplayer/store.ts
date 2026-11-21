// The tiny storage interface rooms run on. Two implementations: LocalRoomStore (two tabs of one browser, for trying it
// out and for tests) and RealtimeDbStore (Firebase Realtime Database, for real play). Everything else in the multiplayer
// code talks only to this interface.

/** Placeholder for "the server's current time", resolved when the value is written. Same shape Firebase uses. */
export const SERVER_TIME = { '.sv': 'timestamp' } as const;

export type Unsubscribe = () => void;

export interface RoomStore {
  /** 'network' = Firebase; 'local' = this browser only. */
  readonly kind: 'network' | 'local';
  /** This device's user id. */
  readonly uid: string;
  /** Server-synced time in milliseconds. */
  now(): number;
  /** Replaces the value at a path (null removes it). Values may contain SERVER_TIME. */
  set(path: string, value: unknown): Promise<void>;
  remove(path: string): Promise<void>;
  /** Calls back with the current value at a path (null if none) now and on every change. */
  onValue(path: string, cb: (value: unknown) => void): Unsubscribe;
}

export const roomPath = (code: string, ...rest: string[]) => ['rooms', code, ...rest].join('/');

// ----------------------------------------------------------------- room codes

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O (they look like 1 and 0)

export function makeRoomCode(rand: () => number = Math.random, length = 4): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_LETTERS[Math.floor(rand() * CODE_LETTERS.length)];
  return out;
}

/** Cleans up a typed room code: letters only, upper case, at most 4 characters. */
export function normalizeRoomCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
}

// ----------------------------------------------------------------- tree helpers

export type Tree = { [key: string]: unknown };

const parts = (path: string) => path.split('/').filter(Boolean);

export function getAt(tree: Tree, path: string): unknown {
  let cur: unknown = tree;
  for (const p of parts(path)) {
    if (cur === null || typeof cur !== 'object') return null;
    cur = (cur as Tree)[p];
    if (cur === undefined) return null;
  }
  return cur ?? null;
}

/** Returns a copy of the tree with the value at the path replaced (null removes it and empty parents). */
export function setAt(tree: Tree, path: string, value: unknown): Tree {
  const ps = parts(path);
  if (ps.length === 0) return value && typeof value === 'object' ? (value as Tree) : {};
  const root: Tree = { ...tree };
  let cur = root;
  for (let i = 0; i < ps.length - 1; i++) {
    const child = cur[ps[i]];
    const copy: Tree = child && typeof child === 'object' ? { ...(child as Tree) } : {};
    cur[ps[i]] = copy;
    cur = copy;
  }
  const last = ps[ps.length - 1];
  if (value === null || value === undefined) delete cur[last];
  else cur[last] = value;
  return prune(root);
}

function prune(tree: Tree): Tree {
  const out: Tree = {};
  for (const [k, v] of Object.entries(tree)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const p = prune(v as Tree);
      if (Object.keys(p).length > 0) out[k] = p;
    } else if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/** Replaces every SERVER_TIME placeholder in a value with the given time. */
export function resolveServerTime(value: unknown, now: number): unknown {
  if (value && typeof value === 'object') {
    if ((value as Tree)['.sv'] === 'timestamp') return now;
    if (Array.isArray(value)) return value.map((v) => resolveServerTime(v, now));
    return Object.fromEntries(Object.entries(value as Tree).map(([k, v]) => [k, resolveServerTime(v, now)]));
  }
  return value;
}
