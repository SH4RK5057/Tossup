import { describe, expect, it } from 'vitest';
import batch from '../../batches/questions-batch-1.json';
import seed from '../../seed/questions.json';
import { check } from '../core/checker';
import { normalizeText } from '../core/normalize';
import { RULESETS } from '../core/rulesets';
import { answerSpecSchema, importRowSchema, questionSchema, type AnswerSpec, type ImportRow } from '../core/types';
import { validateImport } from './importLogic';

const existing = (seed as unknown[]).map((q) => questionSchema.parse(q));
const rows = batch as unknown[];
const opts = { nowIso: '2026-11-02T00:00:00.000Z', makeId: (i: number) => `b-${i}`, random: () => 0.5 };

function specsOf(r: ImportRow): { label: string; spec: AnswerSpec; text: string }[] {
  return r.type === 'tossup'
    ? [{ label: r.text, spec: answerSpecSchema.parse(r), text: r.text }]
    : r.parts.map((p, i) => ({ label: `${r.leadin} #${i + 1}`, spec: answerSpecSchema.parse(p), text: `${r.leadin} ${p.text}` }));
}

describe('batch 1 quality gates', () => {
  const parsed = rows.map((r) => importRowSchema.parse(r));

  it('rows carry an explicit difficulty tag with a spread of all three', () => {
    const counts: Record<string, number> = {};
    for (const r of rows as { difficulty?: string }[]) {
      expect(r.difficulty).toBeTruthy();
      counts[r.difficulty!] = (counts[r.difficulty!] ?? 0) + 1;
    }
    expect(Object.keys(counts).sort()).toEqual(['easy', 'hard', 'medium']);
  });

  it('every row passes the importer (schema, subject tree, no duplicates, none clash with the seed)', () => {
    const res = validateImport(rows, existing, opts);
    const bad = res.rows.filter((r) => r.status !== 'valid').map((r) => `${r.index}: ${r.status} ${r.preview} ${r.errors.join('; ')}`);
    expect(bad).toEqual([]);
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
    expect(failures).toEqual([]);
  });

  it('no answer key is given away by its own question text', () => {
    const leaks: string[] = [];
    for (const r of parsed) {
      for (const { label, spec, text } of specsOf(r)) {
        if (spec.answer_type === 'math') continue;
        const ans = normalizeText(spec.answer);
        if (ans.length < 4) continue;
        const body = ` ${normalizeText(text)} `;
        if (body.includes(` ${ans} `)) leaks.push(`${label.slice(0, 60)} -> ${spec.answer}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  it('no bonus part gives away another part', () => {
    const leaks: string[] = [];
    for (const r of parsed) {
      if (r.type !== 'bonus') continue;
      r.parts.forEach((p, i) => {
        const ans = normalizeText(p.answer);
        if (ans.length < 4 || p.answer_type === 'math') return;
        const others = ` ${normalizeText([r.leadin, ...r.parts.filter((_, j) => j !== i).map((x) => x.text)].join(' '))} `;
        if (others.includes(` ${ans} `)) leaks.push(`${r.leadin} part ${i + 1}: ${p.answer}`);
      });
    }
    expect(leaks).toEqual([]);
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
    expect(bad).toEqual([]);
  });

  it('no repeated answers within a ruleset, level and question type', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const r of parsed) {
      if (r.type !== 'tossup' || r.answer_type === 'math') continue;
      const key = `${r.rulesets[0]}|${r.level}|${normalizeText(r.answer)}`;
      if (seen.has(key)) dupes.push(`${r.answer} (${r.text.slice(0, 40)} / ${seen.get(key)!.slice(0, 40)})`);
      else seen.set(key, r.text);
    }
    expect(dupes).toEqual([]);
  });

  it('quizbowl tossups are pyramidal-style (end with "For 10 points") and bonuses have 3 parts', () => {
    for (const r of parsed) {
      if (r.rulesets[0] !== 'quizbowl') continue;
      if (r.type === 'tossup') expect(r.text, r.text.slice(0, 40)).toContain('For 10 points');
      else expect(r.parts.length, r.leadin).toBe(3);
    }
  });
});

describe('master import file', () => {
  it('imports cleanly: every row valid, none duplicated', async () => {
    const { default: master } = await import('../../batches/master-import.json');
    const res = validateImport(master, [], opts);
    const bad = res.rows.filter((r) => r.status !== 'valid').map((r) => `${r.index}: ${r.status} ${r.preview} ${r.errors.join('; ')}`);
    expect(bad).toEqual([]);
    expect(res.rows.length).toBe(78 + rows.length);
  });
});
