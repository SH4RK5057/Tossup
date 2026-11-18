import { describe, expect, it } from 'vitest';
import batch1 from '../../batches/questions-batch-1.json';
import seed from '../../seed/questions.json';
import { check } from '../core/checker';
import { normalizeText } from '../core/normalize';
import { RULESETS } from '../core/rulesets';
import { answerSpecSchema, importRowSchema, questionSchema, type AnswerSpec, type ImportRow } from '../core/types';
import { validateImport } from './importLogic';

// Every compiled bank file (scripts/bank/build.mjs writes batches/bank-<ruleset>-<level>.json).
const files = import.meta.glob('../../batches/bank-*.json', { eager: true, import: 'default' }) as Record<string, unknown[]>;
const rows = Object.values(files).flat();
const existing = (seed as unknown[]).map((q) => questionSchema.parse(q));
const opts = { nowIso: '2026-11-02T00:00:00.000Z', makeId: (i: number) => `b-${i}`, random: () => 0.5 };

type Part = { label: string; spec: AnswerSpec; text: string };
function specsOf(r: ImportRow): Part[] {
  return r.type === 'tossup'
    ? [{ label: r.text, spec: answerSpecSchema.parse(r), text: r.text }]
    : r.parts.map((p, i) => ({ label: `${r.leadin} #${i + 1}`, spec: answerSpecSchema.parse(p), text: `${r.leadin} ${p.text}` }));
}

describe(`question bank quality gates (${rows.length} rows)`, () => {
  const parsed = rows.map((r) => importRowSchema.parse(r));

  it('every row passes the importer; none duplicates the seed, batch 1, or another bank row', () => {
    const res = validateImport([...(batch1 as unknown[]), ...rows], existing, opts);
    const bad = res.rows.slice((batch1 as unknown[]).length)
      .filter((r) => r.status !== 'valid').map((r) => `${r.index}: ${r.status} ${r.preview} ${r.errors.join('; ')}`);
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it('the checker accepts every answer key and alternate under its ruleset', () => {
    const failures: string[] = [];
    for (const r of parsed) {
      const rs = RULESETS[r.rulesets[0]];
      for (const { label, spec } of specsOf(r)) {
        for (const a of [spec.answer, ...spec.alternates]) {
          if (check(a, spec, rs) !== 'correct') failures.push(`${label.slice(0, 50)} -> ${a}`);
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  });

  it('no answer is given away by its own question, and no bonus part gives away another', () => {
    const leaks: string[] = [];
    rows.forEach((raw, ri) => {
      const r = parsed[ri];
      const rawParts = (r.type === 'tossup' ? [raw] : (raw as { parts: unknown[] }).parts) as { _leakOk?: boolean }[];
      specsOf(r).forEach(({ label, spec, text }, pi) => {
        if (spec.answer_type === 'math' || rawParts[pi]?._leakOk) return;
        const ans = normalizeText(spec.answer);
        if (ans.length < 4) return;
        if (` ${normalizeText(text)} `.includes(` ${ans} `)) leaks.push(`${label.slice(0, 60)} -> ${spec.answer}`);
      });
      if (r.type === 'bonus') {
        r.parts.forEach((p, i) => {
          const ans = normalizeText(p.answer);
          if (ans.length < 4 || p.answer_type === 'math' || (rawParts[i] as { _leakOk?: boolean })._leakOk) return;
          const others = ` ${normalizeText([r.leadin, ...r.parts.filter((_, j) => j !== i).map((x) => x.text)].join(' '))} `;
          if (others.includes(` ${ans} `)) leaks.push(`${r.leadin} part ${i + 1}: ${p.answer}`);
        });
      }
    });
    expect(leaks.slice(0, 20)).toEqual([]);
  });

  it('name answers: "required" appears in the answer or an alternate', () => {
    const bad: string[] = [];
    for (const r of parsed) {
      for (const { label, spec } of specsOf(r)) {
        if (spec.answer_type !== 'name' || !spec.required) continue;
        const req = normalizeText(spec.required);
        const pool = [spec.answer, ...spec.alternates].map((a) => ` ${normalizeText(a)} `);
        if (!pool.some((p) => p.includes(` ${req} `))) bad.push(`${label.slice(0, 50)} -> ${spec.required}`);
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it('no answer repeats more than twice within a ruleset, level, subject and type (non-math)', () => {
    const counts = new Map<string, number>();
    const over: string[] = [];
    for (const r of parsed) {
      if (r.type !== 'tossup' || r.answer_type === 'math') continue;
      const key = `${r.rulesets[0]}|${r.level}|${r.subcategory}|${normalizeText(r.answer)}`;
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      if (n === 3) over.push(key);
    }
    expect(over.slice(0, 20)).toEqual([]);
  });

  it('formats: quizbowl tossups are pyramidal, bonuses have the right part counts, NCAL tossups are short', () => {
    const bad: string[] = [];
    for (const r of parsed) {
      const qb = r.rulesets[0] === 'quizbowl';
      if (r.type === 'tossup') {
        if (qb && !r.text.includes('For 10 points')) bad.push(`QB tossup lacks "For 10 points": ${r.text.slice(0, 50)}`);
        if (!qb && r.text.length > 320) bad.push(`NCAL tossup too long: ${r.text.slice(0, 50)}`);
      } else if (qb && r.parts.length !== 3) bad.push(`QB bonus needs 3 parts: ${r.leadin}`);
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it('answers and question text spell out abbreviations (Mount, Saint, Fort, Doctor, versus...)', () => {
    const ABBR = /\b(Mt|St|Ft|Mr|Mrs|vs|Gen|Sgt|Capt|Lt|Gov|Sen|Prof|Rev|Ave|Blvd|Rd|Lk|Dept|Univ)\.(?!\w)/;
    const bad: string[] = [];
    for (const r of parsed) {
      const text = r.type === 'tossup' ? [r.text] : [r.leadin, ...r.parts.map((p) => p.text)];
      const answers = specsOf(r).map((p) => p.spec.answer);
      for (const s of [...text, ...answers]) if (ABBR.test(s)) bad.push(s.slice(0, 70));
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });
});
