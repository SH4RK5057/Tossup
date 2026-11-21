import { Fragment, useState } from 'react';
import type { ReviewItem } from '../core/review';
import { accuracy, type SessionSummary, type Tally } from '../core/stats';
import { getRuleset } from '../core/rulesets';
import { LEVEL_LABEL } from '../core/types';
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
  /** Every question played this session, for the review. Empty when the summary is shown from storage. */
  review?: ReviewItem[];
  /** Practice the missed questions again. */
  onRetry?: (kind: 'tossup' | 'bonus') => void;
  onAgain: () => void;
  onHome: () => void;
}

function Review({ items }: { items: ReviewItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const missed = items.filter((i) => !i.allCorrect);
  const shown = showAll ? items : missed;
  return (
    <section className="panel stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Review</h2>
        <label className="inline-check small">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show every question ({items.length}), not just the {missed.length} missed
        </label>
      </div>
      {shown.length === 0 && <p className="muted">Nothing missed. Nice.</p>}
      {shown.map((it, i) => (
        <div key={`${it.questionId}-${i}`} className="panel" style={{ background: 'var(--surface-2)' }}>
          <div className="muted small">{it.category} · {it.subcategory}</div>
          {it.leadin && <p style={{ margin: '0.25rem 0' }}><strong>{it.leadin}</strong></p>}
          {it.parts.map((p, j) => (
            <div key={j} style={{ margin: '0.4rem 0' }}>
              <div>{it.kind === 'bonus' ? `${j + 1}. ` : ''}{p.text}</div>
              <div className="small">
                <span style={{ color: p.correct ? 'var(--ok, #4ade80)' : 'var(--bad, #f87171)', fontWeight: 600 }}>{p.correct ? '✓' : '✗'}</span>{' '}
                You: <em>{p.typed.trim() ? p.typed : p.timedOut ? '(no answer, time ran out)' : '(blank)'}</em>
                {!p.correct && <> · Answer: <strong>{p.answer}</strong></>}
                {p.correct && <> · <span className="muted">{p.answer}</span></>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

/** End-of-session screen: the only place (with the stats page) that shows streaks and stats. */
export function Summary({ summary: s, review, onRetry, onAgain, onHome }: Props) {
  const missedTossups = (review ?? []).filter((i) => i.kind === 'tossup' && !i.allCorrect).length;
  const missedBonuses = (review ?? []).filter((i) => i.kind === 'bonus' && !i.allCorrect).length;
  const rs = getRuleset(s.rulesetId);
  // Every tossup and bonus part answered this session.
  const overall = Object.values(s.bySubject).reduce<Tally>(
    (a, t) => ({ seen: a.seen + t.seen, correct: a.correct + t.correct }), { seen: 0, correct: 0 });
  const ppb = s.bonuses.played ? s.bonuses.points / s.bonuses.played : null;
  return (
    <div className="page stack">
      <div>
        <h1>Session complete</h1>
        <p className="muted">
          {rs.shortName} · {LEVEL_LABEL[s.level]} · {s.kind === 'sim' ? 'Game sim' : s.kind === 'bonus' ? 'Bonus drill' : 'Tossups'}
          {s.untimed && <span className="badge">untimed</span>}
        </p>
        {s.untimed && <p className="hint">Untimed sessions are excluded from accuracy stats by default.</p>}
      </div>
      <div className="stat-tiles">
        <div className="tile"><small>Final score</small><b>{s.score}</b></div>
        <div className="tile"><small>Correct ({overall.correct}/{overall.seen})</small><b>{formatPercent(accuracy(overall))}</b></div>
        {s.kind !== 'bonus' && <div className="tile"><small>Tossups correct</small><b>{s.tossups.correct}/{s.tossups.seen}</b>
          <small>{formatPercent(accuracy(s.tossups))}</small></div>}
        {s.kind !== 'bonus' && <div className="tile"><small>Best streak</small><b>{s.bestStreak}</b></div>}
        {s.bonuses.played > 0 && <div className="tile"><small>Points per bonus</small><b>{ppb?.toFixed(1)}</b></div>}
      </div>
      <div className="grid-2">
        <section className="panel"><h2>By subject</h2><SubjectTable bySubject={s.bySubject} /></section>
        {s.bonuses.played > 0 && <section className="panel"><h2>Bonus parts</h2><PartTable parts={s.bonuses.parts} /></section>}
      </div>
      <div className="row">
        <button className="primary" onClick={onAgain} autoFocus>Play again</button>
        {onRetry && missedTossups > 0 && <button onClick={() => onRetry('tossup')}>Retry {missedTossups} missed tossup{missedTossups === 1 ? '' : 's'}</button>}
        {onRetry && missedBonuses > 0 && <button onClick={() => onRetry('bonus')}>Retry {missedBonuses} missed bonus{missedBonuses === 1 ? '' : 'es'}</button>}
        <button onClick={onHome}>Change settings</button>
        <a href="#/stats">All stats</a>
      </div>
      {review && review.length > 0 && <Review items={review} />}
    </div>
  );
}
