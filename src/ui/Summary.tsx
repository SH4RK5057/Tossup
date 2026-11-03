import { Fragment } from 'react';
import { accuracy, type SessionSummary, type Tally } from '../core/stats';
import { getRuleset } from '../core/rulesets';
import { levelsLabel } from '../core/types';
import { formatPercent } from './format';

export function AccuracyBar({ t }: { t: Tally }) {
  const a = accuracy(t);
  return (
    <div className="row" style={{ gap: '0.5rem', flexWrap: 'nowrap' }}>
      <div className="bar" style={{ flex: 1 }}><i style={{ width: `${(a ?? 0) * 100}%` }} /></div>
      <span className="small" style={{ minWidth: 90 }}>{t.correct}/{t.seen} · {formatPercent(a)}</span>
    </div>
  );
}

/** Accuracy grouped by category, with subcategories nested underneath. */
export function SubjectTable({ bySubject }: { bySubject: Record<string, Tally> }) {
  const groups = new Map<string, { total: Tally; subs: [string, Tally][] }>();
  for (const [key, t] of Object.entries(bySubject)) {
    const [cat, ...rest] = key.split('/');
    const g = groups.get(cat) ?? { total: { seen: 0, correct: 0 }, subs: [] };
    g.total.seen += t.seen;
    g.total.correct += t.correct;
    g.subs.push([rest.join('/'), t]);
    groups.set(cat, g);
  }
  if (!groups.size) return <p className="muted">No data yet.</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Category / subcategory</th><th>Accuracy</th></tr></thead>
        <tbody>
          {[...groups.entries()].sort().map(([cat, g]) => (
            <Fragment key={cat}>
              <tr><td><strong>{cat}</strong></td><td><AccuracyBar t={g.total} /></td></tr>
              {g.subs.length > 1 || g.subs[0][0] !== cat
                ? g.subs.sort().map(([sub, t]) => (
                    <tr key={`${cat}/${sub}`}><td style={{ paddingLeft: '1.6rem' }} className="small">{sub}</td><td><AccuracyBar t={t} /></td></tr>
                  ))
                : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PartTable({ parts }: { parts: SessionSummary['bonuses']['parts'] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Bonus part</th><th>Accuracy</th></tr></thead>
        <tbody>
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <tr key={d}><td style={{ textTransform: 'capitalize' }}>{d}</td><td><AccuracyBar t={parts[d]} /></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  summary: SessionSummary;
  onAgain: () => void;
  onHome: () => void;
}

/** End-of-session screen: the only place (with the stats page) that shows streaks and stats. */
export function Summary({ summary: s, onAgain, onHome }: Props) {
  const rs = getRuleset(s.rulesetId);
  const ppb = s.bonuses.played ? s.bonuses.points / s.bonuses.played : null;
  return (
    <div className="page stack">
      <div>
        <h1>Session complete</h1>
        <p className="muted">
          {rs.shortName} · {levelsLabel(s.levels ?? [s.level])} · {s.kind === 'sim' ? 'Game sim' : s.kind === 'bonus' ? 'Bonus drill' : 'Tossups'}
          {s.untimed && <span className="badge">untimed</span>}
        </p>
        {s.untimed && <p className="hint">Untimed sessions are excluded from accuracy stats by default.</p>}
      </div>
      <div className="stat-tiles">
        <div className="tile"><small>Final score</small><b>{s.score}</b></div>
        {s.kind !== 'bonus' && <div className="tile"><small>Tossups correct</small><b>{s.tossups.correct}/{s.tossups.seen}</b></div>}
        {s.kind !== 'bonus' && <div className="tile"><small>Best streak</small><b>{s.bestStreak}</b></div>}
        {s.bonuses.played > 0 && <div className="tile"><small>Points per bonus</small><b>{ppb?.toFixed(1)}</b></div>}
      </div>
      <div className="grid-2">
        <section className="panel"><h2>By subject</h2><SubjectTable bySubject={s.bySubject} /></section>
        {s.bonuses.played > 0 && <section className="panel"><h2>Bonus parts</h2><PartTable parts={s.bonuses.parts} /></section>}
      </div>
      <div className="row">
        <button className="primary" onClick={onAgain} autoFocus>Play again</button>
        <button onClick={onHome}>Change settings</button>
        <a href="#/stats">All stats</a>
      </div>
    </div>
  );
}
