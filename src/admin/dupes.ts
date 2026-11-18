// Duplicate detection for questions: identical text, and near-identical (reworded) text.
// Pure; used by the bank quality gates, a CLI report, and (later) the importer against the live bank.

import { normalizeText } from '../core/normalize';

export interface DupItem {
  /** Where the item came from, for reports (e.g. "bank#12"). */
  where: string;
  ruleset: string;
  subcategory: string;
  text: string;
  answer: string;
  /** Computed math questions share templates by design: exact duplicates only. */
  math: boolean;
}

interface Prepared extends DupItem {
  norm: string;
  ans: string;
  words: Set<string>;
}

const STOP = new Set([
  'what', 'which', 'is', 'the', 'a', 'an', 'of', 'in', 'to', 'and', 'for', 'name', 'this', 'that', 'by', 'as', 'on', 'it', 'its',
  'with', 'are', 'was', 'be', 'term', 'names', 'word', 'who', 'does', 'do', 'called', 'from', 'at', 'or', 'his', 'her', 'their',
  'one', 'points', '10',
]);

function prepare(it: DupItem): Prepared {
  const norm = normalizeText(it.text);
  return {
    ...it, norm, ans: normalizeText(it.answer),
    words: new Set(norm.split(' ').filter((w) => w.length > 2 && !STOP.has(w))),
  };
}

export interface DupReport {
  exact: string[];
  near: string[];
}

/**
 * `existing` items are only compared against `fresh` items and each other's exact text is not reported
 * (so a large live bank is not re-audited). Pass `existing = []` to audit a single set.
 */
export function findDuplicates(fresh: DupItem[], existing: DupItem[] = []): DupReport {
  const all = [...existing.map(prepare), ...fresh.map(prepare)];
  const firstFresh = existing.length;
  const exact: string[] = [];
  const seen = new Map<string, Prepared>();
  all.forEach((it, i) => {
    const prev = seen.get(it.norm);
    if (prev && i >= firstFresh) exact.push(`${prev.where} == ${it.where}: ${it.text.slice(0, 80)}`);
    else if (!prev) seen.set(it.norm, it);
  });

  const groups = new Map<string, { it: Prepared; idx: number }[]>();
  all.forEach((it, idx) => {
    if (it.math) return;
    const k = `${it.ruleset}|${it.subcategory}`;
    const list = groups.get(k) ?? [];
    list.push({ it, idx });
    groups.set(k, list);
  });
  const near: string[] = [];
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (list[j].idx < firstFresh) continue; // both existing: not audited here
        const a = list[i].it;
        const b = list[j].it;
        if (a.norm === b.norm || a.words.size < 3 || b.words.size < 3) continue;
        let inter = 0;
        for (const w of a.words) if (b.words.has(w)) inter++;
        const jac = inter / (a.words.size + b.words.size - inter);
        if (jac >= 0.85 || (a.ans === b.ans && jac >= 0.55)) {
          near.push(`${a.where} ~ ${b.where} (${jac.toFixed(2)}): ${a.text.slice(0, 60)} / ${b.text.slice(0, 60)}`);
        }
      }
    }
  }
  return { exact, near };
}

/** Flattens importer-format rows (tossups and each bonus part) into duplicate-check items. */
export function toDupItems(rows: Record<string, unknown>[], prefix: string): DupItem[] {
  const out: DupItem[] = [];
  rows.forEach((r, i) => {
    const base = { ruleset: String((r.rulesets as string[])[0]), subcategory: String(r.subcategory) };
    if (r.type === 'tossup') {
      out.push({ ...base, where: `${prefix}#${i}`, text: String(r.text), answer: String(r.answer), math: r.answer_type === 'math' });
    } else {
      (r.parts as { text: string; answer: string; answer_type?: string }[]).forEach((p, j) => {
        out.push({ ...base, where: `${prefix}#${i}.${j + 1}`, text: p.text, answer: p.answer, math: p.answer_type === 'math' });
      });
    }
  });
  return out;
}
