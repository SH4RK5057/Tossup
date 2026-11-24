// The game settings in a room's lobby. The host edits them (the same panels as solo practice plus the room options)
// and they save to the room as they change; everyone else sees a read-only summary that updates live.

import { useCallback, useEffect, useRef, useState } from 'react';
import { PACE_LABEL } from '../core/clock';
import { levelsForPool } from '../core/pool';
import type { RoomMode } from '../core/room';
import { getRuleset } from '../core/rulesets';
import { DIFFICULTY_LABEL, LEVEL_LABEL } from '../core/types';
import { loadSettings, type Settings } from '../storage/storage';
import { useApp } from '../ui/context';
import { SettingsPanels } from '../ui/SettingsPanels';
import type { RoomPlayer } from './host';
import { READING_SPEEDS, type RoomSettings } from './questions';
import { RoomOptions } from './RoomOptions';
import { makeRoomSettings, questionProblem, reassignTeams, roomToSettings, type Meta } from './roomOps';
import { roomPath, type RoomStore } from './store';

const MODE_TITLE: Record<RoomMode, string> = { tossup: 'Tossups', bonus: 'Bonus drill', sim: 'Game sim' };
const SAVE_DELAY_MS = 500;

export function LobbySettings({ store, code, meta, players }: { store: RoomStore; code: string; meta: Meta; players: Record<string, RoomPlayer> }) {
  const { repo } = useApp();
  const [draft, setDraft] = useState<Settings>(() => roomToSettings(meta.settings, loadSettings()));
  const [status, setStatus] = useState<{ kind: 'saving' | 'saved' | 'error'; text: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const playersRef = useRef(players);
  playersRef.current = players;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /** Saves the settings to the room with a fresh seed, so everyone (and the host's referee) rebuilds the questions. */
  const apply = useCallback(async (next: Settings) => {
    const mine = ++seq.current;
    setStatus({ kind: 'saving', text: 'Saving…' });
    try {
      const rs = getRuleset(next.ruleset);
      const pool = await repo.loadPool({ rulesetId: rs.id, level: next.level, levels: levelsForPool(rs, next.level) });
      const room = makeRoomSettings(next, pool, { seed: Math.random().toString(36).slice(2), nowIso: new Date().toISOString() });
      const problem = questionProblem(pool, room);
      if (mine !== seq.current) return; // a newer change replaced this one
      if (problem) { setStatus({ kind: 'error', text: `${problem} These settings were not saved.` }); return; }
      await store.set(roomPath(code, 'meta', 'settings'), room);
      if (room.teamMode === 'teams') {
        // Players on a team that no longer exists move to the smallest remaining team.
        for (const [uid, team] of Object.entries(reassignTeams(playersRef.current, room.teamCount))) {
          await store.set(roomPath(code, 'players', uid), { ...playersRef.current[uid], team });
        }
      }
      if (mine === seq.current) setStatus({ kind: 'saved', text: 'Saved. Everyone in the room sees the new settings.' });
    } catch (e) {
      if (mine === seq.current) setStatus({ kind: 'error', text: `Could not save: ${e instanceof Error ? e.message : String(e)}` });
    }
  }, [repo, store, code]);

  const change = (next: Settings) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void apply(next), SAVE_DELAY_MS);
  };

  return (
    <details open className="panel stack">
      <summary style={{ cursor: 'pointer' }}>
        <strong>Game settings</strong>
        <span className="muted small"> · you can change these until you start the game</span>
        {status && <span className={`small ${status.kind === 'error' ? '' : 'muted'}`} style={status.kind === 'error' ? { color: 'var(--bad, #f87171)', marginLeft: 8 } : { marginLeft: 8 }}>{status.text}</span>}
      </summary>
      <div className="stack" style={{ marginTop: 12 }}>
        <RoomOptions settings={draft} onChange={change} />
        <SettingsPanels settings={draft} onChange={change} mode="room" />
      </div>
    </details>
  );
}

/** What everyone but the host sees: the current settings, read-only. */
export function SettingsSummary({ settings: s }: { settings: RoomSettings }) {
  const rs = getRuleset(s.rulesetId);
  const speed = READING_SPEEDS.reduce((best, r) => (Math.abs(r.wordsPerSecond - s.wordsPerSecond) < Math.abs(best.wordsPerSecond - s.wordsPerSecond) ? r : best), READING_SPEEDS[0]);
  const paceName = (Object.entries({ official: 1, relaxed: 1.3, generous: 1.6 }) as [keyof typeof PACE_LABEL, number][])
    .reduce((best, e) => (Math.abs(e[1] - s.pace) < Math.abs(best[1] - s.pace) ? e : best))[0];
  const rows: [string, string][] = [
    ['Mode', MODE_TITLE[s.mode]],
    ['Rules and level', `${rs.shortName} · ${LEVEL_LABEL[s.level]}`],
    ['Difficulty', s.difficulties.map((d) => DIFFICULTY_LABEL[d]).join(', ')],
    ['Subjects', s.fullDistribution ? `Full ${rs.shortName} distribution` : s.subjects.length === 0 ? 'All subjects' : `${s.subjects.length} selected`],
    [s.mode === 'bonus' ? 'Bonuses' : 'Tossups', s.unlimited ? 'Unlimited' : String(s.questions)],
    ['Answer time after buzzing', s.answerMode === 'flat' ? `${s.flatSeconds} seconds` : `Scaled (${PACE_LABEL[paceName]})`],
    ...(s.mode === 'tossup' ? [] : [['Bonus answer time', s.bonusMode === 'flat' ? `${s.bonusFlatSeconds} seconds` : 'Scaled to the answers'] as [string, string]]),
    ['Reading speed', speed.label],
    ['Play as', s.teamMode === 'teams' ? `${s.teamCount} teams` : 'Free for all'],
  ];
  return (
    <details className="panel">
      <summary style={{ cursor: 'pointer' }}><strong>Game settings</strong> <span className="muted small">(the host can change these)</span></summary>
      <dl className="small" style={{ margin: '0.5rem 0 0' }}>
        {rows.map(([k, v]) => <div key={k} className="row" style={{ gap: 8 }}><dt className="muted" style={{ minWidth: 190 }}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>)}
      </dl>
    </details>
  );
}
