import { useMemo, useState } from 'react';
import { RULESETS } from '../core/rulesets';
import { accuracy, aggregate, weakSubjects } from '../core/stats';
import { LEVEL_LABEL, type RulesetId } from '../core/types';
import { clearSessions, loadSessions } from '../storage/storage';
import { formatDate, formatPercent } from './format';
import { AccuracyBar, PartTable, SubjectTable } from './Summary';

export function StatsPage({ initialRuleset, onDrill }: { initialRuleset: RulesetId; onDrill?: (rulesetId: RulesetId, keys: string[]) => void }) {
  const [sessions, setSessions] = useState(loadSessions);
  const [ruleset, setRuleset] = useState<RulesetId>(initialRuleset);
  const [includeUntimed, setIncludeUntimed] = useState(false);
  const agg = useMemo(() => aggregate(sessions, { rulesetId: ruleset, includeUntimed }), [sessions, ruleset, includeUntimed]);
  const weak = useMemo(() => weakSubjects(agg.bySubject), [agg]);
  const recent = sessions.filter((s) => s.rulesetId === ruleset).slice(-15).reverse();

  return (
    <div className="page stack">
      <h1>Stats</h1>
      <div className="row">
        {Object.values(RULESETS).map((r) => (
          <button key={r.id} className={ruleset === r.id ? 'primary' : ''} onClick={() => setRuleset(r.id)}>{r.shortName}</button>
        ))}
        <label className="inline-check" style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={includeUntimed} onChange={(e) => setIncludeUntimed(e.target.checked)} />
          Include untimed sessions
        </label>
      </div>
      <p className="hint">Stats are stored on this device. {RULESETS[ruleset].shortName} and other rulesets are never mixed.</p>

      <div className="stat-tiles">
        <div className="tile"><small>Sessions</small><b>{agg.sessions}</b></div>
        <div className="tile"><small>Tossup accuracy</small><b>{formatPercent(accuracy(agg.tossups))}</b></div>
        <div className="tile"><small>Points per bonus</small><b>{agg.ppb === null ? '—' : agg.ppb.toFixed(1)}</b><small>{agg.bonusesPlayed} bonuses</small></div>
      </div>

      {weak.length > 0 && (
        <section className="panel stack">
          <h2 style={{ margin: 0 }}>Subjects to work on</h2>
          <p className="hint" style={{ margin: 0 }}>Your lowest accuracy so far (subjects with at least 5 answers).</p>
          {weak.map((w) => (
            <div key={w.key} className="row" style={{ justifyContent: 'space-between' }}>
              <span>{w.key.replace('/', ' · ')}</span>
              <span className="small">{w.tally.correct}/{w.tally.seen} · {formatPercent(w.accuracy)}</span>
            </div>
          ))}
          {onDrill && (
            <div className="row">
              <button className="primary" onClick={() => onDrill(ruleset, weak.slice(0, 3).map((w) => w.key))}>
                Drill my {Math.min(3, weak.length)} weakest
              </button>
              <button onClick={() => onDrill(ruleset, weak.map((w) => w.key))}>Drill all {weak.length}</button>
            </div>
          )}
        </section>
      )}

      <div className="grid-2">
        <section className="panel"><h2>Accuracy by subject</h2><SubjectTable bySubject={agg.bySubject} /></section>
        <section className="panel">
          <h2>Bonus parts</h2>
          <PartTable parts={agg.parts} />
          <p className="hint">Only sessions with bonuses are counted.</p>
        </section>
      </div>

      <section className="panel">
        <h2>Recent sessions</h2>
        {recent.length === 0 ? <p className="muted">Nothing yet — play a session!</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Mode</th><th>Level</th><th>Score</th><th>Tossups</th></tr></thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>{formatDate(s.date)}</td>
                    <td>{s.kind}{s.untimed && <span className="badge">untimed</span>}</td>
                    <td>{LEVEL_LABEL[s.level]}</td>
                    <td>{s.score}</td>
                    <td style={{ minWidth: 160 }}><AccuracyBar t={s.tossups} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div><button className="danger" onClick={() => { if (confirm('Delete all saved stats on this device?')) { clearSessions(); setSessions([]); } }}>Clear stats</button></div>
    </div>
  );
}
