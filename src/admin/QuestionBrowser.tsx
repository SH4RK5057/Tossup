import { useEffect, useMemo, useState } from 'react';
import { normalizeText } from '../core/normalize';
import { RULESETS } from '../core/rulesets';
import { LEVELS, LEVEL_LABEL, RULESET_IDS, statusSchema, type Question } from '../core/types';
import { useApp } from '../ui/context';

const textOf = (q: Question) => (q.type === 'tossup' ? q.text : q.leadin);
const answerOf = (q: Question) => (q.type === 'tossup' ? q.answer : q.parts.map((p) => p.answer).join(' / '));

export function QuestionBrowser() {
  const { repo, user } = useApp();
  const [activating, setActivating] = useState(false);
  const [all, setAll] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ status: '', ruleset: '', level: '', category: '', source: '', minReports: 0, search: '' });

  useEffect(() => {
    repo.listQuestions().then(setAll, (e) => setError(String(e)));
  }, [repo]);

  const categories = useMemo(() => [...new Set((all ?? []).map((q) => q.category))].sort(), [all]);
  const sources = useMemo(() => [...new Set((all ?? []).map((q) => q.source))].sort(), [all]);

  const rows = useMemo(() => {
    const needle = normalizeText(f.search);
    return (all ?? []).filter((q) =>
      (!f.status || q.status === f.status) &&
      (!f.ruleset || q.rulesets.includes(f.ruleset as 'ncal')) &&
      (!f.level || q.level === f.level) &&
      (!f.category || q.category === f.category) &&
      (!f.source || q.source === f.source) &&
      q.report_count >= f.minReports &&
      (!needle || normalizeText(`${textOf(q)} ${answerOf(q)}`).includes(needle)),
    );
  }, [all, f]);

  const pending = (all ?? []).filter((q) => q.status === 'pending');
  const activateAll = async () => {
    if (!confirm(`Make all ${pending.length} pending question(s) active? Players will see them immediately.`)) return;
    setActivating(true);
    try {
      for (const q of pending) await repo.setStatus(q.id, 'active', user?.email ?? user?.uid ?? 'admin');
      setAll(await repo.listQuestions());
    } catch (e) {
      setError(String(e));
    } finally {
      setActivating(false);
    }
  };

  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  return (
    <div className="stack">
      <h1>Questions</h1>
      {error && <div className="notice error">{error}</div>}
      <div className="panel">
        <div className="row">
          <input type="search" placeholder="Search text and answers in the loaded set" value={f.search} onChange={(e) => set({ search: e.target.value })} style={{ flex: '1 1 260px' }} />
          <select style={{ width: 130 }} value={f.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">Any status</option>{statusSchema.options.map((s) => <option key={s}>{s}</option>)}</select>
          <select style={{ width: 130 }} value={f.ruleset} onChange={(e) => set({ ruleset: e.target.value })}>
            <option value="">Any ruleset</option>{RULESET_IDS.map((r) => <option key={r} value={r}>{RULESETS[r].shortName}</option>)}</select>
          <select style={{ width: 120 }} value={f.level} onChange={(e) => set({ level: e.target.value })}>
            <option value="">Any level</option>{LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select>
          <select style={{ width: 150 }} value={f.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">Any category</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          <select style={{ width: 150 }} value={f.source} onChange={(e) => set({ source: e.target.value })}>
            <option value="">Any source</option>{sources.map((c) => <option key={c}>{c}</option>)}</select>
          <label className="inline-check small">Reports ≥
            <input type="number" min={0} style={{ width: 70 }} value={f.minReports} onChange={(e) => set({ minReports: Math.max(0, Number(e.target.value) || 0) })} /></label>
        </div>
      </div>
      {pending.length > 0 && (
        <div className="notice row">
          <span>{pending.length} pending question(s).</span>
          <button className="primary" disabled={activating} onClick={activateAll}>{activating ? 'Activating…' : `Activate all pending (${pending.length})`}</button>
        </div>
      )}
      {all === null && !error && <p className="muted">Loading…</p>}
      {all && (
        <>
          <p className="muted small">{rows.length} of {all.length} questions{rows.length > 200 ? ' (showing the first 200)' : ''}</p>
          <div className="table-wrap panel">
            <table>
              <thead><tr><th>Type</th><th>Question</th><th>Answer</th><th>Status</th><th>Level</th><th>Source</th><th>Reports</th></tr></thead>
              <tbody>
                {rows.slice(0, 200).map((q) => (
                  <tr key={q.id}>
                    <td>{q.type}</td>
                    <td><a href={`#/admin/edit/${encodeURIComponent(q.id)}`}>{textOf(q).slice(0, 90)}{textOf(q).length > 90 ? '…' : ''}</a>
                      <div className="muted small">{q.category} · {q.subcategory}</div></td>
                    <td className="small">{answerOf(q)}</td>
                    <td>{q.status}</td><td>{LEVEL_LABEL[q.level]}</td><td className="small">{q.source}</td><td>{q.report_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
