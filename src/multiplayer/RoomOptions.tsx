// The options that belong to a room (mode, teams, number of questions, reading speed). Used both when hosting a new
// room and by the host in the lobby; everything else about the questions comes from the shared settings panels.

import { getRuleset } from '../core/rulesets';
import type { RoomMode } from '../core/room';
import type { Settings } from '../storage/storage';
import { READING_SPEEDS } from './questions';

export const MODES: { mode: RoomMode; title: string; blurb: string }[] = [
  { mode: 'tossup', title: 'Tossups', blurb: 'Buzz in, one question at a time' },
  { mode: 'bonus', title: 'Bonus drill', blurb: 'Every team answers the same bonus' },
  { mode: 'sim', title: 'Game sim', blurb: 'Tossup, then the bonus goes to the team that got it' },
];

export function RoomOptions({ settings, onChange }: { settings: Settings; onChange: (next: Settings) => void }) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const bonusesOk = getRuleset(settings.ruleset).bonus.timing === 'together';
  const mode: RoomMode = bonusesOk ? settings.roomMode : 'tossup';
  return (
    <>
      <div className="field">
        <span className="lbl">Mode (the same three as solo)</span>
        <div className="row" role="radiogroup" aria-label="Room mode">
          {MODES.map((m) => {
            const off = m.mode !== 'tossup' && !bonusesOk;
            return (
              <button key={m.mode} role="radio" aria-checked={mode === m.mode} disabled={off}
                title={off ? 'Bonuses in rooms need a ruleset whose bonuses are answered all at once (NCAL)' : m.blurb}
                className={mode === m.mode ? 'primary' : ''} onClick={() => set({ roomMode: m.mode })}>{m.title}</button>
            );
          })}
        </div>
        <p className="hint">{MODES.find((m) => m.mode === mode)?.blurb}.{!bonusesOk ? ' Bonus modes are not available for this ruleset in rooms.' : ''}</p>
      </div>
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
    </>
  );
}
