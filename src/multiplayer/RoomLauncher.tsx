// Room mode of the Practice screen: host a room or join one. Everything about the questions (ruleset, level,
// difficulty, subjects, answer time) comes from the same settings panels as solo practice; this adds only what
// is specific to a room: your name, teams, reading speed and how many questions.

import { useEffect, useState } from 'react';
import { PACE_MULTIPLIER } from '../core/clock';
import { levelsForPool } from '../core/pool';
import { getRuleset } from '../core/rulesets';
import { navigate, useApp } from '../ui/context';
import type { Settings } from '../storage/storage';
import { connect, type Connection } from './connect';
import {
  buildRoomBonuses, buildRoomQuestions, poolSignature, READING_SPEEDS, type RoomSettings,
} from './questions';
import { createRoom, joinAsPlayer, readOnce, savedName, saveName, setActiveRoom, type Meta } from './roomOps';
import { normalizeRoomCode, roomPath } from './store';
import type { RoomMode, RoomState } from '../core/room';

const MODES: { mode: RoomMode; title: string; blurb: string }[] = [
  { mode: 'tossup', title: 'Tossups', blurb: 'Buzz in, one question at a time' },
  { mode: 'bonus', title: 'Bonus drill', blurb: 'Every team answers the same bonus' },
  { mode: 'sim', title: 'Game sim', blurb: 'Tossup, then the bonus goes to the team that got it' },
];

/** The most questions an "unlimited" room can run (it stops earlier if the question pool runs out). */
const UNLIMITED_CAP = 400;

