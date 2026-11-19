// Quality gates for importer-format question rows. Used by the bank test and by the CLI that the
// question writers run (scripts/bank/check.ts). Pure.

import { check } from '../core/checker';
import { normalizeText } from '../core/normalize';
import { RULESETS } from '../core/rulesets';
import { answerSpecSchema, importRowSchema, type AnswerSpec, type ImportRow } from '../core/types';
import { findDuplicates, toDupItems } from './dupes';
import { subjectErrors } from './importLogic';

type Raw = Record<string, unknown>;
export interface CheckResult { name: string; problems: string[] }

interface Part { label: string; spec: AnswerSpec; text: string; leakOk: boolean }

function partsOf(r: ImportRow, raw: Raw): Part[] {
  if (r.type === 'tossup') {
    return [{ label: r.text, spec: answerSpecSchema.parse(r), text: r.text, leakOk: Boolean(raw._leakOk) }];
  }
  const rawParts = raw.parts as { _leakOk?: boolean }[];
  return r.parts.map((p, i) => ({
    label: `${r.leadin} #${i + 1}`, spec: answerSpecSchema.parse(p), text: `${r.leadin} ${p.text}`, leakOk: Boolean(rawParts[i]?._leakOk),
  }));
}

const ABBR = /\b(Mt|St|Ft|Mr|Mrs|vs|Gen|Sgt|Capt|Lt|Gov|Sen|Prof|Rev|Ave|Blvd|Rd|Lk|Dept|Univ)\.(?!\w)/;

