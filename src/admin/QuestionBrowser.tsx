import { useEffect, useMemo, useState } from 'react';
import { normalizeText } from '../core/normalize';
import { RULESETS } from '../core/rulesets';
import { DIFFICULTIES, DIFFICULTY_LABEL, LEVELS, LEVEL_LABEL, RULESET_IDS, statusSchema, type Question } from '../core/types';
import { useApp } from '../ui/context';

const textOf = (q: Question) => (q.type === 'tossup' ? q.text : q.leadin);
const answerOf = (q: Question) => (q.type === 'tossup' ? q.answer : q.parts.map((p) => p.answer).join(' / '));

export function QuestionBrowser() {
  const { repo, user } = useApp();
  const [activating, setActivating] = useState(false);
  const [all, setAll] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ status: '', ruleset: '', level: '', difficulty: '', category: '', source: '', minReports: 0, search: '' });

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
      (!f.difficulty || q.difficulty === f.difficulty) &&
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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = rows.slice(0, 200);
  const editor = user?.email ?? user?.uid ?? 'admin';

  // Classic click / shift-click range selection over the visible rows.
  const toggle = (index: number, shift: boolean) => {
    const next = new Set(selected);
    if (shift && anchor !== null) {
      const [a, b] = [Math.min(anchor, index), Math.max(anchor, index)];
      const on = !selected.has(shown[index].id);
      for (let i = a; i <= b; i++) (on ? next.add(shown[i].id) : next.delete(shown[i].id));
    } else {
      const id = shown[index].id;
      if (next.has(id)) next.delete(id); else next.add(id);
    }
    setAnchor(index);
    setSelected(next);
  };
  const allMatchingSelected = rows.length > 0 && rows.every((q) => selected.has(q.id));

  const runBulk = async (label: string, fn: (ids: string[]) => Promise<void>) => {
    const ids = [...selected];
    setBusy(true);
    try {
      await fn(ids);
      setAll(await repo.listQuestions());
      setSelected(new Set());
      setAnchor(null);
    } catch (e) {
      setError(`${label} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };
  const bulkStatus = (status: 'active' | 'retired') => runBulk('Update', async (ids) => {
    for (const id of ids) await repo.setStatus(id, status, editor);
  });
  const bulkDelete = () => {
    const n = selected.size;
    if (!confirm(`Permanently delete ${n} question(s) and their version history? This cannot be undone.`)) return;
    if (n > 10 && prompt(`Type DELETE to confirm deleting ${n} questions.`) !== 'DELETE') return;
    void runBulk('Delete', (ids) => repo.deleteQuestions(ids));
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
          <select style={{ width: 130 }} value={f.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
            <option value="">Any difficulty</option>{DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}</select>
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
      {selected.size > 0 && (
        <div className="notice row" style={{ position: 'sticky', top: 0, zIndex: 4 }}>
          <strong>{selected.size} selected</strong>
          <button disabled={busy} onClick={() => bulkStatus('active')}>Activate</button>
          <button disabled={busy} onClick={() => bulkStatus('retired')}>Retire</button>
          <button className="danger" disabled={busy} onClick={bulkDelete}>Delete…</button>
          <button className="link" onClick={() => setSelected(new Set())}>Clear</button>
        </div>
      )}
      {all === null && !error && <p className="muted">Loading…</p>}
      {all && (
        <>
          <p className="muted small">{rows.length} of {all.length} questions{rows.length > 200 ? ' (showing the first 200; the header checkbox selects all matching)' : ''}. Shift-click to select a range.</p>
          <div className="table-wrap panel">
            <table>
              <thead><tr><th style={{ width: 28 }}><input type="checkbox" aria-label="Select all matching" checked={allMatchingSelected}
                onChange={() => setSelected(allMatchingSelected ? new Set() : new Set(rows.map((q) => q.id)))} /></th><th>Type</th><th>Question</th><th>Answer</th><th>Status</th><th>Level</th><th>Difficulty</th><th>Source</th><th>Reports</th></tr></thead>
              <tbody>
                {shown.map((q, i) => (
                  <tr key={q.id} style={selected.has(q.id) ? { background: 'var(--surface-2)' } : undefined}>
                    <td><input type="checkbox" aria-label="Select" checked={selected.has(q.id)} readOnly
                      onClick={(e) => toggle(i, e.shiftKey)} /></td>
                    <td>{q.type}</td>
                    <td><a href={`#/admin/edit/${encodeURIComponent(q.id)}`}>{textOf(q).slice(0, 90)}{textOf(q).length > 90 ? '…' : ''}</a>
                      <div className="muted small">{q.category} · {q.subcategory}</div></td>
                    <td className="small">{answerOf(q)}</td>
                    <td>{q.status}</td><td>{LEVEL_LABEL[q.level]}</td><td>{DIFFICULTY_LABEL[q.difficulty]}</td><td className="small">{q.source}</td><td>{q.report_count}</td>
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
