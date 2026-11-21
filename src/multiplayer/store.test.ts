import { describe, expect, it } from 'vitest';
import { LocalRoomStore, MemoryHub } from './localStore';
import { getAt, makeRoomCode, normalizeRoomCode, resolveServerTime, roomPath, setAt, SERVER_TIME } from './store';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('tree helpers', () => {
  it('sets, reads and removes nested values', () => {
    let t = setAt({}, 'rooms/ABCD/meta/host', 'u1');
    t = setAt(t, 'rooms/ABCD/players/u1', { name: 'Sam' });
    expect(getAt(t, 'rooms/ABCD/meta/host')).toBe('u1');
    expect(getAt(t, 'rooms/ABCD/players/u1/name')).toBe('Sam');
    expect(getAt(t, 'rooms/ZZZZ')).toBeNull();
    t = setAt(t, 'rooms/ABCD/players/u1', null);
    expect(getAt(t, 'rooms/ABCD/players')).toBeNull(); // empty parents are pruned
    expect(getAt(t, 'rooms/ABCD/meta/host')).toBe('u1');
  });
  it('does not change the original tree', () => {
    const a = setAt({}, 'x/y', 1);
    setAt(a, 'x/y', 2);
    expect(getAt(a, 'x/y')).toBe(1);
  });
  it('resolves server-time placeholders anywhere in a value', () => {
    expect(resolveServerTime({ a: SERVER_TIME, b: [SERVER_TIME, 5] }, 42)).toEqual({ a: 42, b: [42, 5] });
  });
});

describe('room codes', () => {
  it('makes four-letter codes without confusing characters', () => {
    for (let i = 0; i < 50; i++) expect(makeRoomCode()).toMatch(/^[A-HJ-NP-Z]{4}$/);
  });
  it('cleans up typed codes', () => {
    expect(normalizeRoomCode(' ab-c d9e ')).toBe('ABCD');
  });
  it('builds room paths', () => {
    expect(roomPath('ABCD', 'state')).toBe('rooms/ABCD/state');
  });
});

describe('LocalRoomStore', () => {
  it('shares writes between stores and tells listeners', async () => {
    const hub = new MemoryHub();
    const host = new LocalRoomStore('host', hub);
    const guest = new LocalRoomStore('guest', hub);
    const seen: unknown[] = [];
    guest.onValue('rooms/ABCD/state', (v) => seen.push(v));
    await tick();
    expect(seen).toEqual([null]);
    await host.set('rooms/ABCD/state', { phase: 'lobby' });
    expect(seen).toEqual([null, { phase: 'lobby' }]);
    await host.set('rooms/ABCD/state', { phase: 'lobby' }); // unchanged: no repeat delivery
    expect(seen).toHaveLength(2);
  });
  it('stamps server time on writes', async () => {
    const hub = new MemoryHub();
    const s = new LocalRoomStore('u', hub, () => 1234);
    await s.set('rooms/ABCD/buzz/0/u', SERVER_TIME);
    expect(getAt(hub.read(), 'rooms/ABCD/buzz/0/u')).toBe(1234);
  });
  it('stops delivering after unsubscribe and supports remove', async () => {
    const hub = new MemoryHub();
    const a = new LocalRoomStore('a', hub);
    const b = new LocalRoomStore('b', hub);
    const seen: unknown[] = [];
    const off = b.onValue('rooms/ABCD/x', (v) => seen.push(v));
    await a.set('rooms/ABCD/x', 1);
    off();
    await a.set('rooms/ABCD/x', 2);
    expect(seen.at(-1)).toBe(1);
    await a.remove('rooms/ABCD/x');
    expect(getAt(hub.read(), 'rooms/ABCD/x')).toBeNull();
  });
});

describe('empty values behave like Realtime Database', () => {
  it('does not keep empty lists or empty objects', () => {
    const t = setAt({}, 'rooms/ABCD/meta', { settings: { subjects: [], level: 'jv', extra: {} } });
    expect(getAt(t, 'rooms/ABCD/meta/settings/subjects')).toBeNull();
    expect(getAt(t, 'rooms/ABCD/meta/settings/extra')).toBeNull();
    expect(getAt(t, 'rooms/ABCD/meta/settings/level')).toBe('jv');
  });
});
