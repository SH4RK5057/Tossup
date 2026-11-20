import { useEffect, useMemo, useState } from 'react';
import { RULESETS } from '../core/rulesets';
import { DIFFICULTIES, DIFFICULTY_LABEL, LEVELS, LEVEL_LABEL, RULESET_IDS, statusSchema, type Question } from '../core/types';
import { useApp } from '../ui/context';

const textOf = (q: Question) => (q.type === 'tossup' ? q.text : q.leadin);
const answerOf = (q: Question) => (q.type === 'tossup' ? q.answer : q.parts.map((p) => p.answer).join(' / '));

/** Expiry filter: '' any, 'expired', 'soon' (within 30 days), 'dated' (has an expiry date). */
function expiryMatch(expires: string | null | undefined, mode: string): boolean {
  if (!mode) return true;
  if (!expires) return false;
  const now = Date.now();
  const t = Date.parse(expires);
  if (mode === 'expired') return t <= now;
  if (mode === 'soon') return t > now && t <= now + 30 * 86400_000;
  return true;
}

export function QuestionBrowser() {
  const { repo, user } = useApp();
  const [activating, setActivating] = useState(false);
  const [all, setAll] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({ status: '', ruleset: '', level: '', difficulty: '', category: '', source: '', minReports: 0, search: '', store: '', expiry: '' });
  const [hideDupes, setHideDupes] = useState(true);
  const [baked, setBaked] = useState<Question[]>([]);
  const [bakedState, setBakedState] = useState<'loading' | 'ok' | 'none'>('loading');

  useEffect(() => {
    repo.listQuestions().then(setAll, (e) => setError(String(e)));
  }, [repo]);

  // The baked-in bank (public/bank/*.json): what players actually practice with. Read-only here.
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all(RULESET_IDS.flatMap((r) => LEVELS.map((l) => fetch(`${base}bank/${r}-${l}.json`).then((x) => (x.ok ? (x.json() as Promise<Question[]>) : [])))))
      .then((lists) => { const flat = lists.flat(); setBaked(flat); setBakedState(flat.length ? 'ok' : 'none'); })
      .catch(() => setBakedState('none'));
  }, []);

  const bakedIds = useMemo(() => new Set(baked.map((q) => q.id)), [baked]);
  const bakedTexts = useMemo(() => new Set(baked.map((q) => textOf(q).toLowerCase())), [baked]);
  const view = useMemo(() => {
    const fs = (all ?? []).filter((q) => !(hideDupes && bakedTexts.has(textOf(q).toLowerCase())));
    return f.store === 'baked' ? baked : f.store === 'firestore' ? (all ?? []) : [...fs, ...baked];
  }, [all, baked, bakedTexts, hideDupes, f.store]);

  const categories = useMemo(() => [...new Set(view.map((q) => q.category))].sort(), [view]);
  const sources = useMemo(() => [...new Set(view.map((q) => q.source))].sort(), [view]);

  const rows = useMemo(() => {
    const needle = f.search.trim().toLowerCase();
    return view.filter((q) =>
      (!f.status || q.status === f.status) &&
      (!f.ruleset || q.rulesets.includes(f.ruleset as 'ncal')) &&
      (!f.level || q.level === f.level) &&
      (!f.difficulty || q.difficulty === f.difficulty) &&
      (!f.category || q.category === f.category) &&
      (!f.source || q.source === f.source) &&
      q.report_count >= f.minReports &&
      expiryMatch(q.expires_at, f.expiry) &&
      (!needle || `${textOf(q)} ${answerOf(q)}`.toLowerCase().includes(needle)),
    );
  }, [view, f]);
  const editableRows = useMemo(() => rows.filter((q) => !bakedIds.has(q.id)), [rows, bakedIds]);

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
  const allMatchingSelected = editableRows.length > 0 && editableRows.every((q) => selected.has(q.id));

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
          <select style={{ width: 170 }} value={f.expiry} onChange={(e) => set({ expiry: e.target.value })}>
            <option value="">Any expiry</option><option value="expired">Expired</option>
            <option value="soon">Expiring in 30 days</option><option value="dated">Has an expiry date</option></select>
          <select style={{ width: 150 }} value={f.store} onChange={(e) => set({ store: e.target.value })}>
            <option value="">Baked + Firestore</option><option value="baked">Baked only</option><option value="firestore">Firestore only</option></select>
          <label className="inline-check small"><input type="checkbox" checked={hideDupes} onChange={(e) => setHideDupes(e.target.checked)} />Hide Firestore copies of baked questions</label>
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
          <p className="muted small">{rows.length} of {view.length} questions ({baked.length} baked, {(all ?? []).length} in Firestore{bakedState === 'none' ? '; baked bank not found, run npm run bank' : ''}; baked questions are read-only){rows.length > 200 ? ' (showing the first 200; the header checkbox selects all matching)' : ''}. Shift-click to select a range.</p>
          <div className="table-wrap panel">
            <table>
              <thead><tr><th style={{ width: 28 }}><input type="checkbox" aria-label="Select all matching" checked={allMatchingSelected}
                onChange={() => setSelected(allMatchingSelected ? new Set() : new Set(editableRows.map((q) => q.id)))} /></th><th>Type</th><th>Question</th><th>Answer</th><th>Status</th><th>Level</th><th>Difficulty</th><th>Source</th><th>Reports</th></tr></thead>
              <tbody>
                {shown.map((q, i) => (
                  <tr key={q.id} style={selected.has(q.id) ? { background: 'var(--surface-2)' } : undefined}>
                    <td><input type="checkbox" aria-label="Select" disabled={bakedIds.has(q.id)} checked={selected.has(q.id)} readOnly
                      onClick={(e) => toggle(i, e.shiftKey)} /></td>
                    <td>{q.type}</td>
                    <td>{bakedIds.has(q.id)
                      ? <span title="Baked into the site: edit scripts/bank/data and rebuild">{textOf(q).slice(0, 90)}{textOf(q).length > 90 ? '…' : ''} <span className="badge">baked</span></span>
                      : <a href={`#/admin/edit/${encodeURIComponent(q.id)}`}>{textOf(q).slice(0, 90)}{textOf(q).length > 90 ? '…' : ''}</a>}
                      <div className="muted small">{q.category} · {q.subcategory}</div></td>
                    <td className="small">{answerOf(q)}</td>
                    <td>{q.status}{q.expires_at && (
                      <div className="small muted" title="Not served after this date">{q.expires_at <= new Date().toISOString() ? 'expired' : 'expires'} {q.expires_at.slice(0, 10)}</div>)}</td><td>{LEVEL_LABEL[q.level]}</td><td>{DIFFICULTY_LABEL[q.difficulty]}</td><td className="small">{q.source}</td><td>{q.report_count}</td>
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
