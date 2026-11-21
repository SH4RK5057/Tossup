// A RoomStore that lives in one browser: open the app in two tabs and they act as two players. Used to try rooms out
// without any Firebase setup, and in tests.

import { getAt, resolveServerTime, setAt, type RoomStore, type Tree, type Unsubscribe } from './store';

/** Where the shared tree lives. Every LocalRoomStore on the same hub sees the same data. */
export interface Hub {
  read(): Tree;
  write(tree: Tree): void;
  /** Called when ANOTHER store or tab changed the tree. */
  onExternalChange(cb: () => void): Unsubscribe;
}

/** In-memory hub shared by stores in one process (tests). */
export class MemoryHub implements Hub {
  private tree: Tree = {};
  private subs = new Set<{ cb: () => void; owner: unknown }>();
  /** The store currently writing, so it is not told about its own change. */
  current: unknown = null;
  read() { return this.tree; }
  write(tree: Tree) {
    this.tree = tree;
    for (const s of [...this.subs]) if (s.owner !== this.current) s.cb();
  }
  onExternalChange(cb: () => void, owner: unknown = null): Unsubscribe {
    const sub = { cb, owner };
    this.subs.add(sub);
    return () => this.subs.delete(sub);
  }
}

const STORAGE_KEY = 'tossup.rooms.local';

/** localStorage hub: other tabs hear about changes through the browser's "storage" event. */
export class StorageHub implements Hub {
  read(): Tree {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Tree) : {};
    } catch {
      return {};
    }
  }
  write(tree: Tree) {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tree)); } catch { /* storage unavailable */ }
  }
  onExternalChange(cb: () => void): Unsubscribe {
    const handler = (e: StorageEvent) => { if (e.key === STORAGE_KEY) cb(); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
}

interface Listener { path: string; cb: (v: unknown) => void; last: string | undefined }

export class LocalRoomStore implements RoomStore {
  readonly kind = 'local' as const;
  private listeners = new Set<Listener>();

  constructor(readonly uid: string, private hub: Hub = new StorageHub(), private clock: () => number = Date.now) {
    const sub = hub instanceof MemoryHub
      ? hub.onExternalChange(() => this.notify(), this)
      : hub.onExternalChange(() => this.notify());
    void sub;
  }

  now() { return this.clock(); }

  async set(path: string, value: unknown) {
    const resolved = resolveServerTime(value, this.now());
    if (this.hub instanceof MemoryHub) this.hub.current = this;
    try { this.hub.write(setAt(this.hub.read(), path, resolved)); } finally { if (this.hub instanceof MemoryHub) this.hub.current = null; }
    this.notify();
  }

  async remove(path: string) { await this.set(path, null); }

  onValue(path: string, cb: (value: unknown) => void): Unsubscribe {
    const l: Listener = { path, cb, last: undefined };
    this.listeners.add(l);
    // First delivery is asynchronous, like a network read.
    queueMicrotask(() => { if (this.listeners.has(l)) this.deliver(l); });
    return () => this.listeners.delete(l);
  }

  private deliver(l: Listener) {
    const value = getAt(this.hub.read(), l.path);
    const json = JSON.stringify(value);
    if (json === l.last) return;
    l.last = json;
    l.cb(value);
  }

  private notify() {
    for (const l of [...this.listeners]) if (this.listeners.has(l)) this.deliver(l);
  }
}
