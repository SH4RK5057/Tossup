import { useEffect, useMemo, useState } from 'react';
import { RULESETS } from '../core/rulesets';
import { LEVELS, LEVEL_LABEL, RULESET_IDS, type Level, type Question, type RulesetId } from '../core/types';
import { useApp } from '../ui/context';
import { coldAnswerPrompt, generatePrompt } from './promptTemplates';

function PromptBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="stack">
      <textarea className="json" readOnly style={{ minHeight: 220 }} value={text} onFocus={(e) => e.currentTarget.select()} />
      <div className="row">
        <button className="primary" onClick={async () => {
          try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* select manually */ }
        }}>{copied ? 'Copied' : 'Copy prompt'}</button>
      </div>
    </div>
  );
}

/** Builds prompts to run manually in Claude. The site itself makes no AI calls. */
export function GeneratePage() {
  const { repo } = useApp();
  const [rulesetId, setRulesetId] = useState<RulesetId>('ncal');
  const [level, setLevel] = useState<Level>('novice');
  const [type, setType] = useState<'tossup' | 'bonus'>('tossup');
  const [category, setCategory] = useState('English');
  const [subcategory, setSubcategory] = useState('English Grammar');
  const [count, setCount] = useState(10);
  const [pending, setPending] = useState<Question[] | null>(null);

  const rs = RULESETS[rulesetId];
  const cat = rs.subjects.find((c) => c.name === category) ?? rs.subjects[0];
  useEffect(() => {
    repo.listQuestions().then((qs) => setPending(qs.filter((q) => q.status === 'pending')), () => setPending([]));
  }, [repo]);

  const gen = useMemo(
    () => generatePrompt({ rulesetId, level, type, category: cat.name, subcategory: subcategory || cat.subjects[0].name, count }),
    [rulesetId, level, type, cat, subcategory, count],
  );

  return (
    <div className="stack">
      <h1>Generate questions</h1>
      <p className="muted small">
        Workflow: copy a prompt, run it yourself in Claude, paste the JSON it returns into <a href="#/admin/import">Import &amp; verify</a>,
        then run a second, separate Claude session on the cold-answer prompt and upload those answers to verify. Nothing here calls an AI.
      </p>
      <section className="panel stack">
        <h2>1. Question prompt</h2>
        <div className="row">
          <select style={{ width: 150 }} value={rulesetId} onChange={(e) => {
            const id = e.target.value as RulesetId;
            setRulesetId(id); setCategory(RULESETS[id].subjects[0].name); setSubcategory(RULESETS[id].subjects[0].subjects[0].name);
          }}>{RULESET_IDS.map((r) => <option key={r} value={r}>{RULESETS[r].shortName}</option>)}</select>
          <select style={{ width: 120 }} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select>
          <select style={{ width: 120 }} value={type} onChange={(e) => setType(e.target.value as 'tossup' | 'bonus')}>
            <option value="tossup">Tossups</option><option value="bonus">Bonuses</option></select>
          <select style={{ width: 170 }} value={cat.name} onChange={(e) => { setCategory(e.target.value); setSubcategory(rs.subjects.find((c) => c.name === e.target.value)!.subjects[0].name); }}>
            {rs.subjects.map((c) => <option key={c.name}>{c.name}</option>)}</select>
          <select style={{ width: 200 }} value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
            {cat.subjects.map((s) => <option key={s.name}>{s.name}</option>)}</select>
          <label className="inline-check small">Count
            <input type="number" min={1} max={50} style={{ width: 80 }} value={count} onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))} /></label>
        </div>
        <PromptBox text={gen} />
      </section>
      <section className="panel stack">
        <h2>2. Cold-answer prompt ({pending?.length ?? '…'} pending)</h2>
        <p className="muted small">Questions only; answer keys are never included. Use a fresh Claude session.</p>
        {pending && pending.length > 0 ? <PromptBox text={coldAnswerPrompt(pending)} /> : <p className="muted">No pending questions. Import some first.</p>}
      </section>
    </div>
  );
}
