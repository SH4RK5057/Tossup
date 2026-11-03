import { useCallback, useEffect, useMemo, useState } from 'react';
import { REPORT_REASON_LABEL, type Question, type StoredReport } from '../core/types';
import { useApp } from '../ui/context';
import { formatDate } from '../ui/format';

/** Unresolved reports grouped by question, most-reported first. */
export function ReportsQueue() {
  const { repo, user } = useApp();
  const editor = user?.email ?? user?.uid ?? 'admin';
  const [reports, setReports] = useState<StoredReport[] | null>(null);
  const [questions, setQuestions] = useState<Map<string, Question>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, qs] = await Promise.all([repo.listReports(), repo.listQuestions()]);
      setReports(r);
      setQuestions(new Map(qs.map((q) => [q.id, q])));
    } catch (e) {
      setError(String(e));
    }
  }, [repo]);
  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => {
    const by = new Map<string, StoredReport[]>();
    for (const r of reports ?? []) if (!r.resolved) by.set(r.question_id, [...(by.get(r.question_id) ?? []), r]);
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [reports]);

  const resolveAll = async (items: StoredReport[]) => {
    await Promise.all(items.map((r) => repo.resolveReport(r.id)));
    await repo.syncReportCounts();
  };
  const dismiss = async (items: StoredReport[]) => {
    try { await resolveAll(items); await load(); } catch (e) { setError(String(e)); }
  };
  const retire = async (id: string, items: StoredReport[]) => {
    try { await repo.setStatus(id, 'retired', editor); await resolveAll(items); await load(); } catch (e) { setError(String(e)); }
  };

  return (
    <div className="stack">
      <h1>Reports</h1>
      <p className="muted small">“I was right” overrides arrive here as <em>My answer should count</em> with the typed answer.</p>
      {error && <div className="notice error">{error}</div>}
      {reports === null && !error && <p className="muted">Loading…</p>}
      {reports && groups.length === 0 && <div className="notice ok">No open reports.</div>}
      {groups.map(([id, items]) => {
        const q = questions.get(id);
        const typed = items.filter((r) => r.typed_answer).map((r) => r.typed_answer!);
        const counts = items.reduce<Record<string, number>>((m, r) => ({ ...m, [r.reason]: (m[r.reason] ?? 0) + 1 }), {});
        return (
          <section className="panel stack" key={id}>
            <div className="row">
              <strong style={{ fontSize: '1.2rem' }}>{items.length} report{items.length === 1 ? '' : 's'}</strong>
              <span className="muted small">{id}{q ? ` · ${q.status}` : ' · (question missing)'}</span>
            </div>
            {q && (
              <div>
                <div>{q.type === 'tossup' ? q.text : q.leadin}</div>
                <div className="muted small">Key: <strong>{q.type === 'tossup' ? q.answer : q.parts.map((p) => p.answer).join(' / ')}</strong></div>
              </div>
            )}
            <div className="small">{Object.entries(counts).map(([r, n]) => `${REPORT_REASON_LABEL[r as keyof typeof REPORT_REASON_LABEL]} ×${n}`).join(' · ')}</div>
            {typed.length > 0 && <div className="small">Typed answers: {[...new Set(typed)].map((t) => <code key={t} style={{ marginRight: 8 }}>{t}</code>)}</div>}
            {items.some((r) => r.note) && (
              <ul className="small">{items.filter((r) => r.note).map((r) => <li key={r.id}>{r.note} <span className="muted">({formatDate(r.created_at)})</span></li>)}</ul>
            )}
            <div className="row">
              <a href={`#/admin/edit/${encodeURIComponent(id)}`}>Edit</a>
              <button className="danger" onClick={() => retire(id, items)}>Retire</button>
              <button onClick={() => dismiss(items)}>Dismiss</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
