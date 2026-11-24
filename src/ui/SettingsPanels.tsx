// The settings and subject panels shared by solo practice and rooms. A room uses exactly the same ruleset, level,
// difficulty, subject and answer-time settings; only the things that cannot apply to a live room differ.

import { PACE_LABEL, PACES } from '../core/clock';
import { subjectKey } from '../core/pool';
import { getRuleset, RULESETS } from '../core/rulesets';
import { DIFFICULTIES, DIFFICULTY_LABEL, LEVELS, LEVEL_LABEL, type Difficulty, type Level, type RulesetId } from '../core/types';
import type { Settings } from '../storage/storage';

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
  /** 'room' hides what a live room cannot use (untimed answers, bonus timing, game-sim length). */
  mode: 'solo' | 'room';
}

export function SettingsPanels({ settings, onChange, mode }: Props) {
  const rs = getRuleset(settings.ruleset);
  const room = mode === 'room';
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  const changeRuleset = (id: RulesetId) => {
    const next = getRuleset(id);
    set({ ruleset: id, tossupSeconds: next.tossupSeconds, bonusSeconds: next.bonus.defaultSeconds, subjects: [], fullDistribution: false });
  };
  const toggleSubject = (key: string) =>
    set({ subjects: settings.subjects.includes(key) ? settings.subjects.filter((k) => k !== key) : [...settings.subjects, key] });
  const toggleCategory = (keys: string[]) => {
    const allOn = keys.every((k) => settings.subjects.includes(k));
    const rest = settings.subjects.filter((k) => !keys.includes(k));
    set({ subjects: allOn ? rest : [...rest, ...keys] });
  };

  const matchLabel = rs.match.kind === 'clock'
    ? `Match simulation (${rs.match.minutes[settings.level]} min game clock)`
    : `Match simulation (${rs.match.tossups} tossups)`;
  const untimed = !room && settings.tossupUntimed;
  const bonusUntimed = !room && settings.bonusUntimed;

  return (
    <div className="grid-2">
      <section className="panel">
        <h2>Settings</h2>
        <label className="field">
          <span className="lbl">Ruleset</span>
          <select value={settings.ruleset} onChange={(e) => changeRuleset(e.target.value as RulesetId)}>
            {Object.values(RULESETS).map((r) => <option key={r.id} value={r.id}>{r.id === 'ncal' ? r.name : `${r.name} (secondary mode)`}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="lbl">Level</span>
          <select value={settings.level} onChange={(e) => set({ level: e.target.value as Level })}>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </label>

        <div className="field">
          <span className="lbl">Difficulty (pick any combination)</span>
          <div className="row">
            {DIFFICULTIES.map((d) => (
              <label key={d} className="inline-check">
                <input type="checkbox" checked={settings.difficulties.includes(d)}
                  onChange={(e) => {
                    const next: Difficulty[] = e.target.checked ? [...settings.difficulties, d] : settings.difficulties.filter((x) => x !== d);
                    if (next.length) set({ difficulties: DIFFICULTIES.filter((x) => next.includes(x)) });
                  }} />
                {DIFFICULTY_LABEL[d]}
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="lbl">{room ? 'Answer time after you buzz in' : 'Tossup answer time'}</span>
          <div className="row">
            <label className="inline-check">
              <input type="radio" name="tossupTiming" disabled={untimed} checked={settings.tossupTiming === 'scaled'}
                onChange={() => set({ tossupTiming: 'scaled' })} />
              {room ? 'Scaled to the answer length' : 'Scaled to question length'}
            </label>
            <select style={{ width: 170 }} aria-label="Pace" disabled={untimed || settings.tossupTiming !== 'scaled'}
              value={settings.tossupPace} onChange={(e) => set({ tossupPace: e.target.value as Settings['tossupPace'] })}>
              {PACES.map((p) => <option key={p} value={p}>{PACE_LABEL[p]}</option>)}
            </select>
          </div>
          <div className="row">
            <label className="inline-check">
              <input type="radio" name="tossupTiming" disabled={untimed} checked={settings.tossupTiming === 'fixed'}
                onChange={() => set({ tossupTiming: 'fixed' })} />
              Flat
            </label>
            <input type="number" min={3} max={300} style={{ width: 100 }} aria-label="Flat seconds"
              disabled={untimed || settings.tossupTiming !== 'fixed'}
              value={settings.tossupSeconds}
              onChange={(e) => set({ tossupSeconds: Math.max(3, Number(e.target.value) || rs.tossupSeconds) })} />
            <span className="small muted">seconds</span>
            {!room && (
              <label className="inline-check">
                <input type="checkbox" checked={settings.tossupUntimed} onChange={(e) => set({ tossupUntimed: e.target.checked })} />
                Untimed
              </label>
            )}
          </div>
          {settings.tossupTiming === 'scaled' && !untimed && (
            <p className="hint">
              {room
                ? '3 s to start answering plus typing time (at least 3 s), like the official 3 seconds once you have buzzed in.'
                : 'Reading time + 5 s to start answering + typing time (at least 3 s), mirroring the official 5 s to buzz and 3 s to answer.'}
            </p>
          )}
        </div>

        {(!room || (settings.roomMode !== 'tossup' && rs.bonus.timing === 'together')) && (
          <>
            <div className="field">
              <span className="lbl">
                Bonus time{rs.bonus.timing === 'together' ? '' : ' (seconds per part)'}
              </span>
              {rs.bonus.timing === 'together' && (
                <>
                  <div className="row">
                    <label className="inline-check">
                      <input type="radio" name="bonusTiming" disabled={bonusUntimed} checked={settings.bonusTiming === 'scaled'}
                        onChange={() => set({ bonusTiming: 'scaled' })} />
                      Scaled to bonus length (uses the pace above)
                    </label>
                  </div>
                  {settings.bonusTiming === 'scaled' && !bonusUntimed && (
                    <p className="hint">{room
                      ? 'Once the bonus has been read: 20 s to confer plus typing time for the answers (at least 5 s), times the pace. All parts share one clock.'
                      : 'Reading time + 20 s to confer + typing time for the answers (at least 5 s). All parts share one clock.'}</p>
                  )}
                </>
              )}
              <div className="row">
                {rs.bonus.timing === 'together' && (
                  <label className="inline-check">
                    <input type="radio" name="bonusTiming" disabled={bonusUntimed} checked={settings.bonusTiming === 'fixed'}
                      onChange={() => set({ bonusTiming: 'fixed' })} />
                    Flat
                  </label>
                )}
                <input type="number" min={3} max={600} style={{ width: 100 }} aria-label="Flat bonus seconds"
                  disabled={bonusUntimed || (rs.bonus.timing === 'together' && settings.bonusTiming !== 'fixed')}
                  value={settings.bonusSeconds}
                  onChange={(e) => set({ bonusSeconds: Math.max(3, Number(e.target.value) || rs.bonus.defaultSeconds) })} />
                {!room && (
                  <label className="inline-check">
                    <input type="checkbox" checked={settings.bonusUntimed} onChange={(e) => set({ bonusUntimed: e.target.checked })} />
                    Untimed
                  </label>
                )}
              </div>
            </div>

            {!room && (<>
            <label className="inline-check field">
              <input type="checkbox" checked={settings.bonusesOn} onChange={(e) => set({ bonusesOn: e.target.checked })} />
              Bonuses on (game sim)
            </label>
            {(settings.tossupUntimed || settings.bonusUntimed) && (
              <p className="hint">Untimed sessions are labeled and left out of accuracy stats by default.</p>
            )}

            <div className="field">
              <span className="lbl">Game sim length</span>
              <div className="stack" style={{ marginTop: 0 }}>
                {[10, 20, 30].map((n) => (
                  <label key={n} className="inline-check">
                    <input type="radio" name="len" checked={settings.simLength === 'count' && settings.simCount === n}
                      onChange={() => set({ simLength: 'count', simCount: n })} />
                    {n} tossups
                  </label>
                ))}
                <label className="inline-check">
                  <input type="radio" name="len" checked={settings.simLength === 'count' && ![10, 20, 30].includes(settings.simCount)}
                    onChange={() => set({ simLength: 'count', simCount: 15 })} />
                  Custom:
                  <input type="number" min={1} max={200} style={{ width: 80 }} value={settings.simCount}
                    onChange={(e) => set({ simLength: 'count', simCount: Math.min(200, Math.max(1, Number(e.target.value) || 1)) })} />
                </label>
                <label className="inline-check">
                  <input type="radio" name="len" checked={settings.simLength === 'match'} onChange={() => set({ simLength: 'match' })} />
                  {matchLabel}
                </label>
                <label className="inline-check">
                  <input type="radio" name="len" checked={settings.simLength === 'all'} onChange={() => set({ simLength: 'all' })} />
                  Unlimited (play until you end the session)
                </label>
              </div>
            </div>
            </>)}
          </>
        )}
        {room && settings.roomMode === 'tossup' && <p className="hint">Choose Bonus drill or Game sim above to set the bonus answer time too.</p>}
        {room && settings.roomMode !== 'tossup' && rs.bonus.timing !== 'together' && (
          <p className="hint">{rs.name} bonuses are answered one part at a time, which rooms do not support yet, so this ruleset is tossups only in rooms.</p>
        )}
      </section>

      <section className="panel">
        <h2>Subjects</h2>
        <label className="inline-check field">
          <input type="checkbox" checked={settings.fullDistribution} onChange={(e) => set({ fullDistribution: e.target.checked })} />
          Full distribution (draw by the {rs.shortName} distribution)
        </label>
        <div className={`subject-tree${settings.fullDistribution ? ' disabled' : ''}`}>
          {rs.subjects.map((cat) => {
            const keys = cat.subjects.map((s) => subjectKey(cat.name, s.name));
            const on = keys.filter((k) => settings.subjects.includes(k)).length;
            return (
              <div key={cat.name}>
                <label className="cat inline-check">
                  <input type="checkbox" checked={on === keys.length} ref={(el) => { if (el) el.indeterminate = on > 0 && on < keys.length; }}
                    onChange={() => toggleCategory(keys)} />
                  {cat.name}
                </label>
                {cat.subjects.length > 1 && (
                  <div className="subs">
                    {cat.subjects.map((s) => {
                      const k = subjectKey(cat.name, s.name);
                      return (
                        <label key={k} className="inline-check small">
                          <input type="checkbox" checked={settings.subjects.includes(k)} onChange={() => toggleSubject(k)} />
                          {s.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="hint">
          {settings.fullDistribution
            ? 'Subject boxes are ignored while Full distribution is on.'
            : settings.subjects.length === 0 ? 'No boxes checked: all subjects.' : `${settings.subjects.length} subject(s) selected.`}
        </p>
        {rs.lowerLevelShare !== null && settings.level !== 'novice' && (
          <p className="hint">
            {LEVEL_LABEL[settings.level]} pools are cumulative: about {Math.round(rs.lowerLevelShare * 100)}% of questions come from lower levels.
          </p>
        )}
      </section>
    </div>
  );
}
