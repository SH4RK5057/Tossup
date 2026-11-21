import { z } from 'zod';
import { PACES } from '../core/clock';
import type { Deck } from '../core/deck';
import { DEFAULT_RULESET, getRuleset } from '../core/rulesets';
import type { SessionSummary } from '../core/stats';
import { levelSchema, partDifficultySchema, rulesetIdSchema } from '../core/types';

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
  level: levelSchema.default('novice'),
  /** Which difficulties to practice (multi-select, at least one). */
  difficulties: z.array(partDifficultySchema).min(1).default(['easy', 'medium', 'hard']),
  /** 'scaled': clock follows question length and `tossupPace`; 'fixed': flat `tossupSeconds`. */
  tossupTiming: z.enum(['scaled', 'fixed']).default('scaled'),
  tossupPace: z.enum(PACES).default('official'),
  tossupSeconds: z.number().min(3).max(300).default(ncalDefaults.tossupSeconds),
  tossupUntimed: z.boolean().default(false),
  /** Bonuses shown all at once: 'scaled' follows the bonus length and `tossupPace`; 'fixed' is the flat `bonusSeconds`. */
  bonusTiming: z.enum(['scaled', 'fixed']).default('scaled'),
  bonusSeconds: z.number().min(3).max(600).default(ncalDefaults.bonus.defaultSeconds),
  bonusUntimed: z.boolean().default(false),
  bonusesOn: z.boolean().default(true),
  subjects: z.array(z.string()).default([]),
  fullDistribution: z.boolean().default(false),
  simLength: z.enum(['count', 'match', 'all']).default('count'),
  simCount: z.number().int().min(1).max(200).default(10),
  theme: z.enum(['auto', 'light', 'dark']).default('auto'),
});
export type Settings = z.infer<typeof settingsSchema>;

const SETTINGS_KEY = 'tossup.settings.v1';
const STATS_KEY = 'tossup.stats.v1';
const MAX_STORED_SESSIONS = 500;

export function loadSettings(store: KeyValueStorage = localStore): Settings {
  const parsed = settingsSchema.safeParse(store.get<unknown>(SETTINGS_KEY, {}));
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

// -------------------------------------------------------------- missed deck

const DECK_KEY = 'tossup.deck.v1';
const deckEntrySchema = z.object({
  id: z.string(),
  type: z.enum(['tossup', 'bonus']),
  rulesetId: rulesetIdSchema,
  level: levelSchema,
  category: z.string(),
  subcategory: z.string(),
  box: z.number().int().min(0),
  misses: z.number().int().min(0),
  lastSeen: z.string(),
});

/** Reads the saved missed-question deck, ignoring any entry that does not parse. */
export function loadDeck(store: KeyValueStorage = localStore): Deck {
  const raw = store.get<unknown>(DECK_KEY, {});
  const out: Deck = {};
  if (raw && typeof raw === 'object') {
    for (const v of Object.values(raw as Record<string, unknown>)) {
      const p = deckEntrySchema.safeParse(v);
      if (p.success) out[p.data.id] = p.data;
    }
  }
  return out;
}

export function saveDeck(deck: Deck, store: KeyValueStorage = localStore): void {
  store.set(DECK_KEY, deck);
}

export function clearDeck(store: KeyValueStorage = localStore): void {
  store.remove(DECK_KEY);
}
