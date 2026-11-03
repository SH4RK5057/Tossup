import { z } from 'zod';
import { DEFAULT_RULESET, getRuleset } from '../core/rulesets';
import type { SessionSummary } from '../core/stats';
import { levelSchema, rulesetIdSchema } from '../core/types';

/**
 * Small key-value storage interface. Today it is backed by localStorage; roadmap item 15
 * swaps in a cloud-synced implementation behind the same interface.
 */
export interface KeyValueStorage {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

/** localStorage-backed storage. Every read and write is wrapped in try/catch. */
export const localStore: KeyValueStorage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable or full: ignore */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

// ---------------------------------------------------------------- settings

const ncalDefaults = getRuleset(DEFAULT_RULESET);

export const settingsSchema = z.object({
  ruleset: rulesetIdSchema.default(DEFAULT_RULESET),
  levels: z.array(levelSchema).min(1).default(['novice']),
  /** NCAL cumulative pools: also draw a share from levels below the selection. */
  cumulative: z.boolean().default(true),
  tossupSeconds: z.number().min(3).max(300).default(ncalDefaults.tossupSeconds),
  tossupUntimed: z.boolean().default(false),
  bonusSeconds: z.number().min(3).max(600).default(ncalDefaults.bonus.defaultSeconds),
  bonusUntimed: z.boolean().default(false),
  bonusesOn: z.boolean().default(true),
  subjects: z.array(z.string()).default([]),
  fullDistribution: z.boolean().default(false),
  simLength: z.enum(['count', 'match']).default('count'),
  simCount: z.number().int().min(1).max(200).default(10),
  theme: z.enum(['auto', 'light', 'dark']).default('auto'),
});
export type Settings = z.infer<typeof settingsSchema>;

const SETTINGS_KEY = 'tossup.settings.v1';
const STATS_KEY = 'tossup.stats.v1';
const MAX_STORED_SESSIONS = 500;

export function loadSettings(store: KeyValueStorage = localStore): Settings {
  const raw = store.get<Record<string, unknown>>(SETTINGS_KEY, {});
  // Older saves stored a single `level`.
  if (raw && typeof raw === 'object' && !raw.levels && typeof raw.level === 'string') raw.levels = [raw.level];
  const parsed = settingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : settingsSchema.parse({});
}

export function saveSettings(settings: Settings, store: KeyValueStorage = localStore): void {
  store.set(SETTINGS_KEY, settings);
}

// -------------------------------------------------------------------- stats

export function loadSessions(store: KeyValueStorage = localStore): SessionSummary[] {
  const raw = store.get<unknown>(STATS_KEY, []);
  return Array.isArray(raw) ? (raw as SessionSummary[]) : [];
}

export function saveSession(summary: SessionSummary, store: KeyValueStorage = localStore): void {
  const all = [...loadSessions(store), summary].slice(-MAX_STORED_SESSIONS);
  store.set(STATS_KEY, all);
}

export function clearSessions(store: KeyValueStorage = localStore): void {
  store.remove(STATS_KEY);
}
