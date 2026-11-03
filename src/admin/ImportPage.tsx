import { useRef, useState } from 'react';
import type { Question } from '../core/types';
import { useApp } from '../ui/context';
import { validateImport, type RowResult } from './importLogic';
import { verifyCold, type VerifyItem, type VerifyResult } from './verifyLogic';

function JsonInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="stack">
      <label className="field"><span className="lbl">{label}</span>
        <textarea className="json" style={{ minHeight: 140 }} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} /></label>
      <div className="row">
        <input ref={file} type="file" accept="application/json,.json" style={{ display: 'none' }}
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) onChange(await f.text()); e.target.value = ''; }} />
        <button onClick={() => file.current?.click()}>Upload .json file</button>
      </div>
    </div>
  );
}

function parseJson(text: string): { value?: unknown; error?: string } {
  try { return { value: JSON.parse(text) }; } catch (e) { return { error: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}` }; }
}

const randomId = () => `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function ImportPage() {
  const { repo, user } = useApp();
  const editor = user?.email ?? user?.uid ?? 'admin';

  // ---- import
  const [importText, setImportText] = useState('');
  const [rows, setRows] = useState<RowResult[] | null>(null);
  const [importMsg, setImportMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const validate = async () => {
    setImportMsg(null);
    const p = parseJson(importText);
    if (p.error) { setRows(null); setImportMsg({ kind: 'error', text: p.error }); return; }
    try {
      const existing = await repo.listQuestions();
      const res = validateImport(p.value, existing, { nowIso: new Date().toISOString(), makeId: () => randomId(), random: Math.random });
      if (res.fatal) { setRows(null); setImportMsg({ kind: 'error', text: res.fatal }); return; }
      setRows(res.rows);
    } catch (e) {
      setImportMsg({ kind: 'error', text: String(e) });
    }
  };

  const validRows = (rows ?? []).filter((r) => r.status === 'valid');
  const saveValid = async () => {
    try {
      await repo.createQuestions(validRows.map((r) => r.question!));
      setImportMsg({ kind: 'ok', text: `Saved ${validRows.length} question(s) as pending. Run verification next.` });
      setRows(null);
      setImportText('');
    } catch (e) {
      setImportMsg({ kind: 'error', text: String(e) });
    }
  };

  // ---- verify
  const [coldText, setColdText] = useState('');
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [queue, setQueue] = useState<VerifyItem[]>([]);
  const [verifyMsg, setVerifyMsg] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const runVerify = async () => {
    setVerifyMsg(null);
    const p = parseJson(coldText);
    if (p.error) { setVerifyMsg({ kind: 'error', text: p.error }); return; }
    try {
      const pending = (await repo.listQuestions()).filter((q) => q.status === 'pending');
      const res = verifyCold(pending, p.value);
      setResult(res);
      setQueue(res.items.filter((i) => i.outcome === 'queue'));
    } catch (e) {
      setVerifyMsg({ kind: 'error', text: String(e) });
    }
  };

  const matches = (result?.items ?? []).filter((i) => i.outcome === 'match');
  const activate = async (qs: Question[]) => {
    for (const q of qs) await repo.setStatus(q.id, 'active', editor);
  };
  const activateMatches = async () => {
    try {
      await activate(matches.map((m) => m.question));
      setVerifyMsg({ kind: 'ok', text: `Activated ${matches.length} question(s).` });
      setResult(result && { ...result, items: result.items.filter((i) => i.outcome !== 'match') });
    } catch (e) {
      setVerifyMsg({ kind: 'error', text: String(e) });
    }
  };
  const resolveQueued = async (item: VerifyItem, status: 'active' | 'retired') => {
    try {
      await repo.setStatus(item.question.id, status, editor);
      setQueue((qs) => qs.filter((x) => x !== item));
    } catch (e) {
      setVerifyMsg({ kind: 'error', text: String(e) });
    }
  };

  return (
    <div className="stack">
      <h1>Import &amp; verify</h1>

      <section className="panel stack">
        <h2>1. Bulk import</h2>
        <p className="muted small">
          Paste or upload a JSON array of questions. Each row is validated, duplicates (by normalized text) are skipped, and valid rows are saved as <strong>pending</strong>.
        </p>
        <JsonInput label="Questions JSON" value={importText} onChange={setImportText} placeholder='[{"type":"tossup","rulesets":["ncal"],"level":"novice","category":"Math","subcategory":"Geometry","text":"...","answer":"..."}]' />
        <div className="row"><button className="primary" disabled={!importText.trim()} onClick={validate}>Validate</button></div>
        {importMsg && <div className={`notice ${importMsg.kind}`}>{importMsg.text}</div>}
        {rows && (
          <>
            <p><strong>{validRows.length}</strong> valid · {rows.filter((r) => r.status === 'duplicate').length} duplicate · {rows.filter((r) => r.status === 'invalid').length} invalid</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Result</th><th>Question</th><th>Problems</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.index}>
                    <td>{r.index + 1}</td>
                    <td style={{ color: r.status === 'valid' ? 'var(--correct)' : r.status === 'duplicate' ? 'var(--prompt)' : 'var(--incorrect)' }}>{r.status}</td>
                    <td className="small">{r.preview}</td>
                    <td className="small">{r.errors.map((e, i) => <div key={i}>{e}</div>)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div><button className="primary" disabled={validRows.length === 0} onClick={saveValid}>Save {validRows.length} valid row(s) as pending</button></div>
          </>
        )}
      </section>

      <section className="panel stack">
        <h2>2. Verification</h2>
        <p className="muted small">
          Upload <code>[{'{'}"id": "...", "answer": "..."{'}'}]</code> produced by answering the pending questions cold in a separate session.
          For bonuses, <code>answer</code> is an array with one answer per part. Matches become active; mismatches go to the review queue.
          Math questions always go to the queue unless the mathjs check passes and the key is simplified.
        </p>
        <JsonInput label="Cold answers JSON" value={coldText} onChange={setColdText} placeholder='[{"id":"imp-abc","answer":"Saturn"}]' />
        <div className="row"><button className="primary" disabled={!coldText.trim()} onClick={runVerify}>Run verification</button></div>
        {verifyMsg && <div className={`notice ${verifyMsg.kind}`}>{verifyMsg.text}</div>}
        {result && (
          <>
            {result.errors.length > 0 && <div className="notice error">{result.errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
            <p><strong>{matches.length}</strong> match · <strong>{queue.length}</strong> in the review queue</p>
            <div><button className="primary" disabled={matches.length === 0} onClick={activateMatches}>Activate {matches.length} match(es)</button></div>
          </>
        )}
      </section>

      {queue.length > 0 && (
        <section className="panel stack">
          <h2>Review queue ({queue.length})</h2>
          <p className="muted small">Questions you leave here stay pending. Re-upload cold answers to rebuild this list.</p>
          {queue.map((item) => (
            <div className="panel" key={item.question.id}>
              <div className="small muted">{item.question.id} · {item.question.category} / {item.question.subcategory}</div>
              <p>{item.question.type === 'tossup' ? item.question.text : item.question.leadin}</p>
              <table>
                <thead><tr><th>Part</th><th>Key</th><th>Cold answer</th><th /></tr></thead>
                <tbody>{item.parts.map((p, i) => (
                  <tr key={i}>
                    <td>{item.parts.length > 1 ? i + 1 : ''}</td>
                    <td><strong>{p.key}</strong></td>
                    <td>{p.cold || <em className="muted">(blank)</em>}</td>
                    <td className="small" style={{ color: p.ok ? 'var(--correct)' : 'var(--incorrect)' }}>{p.ok ? 'match' : p.note ?? 'mismatch'}</td>
                  </tr>
                ))}</tbody>
              </table>
              <div className="row" style={{ marginTop: '0.6rem' }}>
                <button className="primary" onClick={() => resolveQueued(item, 'active')}>Key is right — activate</button>
                <a href={`#/admin/edit/${encodeURIComponent(item.question.id)}`}>Edit</a>
                <button className="danger" onClick={() => resolveQueued(item, 'retired')}>Retire</button>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
