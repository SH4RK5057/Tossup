import { useMemo, useState } from 'react';
import { RULESETS } from '../core/rulesets';
import { LEVELS, LEVEL_LABEL, RULESET_IDS, type Question, type RulesetId } from '../core/types';
import { localStore } from '../storage/storage';
import { buildPlan, planLabel, type PlanOptions } from './planLogic';
import { generatePrompt, masterPrompt } from './promptTemplates';

const PLAN_KEY = 'tossup.genplan.v1';

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

/** Whole-bank plan: every ruleset, level and subject, in prompt-sized chunks. */
export function BulkPlan({ bank }: { bank: Question[] }) {
  const saved = localStore.get<{ index?: number }>(PLAN_KEY, {});
  const [total, setTotal] = useState(10000);
  const [bonusShare, setBonusShare] = useState(0.2);
  const [tossupChunk, setTossupChunk] = useState(30);
  const [bonusChunk, setBonusChunk] = useState(10);
  const [rulesets, setRulesets] = useState<RulesetId[]>([...RULESET_IDS]);
  const [index, setIndex] = useState(saved.index ?? 0);
  const [tasks, setTasks] = useState(10);

  const plan = useMemo(() => {
    const opts: PlanOptions = { total, rulesets, levels: [...LEVELS], bonusShare, tossupChunk, bonusChunk };
    return buildPlan(opts);
  }, [total, rulesets, bonusShare, tossupChunk, bonusChunk]);

  const i = Math.min(index, Math.max(0, plan.length - 1));
  const item = plan[i];
  const go = (n: number) => {
    const next = Math.max(0, Math.min(plan.length - 1, n));
    setIndex(next);
    localStore.set(PLAN_KEY, { index: next });
  };

  const summary = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of plan) {
      const k = `${RULESETS[p.rulesetId].shortName} ${LEVEL_LABEL[p.level]}`;
      m.set(k, (m.get(k) ?? 0) + p.count);
    }
    return [...m.entries()];
  }, [plan]);

  const avoid = useMemo(() => {
    if (!item) return [];
    const answers = bank
      .filter((q) => q.rulesets.includes(item.rulesetId) && q.subcategory === item.subcategory && q.level === item.level)
      .map((q) => (q.type === 'tossup' ? q.answer : q.parts.map((p) => p.answer).join(' / ')));
    return [...new Set(answers)].slice(0, 120);
  }, [bank, item]);

  const text = item
    ? generatePrompt({
        rulesetId: item.rulesetId, level: item.level, type: item.type, category: item.category,
        subcategory: item.subcategory, count: item.count, avoidAnswers: avoid,
      })
    : '';

  return (
    <section className="panel stack">
      <h2>Bulk plan: every category</h2>
      <p className="muted small">
        One chat reply holds only a few dozen questions, so a big bank is a long run. This splits the target evenly across rulesets and levels, then by
        subject, into prompt-sized chunks. Current Events is skipped (it goes stale). Duplicates are skipped by the importer, and each prompt lists the
        answers already in your bank for that subject so Claude avoids them.
      </p>
      <div className="row">
        <label className="inline-check small">Total questions
          <input type="number" min={100} step={100} style={{ width: 110 }} value={total}
            onChange={(e) => setTotal(Math.max(100, Number(e.target.value) || 100))} /></label>
        <label className="inline-check small">Bonus share
          <input type="number" min={0} max={90} style={{ width: 70 }} value={Math.round(bonusShare * 100)}
            onChange={(e) => setBonusShare(Math.min(0.9, Math.max(0, (Number(e.target.value) || 0) / 100)))} />%</label>
        <label className="inline-check small">Tossups per prompt
          <input type="number" min={5} max={60} style={{ width: 70 }} value={tossupChunk}
            onChange={(e) => setTossupChunk(Math.max(5, Number(e.target.value) || 30))} /></label>
        <label className="inline-check small">Bonuses per prompt
          <input type="number" min={3} max={30} style={{ width: 70 }} value={bonusChunk}
            onChange={(e) => setBonusChunk(Math.max(3, Number(e.target.value) || 10))} /></label>
        {RULESET_IDS.map((r) => (
          <label key={r} className="inline-check small">
            <input type="checkbox" checked={rulesets.includes(r)} onChange={(e) => {
              const next = e.target.checked ? [...rulesets, r] : rulesets.filter((x) => x !== r);
              if (next.length) setRulesets(next);
            }} />{RULESETS[r].shortName}</label>
        ))}
      </div>
      <p>
        <strong>{plan.length}</strong> prompts for <strong>{plan.reduce((s, p) => s + p.count, 0).toLocaleString()}</strong> questions.{' '}
        {summary.map(([k, n]) => `${k}: ${n}`).join(' · ')}
      </p>

      {item && (
        <>
          <div className="row">
            <button disabled={i === 0} onClick={() => go(i - 1)}>← Previous</button>
            <strong>Prompt {i + 1} of {plan.length}</strong>
            <button className="primary" disabled={i >= plan.length - 1} onClick={() => go(i + 1)}>Next →</button>
            <label className="inline-check small">Jump to
              <input type="number" min={1} max={plan.length} style={{ width: 80 }} value={i + 1}
                onChange={(e) => go((Number(e.target.value) || 1) - 1)} /></label>
          </div>
          <p className="small muted">
            {planLabel(item)}{avoid.length ? ` · avoiding ${avoid.length} existing answers` : ''}. Your place is remembered on this device.
          </p>
          <PromptBox text={text} />
          <p className="muted small">
            Paste Claude's JSON into Import &amp; verify. You can paste several replies back to back; they are merged into one list.
          </p>
        </>
      )}

      <details>
        <summary>One prompt for a whole chat (works through tasks as you type "next")</summary>
        <div className="stack" style={{ marginTop: '0.75rem' }}>
          <label className="inline-check small">Tasks in this chat
            <input type="number" min={1} max={40} style={{ width: 70 }} value={tasks}
              onChange={(e) => setTasks(Math.max(1, Number(e.target.value) || 10))} /></label>
          <p className="muted small">
            Starts at prompt {i + 1}. Long chats lose track, so keep it to about 10 tasks, then start a fresh chat and use Next or Jump to continue.
          </p>
          <PromptBox text={masterPrompt(plan, i, tasks)} />
        </div>
      </details>
    </section>
  );
}