export default function RoomLauncher({ settings, onChange }: { settings: Settings; onChange: (next: Settings) => void }) {
  const { repo } = useApp();
  const [conn, setConn] = useState<Connection | null>(null);
  const [name, setNameState] = useState(savedName);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const setName = (n: string) => { setNameState(n); saveName(n); };
  const trimmed = name.trim();
  const bonusesOk = getRuleset(settings.ruleset).bonus.timing === 'together';
  const mode: RoomMode = bonusesOk ? settings.roomMode : 'tossup';

  useEffect(() => {
    connect(false).then(setConn, (e) => setError(`Could not connect: ${e instanceof Error ? e.message : String(e)}`));
  }, []);

  const enter = (code: string) => {
    setActiveRoom(code);
    navigate(`/rooms?code=${code}`);
  };

  const host = async () => {
    if (!conn) return;
    if (!trimmed) { setError('Type your name first.'); return; }
    setBusy(true);
    setError(null);
    try {
      const rs = getRuleset(settings.ruleset);
      const pool = await repo.loadPool({ rulesetId: rs.id, level: settings.level, levels: levelsForPool(rs, settings.level) });
      const unlimited = settings.roomQuestions === 0;
      // Bonuses in a room are answered all parts at once; rulesets that ask one part at a time are tossups only here.
      const mode: RoomMode = rs.bonus.timing === 'together' ? settings.roomMode : 'tossup';
      const room: RoomSettings = {
        mode,
        rulesetId: rs.id,
        level: settings.level,
        subjects: settings.fullDistribution ? [] : settings.subjects,
        fullDistribution: settings.fullDistribution,
        difficulties: settings.difficulties,
        answerMode: settings.tossupTiming === 'scaled' ? 'scaled' : 'flat',
        pace: PACE_MULTIPLIER[settings.tossupPace],
        flatSeconds: settings.tossupSeconds,
        bonusMode: settings.bonusTiming === 'scaled' ? 'scaled' : 'flat',
        bonusFlatSeconds: settings.bonusSeconds,
        wordsPerSecond: settings.roomSpeed,
        teamMode: settings.roomTeamMode,
        teamCount: settings.roomTeams,
        questions: unlimited ? UNLIMITED_CAP : settings.roomQuestions,
        unlimited,
        seed: Math.random().toString(36).slice(2),
        nowIso: new Date().toISOString(),
        bankSig: poolSignature(pool),
      };
      const noTossups = mode !== 'bonus' && buildRoomQuestions(pool, room).length === 0;
      const noBonuses = mode !== 'tossup' && buildRoomBonuses(pool, room).length === 0;
      if (noTossups || noBonuses) {
        setError(`No ${noTossups ? 'tossups' : 'bonuses'} match those settings. Try other subjects, difficulty or level.`);
        return;
      }
      enter(await createRoom(conn.store, room, trimmed));
    } catch (e) {
      setError(`Could not create the room: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (!conn) return;
    const code = normalizeRoomCode(joinCode);
    if (!trimmed) { setError('Type your name first.'); return; }
    if (code.length !== 4) { setError('A room code is 4 letters.'); return; }
    setBusy(true);
    setError(null);
    try {
      const meta = (await readOnce(conn.store, roomPath(code, 'meta'))) as Meta | null;
      if (!meta) { setError('No room with that code.'); return; }
      const state = (await readOnce(conn.store, roomPath(code, 'state'))) as RoomState | null;
      // A game already under way cannot take new players; they can still watch.
      if (!state || state.phase === 'lobby') {
        const problem = await joinAsPlayer(conn.store, code, meta, trimmed);
        if (problem) { setError(problem); return; }
      }
      enter(code);
    } catch (e) {
      setError(`Could not join: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error && <div className="notice error">{error}</div>}
      {conn?.note && <div className="notice">{conn.note}</div>}
      <div className="grid-2">
        <section className="panel stack">
          <h2>Host a room</h2>
          <div className="field">
            <span className="lbl">Mode (the same three as solo)</span>
            <div className="row" role="radiogroup" aria-label="Room mode">
              {MODES.map((m) => {
                const off = m.mode !== 'tossup' && !bonusesOk;
                return (
                  <button key={m.mode} role="radio" aria-checked={mode === m.mode} disabled={off} title={off ? 'Bonuses in rooms need a ruleset whose bonuses are answered all at once (NCAL)' : m.blurb}
                    className={mode === m.mode ? 'primary' : ''} onClick={() => set({ roomMode: m.mode })}>{m.title}</button>
                );
              })}
            </div>
            <p className="hint">{MODES.find((m) => m.mode === mode)?.blurb}.{!bonusesOk ? ' Bonus modes are not available for this ruleset in rooms.' : ''}</p>
          </div>
          <label className="field">
            <span className="lbl">Your name</span>
            <input type="text" value={name} maxLength={20} placeholder="Name shown to the room" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="row">
            <label className="field"><span className="lbl">Play as</span>
              <select value={settings.roomTeamMode} onChange={(e) => set({ roomTeamMode: e.target.value as Settings['roomTeamMode'] })}>
                <option value="teams">Teams</option><option value="ffa">Free for all</option></select></label>
            {settings.roomTeamMode === 'teams' && (
              <label className="field"><span className="lbl">Teams</span>
                <select value={settings.roomTeams} onChange={(e) => set({ roomTeams: Number(e.target.value) })}>
                  {[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            )}
            <label className="field"><span className="lbl">{mode === 'bonus' ? 'Bonuses' : 'Tossups'}</span>
              <select value={settings.roomQuestions} onChange={(e) => set({ roomQuestions: Number(e.target.value) })}>
                {[5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                <option value={0}>Unlimited</option></select></label>
            <label className="field"><span className="lbl">Reading speed</span>
              <select value={settings.roomSpeed} onChange={(e) => set({ roomSpeed: Number(e.target.value) })}>
                {READING_SPEEDS.map((r) => <option key={r.label} value={r.wordsPerSecond}>{r.label}</option>)}</select></label>
          </div>
          <div><button className="primary" disabled={busy || !conn} onClick={host}>Host a room</button></div>
          <p className="hint">Uses the settings below: ruleset, level, difficulty, subjects and answer time work exactly as in solo practice.</p>
        </section>
        <section className="panel stack">
          <h2>Join a room</h2>
          <label className="field">
            <span className="lbl">Room code</span>
            <input type="text" value={joinCode} maxLength={4} placeholder="ABCD" style={{ textTransform: 'uppercase', letterSpacing: '0.3em', fontSize: '1.4rem', maxWidth: 160 }}
              onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))} onKeyDown={(e) => { if (e.key === 'Enter') void join(); }} />
          </label>
          <div><button className="primary" disabled={busy || !conn} onClick={join}>Join</button></div>
          <p className="hint">Your name (left) is used when you join. Asking a friend for their room code, or opening the link they send, works too.</p>
        </section>
      </div>
    </>
  );
}
