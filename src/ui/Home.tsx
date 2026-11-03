import { getRuleset, RULESETS } from '../core/rulesets';
import { subjectKey } from '../core/pool';
import type { SessionKind } from '../core/session';
import { DIFFICULTIES, DIFFICULTY_LABEL, LEVELS, LEVEL_LABEL, type Difficulty, type Level, type RulesetId } from '../core/types';
import type { Settings } from '../storage/storage';

interface Props {
  settings: Settings;
  onChange: (next: Settings) => void;
  onStart: (kind: SessionKind) => void;
  busy: boolean;
  error: string | null;
}

export function Home({ settings, onChange, onStart, busy, error }: Props) {
  const rs = getRuleset(settings.ruleset);
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  const changeRuleset = (id: RulesetId) => {
    const next = getRuleset(id);
    set({
      ruleset: id,
      tossupSeconds: next.tossupSeconds,
      bonusSeconds: next.bonus.defaultSeconds,
      subjects: [],
      fullDistribution: false,
    });
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

  return (
    <div className="page stack">
      <div>
        <h1>Practice</h1>
        <p className="muted">
          Type your answers and press <kbd>Enter</kbd>. Rules: {rs.name}.
        </p>
      </div>

      {error && <div className="notice error">{error}</div>}

      <div className="mode-buttons">
        <button className="primary" disabled={busy} onClick={() => onStart('tossup')}>
          <strong>Tossups</strong>
          <span className="small">One question at a time</span>
        </button>
        <button className="primary" disabled={busy} onClick={() => onStart('bonus')}>
          <strong>Bonus drill</strong>
          <span className="small">{rs.bonus.timing === 'together' ? 'All parts, one clock' : 'One part at a time'}</span>
        </button>
        <button className="primary" disabled={busy} onClick={() => onStart('sim')}>
          <strong>Game sim</strong>
          <span className="small">Tossups with a running score</span>
        </button>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>Settings</h2>
          <label className="field">
            <span className="lbl">Ruleset</span>
            <select value={settings.ruleset} onChange={(e) => changeRuleset(e.target.value as RulesetId)}>
              {Object.values(RULESETS).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
            <span className="lbl">Tossup answer time (seconds)</span>
            <div className="row">
              <input type="number" min={3} max={300} style={{ width: 100 }} disabled={settings.tossupUntimed}
                value={settings.tossupSeconds}
                onChange={(e) => set({ tossupSeconds: Math.max(3, Number(e.target.value) || rs.tossupSeconds) })} />
              <label className="inline-check">
                <input type="checkbox" checked={settings.tossupUntimed} onChange={(e) => set({ tossupUntimed: e.target.checked })} />
                Untimed
              </label>
            </div>
          </div>

          <div className="field">
            <span className="lbl">
              Bonus time (seconds {rs.bonus.timing === 'together' ? 'for all parts' : 'per part'})
            </span>
            <div className="row">
              <input type="number" min={3} max={600} style={{ width: 100 }} disabled={settings.bonusUntimed}
                value={settings.bonusSeconds}
                onChange={(e) => set({ bonusSeconds: Math.max(3, Number(e.target.value) || rs.bonus.defaultSeconds) })} />
              <label className="inline-check">
                <input type="checkbox" checked={settings.bonusUntimed} onChange={(e) => set({ bonusUntimed: e.target.checked })} />
                Untimed
              </label>
            </div>
          </div>

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
            </div>
          </div>
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
    </div>
  );
}