/** Runs every gate. `existing` is importer-format rows already in the bank (seed, batch 1, other files). */
export function runBankChecks(rows: Raw[], existing: Raw[] = [], limit = 25): CheckResult[] {
  const out: CheckResult[] = [];
  const add = (name: string, problems: string[]) => out.push({ name, problems: problems.slice(0, limit) });

  // 1. schema + subject tree
  const parsed: ImportRow[] = [];
  const valid: Raw[] = [];
  const schema: string[] = [];
  rows.forEach((r, i) => {
    const p = importRowSchema.safeParse(r);
    if (!p.success) { schema.push(`row ${i}: ${p.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ')}`); return; }
    const sub = subjectErrors(p.data);
    if (sub.length) { schema.push(`row ${i}: ${sub.join('; ')}`); return; }
    parsed.push(p.data);
    valid.push(r);
  });
  add('schema and subject tree', schema);

  // 2. checker accepts every key and alternate
  const keys: string[] = [];
  valid.forEach((raw, i) => {
    const r = parsed[i];
    const rs = RULESETS[r.rulesets[0]];
    for (const { label, spec } of partsOf(r, raw)) {
      for (const a of [spec.answer, ...spec.alternates]) {
        if (check(a, spec, rs) !== 'correct') keys.push(`${label.slice(0, 60)} -> ${a}`);
      }
    }
  });
  add('the checker accepts every answer key and alternate', keys);

  // 3. leaks
  const leaks: string[] = [];
  valid.forEach((raw, i) => {
    const r = parsed[i];
    const parts = partsOf(r, raw);
    parts.forEach(({ label, spec, text, leakOk }) => {
      if (spec.answer_type === 'math' || leakOk) return;
      const ans = normalizeText(spec.answer);
      if (ans.length < 4) return;
      if (` ${normalizeText(text)} `.includes(` ${ans} `)) leaks.push(`answer appears in its own question: ${label.slice(0, 60)} -> ${spec.answer}`);
    });
    if (r.type === 'bonus') {
      r.parts.forEach((p, j) => {
        const ans = normalizeText(p.answer);
        if (ans.length < 4 || p.answer_type === 'math' || parts[j].leakOk) return;
        const others = ` ${normalizeText([r.leadin, ...r.parts.filter((_, k) => k !== j).map((x) => x.text)].join(' '))} `;
        if (others.includes(` ${ans} `)) leaks.push(`bonus part gives away another: ${r.leadin} part ${j + 1}: ${p.answer}`);
      });
    }
  });
  add('no answer is given away by its question or by another bonus part (use opts "ok" if the answer legitimately appears)', leaks);

  // 4. names
  const names: string[] = [];
  valid.forEach((raw, i) => {
    for (const { label, spec } of partsOf(parsed[i], raw)) {
      if (spec.answer_type !== 'name' || !spec.required) continue;
      const req = normalizeText(spec.required);
      const pool = [spec.answer, ...spec.alternates].map((a) => ` ${normalizeText(a)} `);
      if (!pool.some((p) => p.includes(` ${req} `))) names.push(`${label.slice(0, 50)} -> required "${spec.required}" is not in the answer`);
    }
  });
  add('name answers: "required" appears in the answer or an alternate', names);

  // 5. answer repeats
  const counts = new Map<string, number>();
  const repeats: string[] = [];
  parsed.forEach((r) => {
    if (r.type !== 'tossup' || r.answer_type === 'math') return;
    const key = `${r.rulesets[0]}|${r.level}|${r.subcategory}|${normalizeText(r.answer)}`;
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    if (n === 3) repeats.push(`answer used 3+ times in one subject and level: ${key}`);
  });
  add('no answer repeats more than twice within a ruleset, level, subject (non-math tossups)', repeats);

  // 6. formats
  const formats: string[] = [];
  parsed.forEach((r) => {
    const qb = r.rulesets[0] === 'quizbowl';
    if (r.type === 'tossup') {
      if (qb && !r.text.includes('For 10 points')) formats.push(`quizbowl tossup lacks "For 10 points": ${r.text.slice(0, 50)}`);
      if (qb && r.text.length < 180) formats.push(`quizbowl tossup too short to be pyramidal (${r.text.length} chars): ${r.text.slice(0, 50)}`);
      if (!qb && r.text.length > 320) formats.push(`NCAL tossup too long: ${r.text.slice(0, 50)}`);
    } else if (qb && r.parts.length !== 3) formats.push(`quizbowl bonus needs exactly 3 parts: ${r.leadin}`);
  });
  add('formats: quizbowl tossups are pyramidal, quizbowl bonuses have 3 parts, NCAL tossups are short', formats);

  // 7. abbreviations
  const abbr: string[] = [];
  parsed.forEach((r, i) => {
    const text = r.type === 'tossup' ? [r.text] : [r.leadin, ...r.parts.map((p) => p.text)];
    for (const s of [...text, ...partsOf(r, valid[i]).map((p) => p.spec.answer)]) if (ABBR.test(s)) abbr.push(s.slice(0, 70));
  });
  add('abbreviations are spelled out (Mount, Saint, Fort, versus...)', abbr);

  // 8. duplicates
  const dupes = findDuplicates(toDupItems(valid, 'new'), toDupItems(existing, 'old'));
  add('no identical question text', dupes.exact);
  add('no near-identical (reworded) questions', dupes.near);

  // 9. difficulty spread per cell (cells with at least 20 questions)
  const cells = new Map<string, { e: number; m: number; h: number }>();
  parsed.forEach((r) => {
    const k = `${r.rulesets[0]} ${r.level} | ${r.category} | ${r.subcategory}`;
    const c = cells.get(k) ?? { e: 0, m: 0, h: 0 };
    if (r.difficulty === 'easy') c.e++; else if (r.difficulty === 'hard') c.h++; else c.m++;
    cells.set(k, c);
  });
  const spread: string[] = [];
  for (const [k, c] of cells) {
    const n = c.e + c.m + c.h;
    if (n >= 20 && (c.e / n < 0.15 || c.h / n < 0.1 || c.m / n < 0.15)) spread.push(`${k}: easy ${c.e}, medium ${c.m}, hard ${c.h}`);
  }
  add('difficulty spread: each subject has at least 15% easy, 15% medium, 10% hard', spread);

  return out;
}
