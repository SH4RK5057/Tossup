import { useEffect, useState } from 'react';
import { RULESETS } from '../core/rulesets';
import {
  ANSWER_TYPES, LEVELS, LEVEL_LABEL, RULESET_IDS, questionSchema, statusSchema,
  type AnswerSpec, type BonusPart, type Question, type Status,
} from '../core/types';
import type { QuestionVersion } from '../data/repository';
import { useApp } from '../ui/context';
import { formatDate } from '../ui/format';

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

/** Textarea of one entry per line. Keeps its own text so trailing newlines survive typing. */
function LinesField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join('\n'));
  useEffect(() => {
    setText((t) => (lines(t).join('\n') === value.join('\n') ? t : value.join('\n')));
  }, [value]);
  return (
    <label className="field"><span className="lbl">{label}</span>
      <textarea value={text} onChange={(e) => { setText(e.target.value); onChange(lines(e.target.value)); }} /></label>
  );
}

function SpecFields({ spec, onChange }: { spec: AnswerSpec; onChange: (next: AnswerSpec) => void }) {
  return (
    <div className="spec-grid">
      <label className="field"><span className="lbl">Answer (as displayed)</span>
        <input type="text" value={spec.answer} onChange={(e) => onChange({ ...spec, answer: e.target.value })} /></label>
      <label className="field"><span className="lbl">Required (minimum accepted portion)</span>
        <input type="text" value={spec.required ?? ''} onChange={(e) => onChange({ ...spec, required: e.target.value || null })} /></label>
      <LinesField label="Alternates (one per line)" value={spec.alternates} onChange={(v) => onChange({ ...spec, alternates: v })} />
      <LinesField label="Prompt on (one per line)" value={spec.prompt_on} onChange={(v) => onChange({ ...spec, prompt_on: v })} />
      <label className="field"><span className="lbl">Answer type</span>
        <select value={spec.answer_type} onChange={(e) => onChange({ ...spec, answer_type: e.target.value as AnswerSpec['answer_type'] })}>
          {ANSWER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select></label>
      <div className="field">
        <label className="inline-check"><input type="checkbox" checked={spec.duplicate_name} onChange={(e) => onChange({ ...spec, duplicate_name: e.target.checked })} /> Duplicate name (first name required)</label>
        <label className="inline-check"><input type="checkbox" checked={spec.accepts_partial_name} onChange={(e) => onChange({ ...spec, accepts_partial_name: e.target.checked })} /> Accepts partial name</label>
      </div>
    </div>
  );
}

const emptyPart = (): BonusPart => ({
  text: '', part_difficulty: 'medium', answer: '', required: null, alternates: [], prompt_on: [],
  answer_type: 'general', duplicate_name: false, accepts_partial_name: false,
});

interface Props {
  question: Question;
  onSaved: (q: Question) => void;
  onCancel?: () => void;
}

export function QuestionEditor({ question, onSaved, onCancel }: Props) {
  const { repo, user } = useApp();
  const [q, setQ] = useState<Question>(question);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<QuestionVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const editor = user?.email ?? user?.uid ?? 'admin';

  useEffect(() => { setQ(question); }, [question]);
  const loadVersions = () => repo.listVersions(question.id).then(setVersions, () => setVersions([]));
  useEffect(() => { void loadVersions(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [question.id]);

  const patch = (p: Partial<Question>) => setQ({ ...q, ...p } as Question);

  const save = async () => {
    const parsed = questionSchema.safeParse(q);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => `${i.path.join('.') || 'question'}: ${i.message}`));
      return;
    }
    const subjectErrors: string[] = [];
    for (const rid of parsed.data.rulesets) {
      const cat = RULESETS[rid].subjects.find((c) => c.name === parsed.data.category);
      if (!cat) subjectErrors.push(`Category "${parsed.data.category}" is not in the ${RULESETS[rid].shortName} subject tree`);
      else if (!cat.subjects.some((s) => s.name === parsed.data.subcategory)) {
        subjectErrors.push(`Subcategory "${parsed.data.subcategory}" is not under ${cat.name} in ${RULESETS[rid].shortName}`);
      }
    }
    if (subjectErrors.length) { setErrors(subjectErrors); return; }
    setErrors([]);
    setSaving(true);
    try {
      const saved = await repo.saveQuestion(parsed.data, editor);
      setMessage('Saved. Players see the edit on their next session load.');
      onSaved(saved);
      void loadVersions();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    } finally {
      setSaving(false);
    }
  };

  const revert = async (v: QuestionVersion) => {
    if (!confirm(`Revert to the version saved ${formatDate(v.saved_at)} by ${v.editor}? The current version is kept in history.`)) return;
    try {
      const saved = await repo.revertToVersion(q.id, v.id, editor);
      setQ(saved);
      onSaved(saved);
      setMessage('Reverted.');
      void loadVersions();
    } catch (e) {
      setErrors([e instanceof Error ? e.message : String(e)]);
    }
  };

  const category = RULESETS[q.rulesets[0] ?? 'ncal'].subjects;
  const subs = category.find((c) => c.name === q.category)?.subjects ?? [];

  return (
    <div className="stack">
      <div className="row">
        <h2 style={{ margin: 0 }}>Edit {q.type}</h2>
        <code className="small muted">{q.id}</code>
        <span style={{ flex: 1 }} />
        <label className="row"><span className="lbl small muted">Status</span>
          <select style={{ width: 130 }} value={q.status} onChange={(e) => patch({ status: e.target.value as Status })}>
            {statusSchema.options.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></label>
      </div>

      <div className="spec-grid">
        <div className="field"><span className="lbl">Rulesets</span>
          <div className="row">{RULESET_IDS.map((r) => (
            <label key={r} className="inline-check"><input type="checkbox" checked={q.rulesets.includes(r)}
              onChange={(e) => patch({ rulesets: e.target.checked ? [...q.rulesets, r] : q.rulesets.filter((x) => x !== r) })} />{RULESETS[r].shortName}</label>
          ))}</div></div>
        <label className="field"><span className="lbl">Level</span>
          <select value={q.level} onChange={(e) => patch({ level: e.target.value as Question['level'] })}>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select></label>
        <label className="field"><span className="lbl">Category</span>
          <input type="text" list="cats" value={q.category} onChange={(e) => patch({ category: e.target.value })} />
          <datalist id="cats">{category.map((c) => <option key={c.name} value={c.name} />)}</datalist></label>
        <label className="field"><span className="lbl">Subcategory</span>
          <input type="text" list="subs" value={q.subcategory} onChange={(e) => patch({ subcategory: e.target.value })} />
          <datalist id="subs">{subs.map((s) => <option key={s.name} value={s.name} />)}</datalist></label>
        <label className="field"><span className="lbl">Source</span>
          <input type="text" value={q.source} onChange={(e) => patch({ source: e.target.value })} /></label>
        <label className="field"><span className="lbl">Expires (current events)</span>
          <input type="text" placeholder="YYYY-MM-DD or empty" value={q.expires_at ? q.expires_at.slice(0, 10) : ''}
            onChange={(e) => {
              const v = e.target.value.trim();
              patch({ expires_at: v === '' ? null : /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : q.expires_at });
            }} /></label>
      </div>

      {q.type === 'tossup' ? (
        <>
          <label className="field"><span className="lbl">Question text</span>
            <textarea style={{ minHeight: 140 }} value={q.text} onChange={(e) => patch({ text: e.target.value })} /></label>
          <SpecFields spec={q} onChange={(spec) => setQ({ ...q, ...spec })} />
        </>
      ) : (
        <>
          <label className="field"><span className="lbl">Lead-in</span>
            <textarea value={q.leadin} onChange={(e) => patch({ leadin: e.target.value })} /></label>
          {q.parts.map((p, i) => (
            <div className="panel" key={i}>
              <div className="row">
                <strong>Part {i + 1}</strong>
                <select style={{ width: 120 }} value={p.part_difficulty}
                  onChange={(e) => setQ({ ...q, parts: q.parts.map((x, j) => (j === i ? { ...x, part_difficulty: e.target.value as BonusPart['part_difficulty'] } : x)) })}>
                  <option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option>
                </select>
                <span style={{ flex: 1 }} />
                <button className="danger" disabled={q.parts.length <= 3} onClick={() => setQ({ ...q, parts: q.parts.filter((_, j) => j !== i) })}>Remove</button>
              </div>
              <label className="field"><span className="lbl">Text</span>
                <textarea value={p.text} onChange={(e) => setQ({ ...q, parts: q.parts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} /></label>
              <SpecFields spec={p} onChange={(spec) => setQ({ ...q, parts: q.parts.map((x, j) => (j === i ? { ...x, ...spec } : x)) })} />
            </div>
          ))}
          <div><button disabled={q.parts.length >= 5} onClick={() => setQ({ ...q, parts: [...q.parts, emptyPart()] })}>Add part</button></div>
        </>
      )}

      {errors.length > 0 && <div className="notice error">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      {message && <div className="notice ok">{message}</div>}

      <div className="row">
        <button className="primary" disabled={saving} onClick={save}>Save (snapshots the current version first)</button>
        {onCancel && <button onClick={onCancel}>Close</button>}
        <button className="link" onClick={() => setShowVersions(!showVersions)}>Version history ({versions.length})</button>
      </div>

      {showVersions && (
        <div className="panel">
          <h3>Version history</h3>
          {versions.length === 0 ? <p className="muted">No earlier versions.</p> : (
            <table>
              <thead><tr><th>Saved</th><th>By</th><th>Status</th><th>Text</th><th /></tr></thead>
              <tbody>{versions.map((v) => (
                <tr key={v.id}>
                  <td>{formatDate(v.saved_at)}</td><td className="small">{v.editor}</td><td>{v.snapshot.status}</td>
                  <td className="small">{(v.snapshot.type === 'tossup' ? v.snapshot.text : v.snapshot.leadin).slice(0, 70)}…</td>
                  <td><button onClick={() => revert(v)}>Revert</button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
