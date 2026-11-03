import { describe, expect, it } from 'vitest';
import seed from '../../seed/questions.json';
import { questionSchema, type Question } from '../core/types';
import { validateImport } from './importLogic';
import { isSimplified, mathCheck, verifyCold } from './verifyLogic';

const existing: Question[] = (seed as unknown[]).map((q) => questionSchema.parse(q));
const opts = { nowIso: '2026-11-02T00:00:00.000Z', makeId: (i: number) => `imp-${i}`, random: () => 0.5 };

const tossup = (over: Record<string, unknown> = {}) => ({
  type: 'tossup', rulesets: ['ncal'], level: 'novice', category: 'Math', subcategory: 'Geometry',
  text: 'How many sides does a hexagon have?', answer: '6', answer_type: 'math', ...over,
});

describe('importer validation', () => {
  it('saves valid rows as pending with generated fields', () => {
    const { rows } = validateImport([tossup()], existing, opts);
    expect(rows[0].status).toBe('valid');
    expect(rows[0].question).toMatchObject({ status: 'pending', id: 'imp-0', report_count: 0, source: 'import' });
  });
  it('reports per-row schema errors', () => {
    const { rows } = validateImport([tossup({ level: 'expert' }), tossup({ text: '' }), 42], existing, opts);
    expect(rows.map((r) => r.status)).toEqual(['invalid', 'invalid', 'invalid']);
    expect(rows[0].errors.join()).toContain('level');
  });
  it('rejects subjects missing from the ruleset tree', () => {
    const { rows } = validateImport([tossup({ category: 'Underwater Basket Weaving' }), tossup({ subcategory: 'Nope', text: 'x?' })], existing, opts);
    expect(rows[0].errors[0]).toContain('subject tree');
    expect(rows[1].errors[0]).toContain('subcategory');
  });
  it('skips duplicates of existing questions and earlier rows (normalized text)', () => {
    const dupExisting = tossup({ text: 'SIMPLIFY the fraction six-twelfths, to lowest terms!' });
    const { rows } = validateImport([dupExisting, tossup({ text: 'A brand new question about angles?' }), tossup({ text: 'a brand new question about angles' })], existing, opts);
    expect(rows.map((r) => r.status)).toEqual(['duplicate', 'valid', 'duplicate']);
  });
  it('requires a JSON array', () => {
    expect(validateImport({}, existing, opts).fatal).toBeTruthy();
  });
  it('validates bonus part counts', () => {
    const part = { text: 'p?', part_difficulty: 'easy', answer: 'a' };
    const bonus = { type: 'bonus', rulesets: ['quizbowl'], level: 'jv', category: 'Science', subcategory: 'Biology', leadin: 'Lead' };
    const rows = validateImport([{ ...bonus, parts: [part, part] }, { ...bonus, leadin: 'Lead 2', parts: [part, part, part] }], existing, opts).rows;
    expect(rows.map((r) => r.status)).toEqual(['invalid', 'valid']);
  });
});

describe('math check', () => {
  it('recognizes simplified keys', () => {
    expect(isSimplified('1/2')).toBe(true);
    expect(isSimplified('2/4')).toBe(false);
    expect(isSimplified('12')).toBe(true);
    expect(isSimplified('2x')).toBe(true);
    expect(isSimplified('1/sqrt(2)')).toBe(false);
  });
  it('passes when values match and the key is simplified', () => {
    expect(mathCheck('1/2', '0.5').pass).toBe(true);
    expect(mathCheck('1/2', '2/4').pass).toBe(true);
    expect(mathCheck('12', '12 degrees').pass).toBe(true);
    expect(mathCheck('2x', '2*x').pass).toBe(true);
  });
  it('fails on different values or unsimplified keys', () => {
    expect(mathCheck('1/2', '1/3').pass).toBe(false);
    expect(mathCheck('2/4', '1/2').pass).toBe(false);
  });
});

describe('cold verification', () => {
  const pending = existing.map((q) => ({ ...q, status: 'pending' as const }));
  const t = pending.find((q) => q.id === 'seed-ncal-novice-t01')!;
  const m = pending.find((q) => q.id === 'seed-ncal-novice-t04')!; // 1/2, math
  const b = pending.find((q) => q.id === 'seed-ncal-novice-b01')!;

  it('matches go active, mismatches are queued', () => {
    const r = verifyCold(pending, [
      { id: t.id, answer: 'adjective' },
      { id: 'seed-ncal-novice-t02', answer: 'metaphor' },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.items.map((i) => i.outcome)).toEqual(['match', 'queue']);
  });
  it('math questions pass only via the math check', () => {
    const ok = verifyCold(pending, [{ id: m.id, answer: '0.5' }]);
    expect(ok.items[0].outcome).toBe('match'); // checker says no (form), math check says yes
    const bad = verifyCold(pending, [{ id: m.id, answer: '1/3' }]);
    expect(bad.items[0].outcome).toBe('queue');
    const unsimplified = verifyCold([{ ...m, answer: '2/4' } as Question], [{ id: m.id, answer: '2/4' }]);
    expect(unsimplified.items[0].outcome).toBe('queue'); // exact match, but math always needs a passing math check
  });
  it('bonuses take one answer per part', () => {
    const answers = b.type === 'bonus' ? b.parts.map((p) => p.answer) : [];
    expect(verifyCold(pending, [{ id: b.id, answer: answers }]).items[0].outcome).toBe('match');
    expect(verifyCold(pending, [{ id: b.id, answer: ['x', 'y', 'z'] }]).items[0].outcome).toBe('queue');
    expect(verifyCold(pending, [{ id: b.id, answer: 'one answer' }]).errors).toHaveLength(1);
  });
  it('rejects unknown, non-pending, and duplicate ids', () => {
    const r = verifyCold(pending, [{ id: 'nope', answer: 'x' }, { id: t.id, answer: 'adjective' }, { id: t.id, answer: 'adjective' }, { bad: 1 }]);
    expect(r.errors).toHaveLength(3);
    expect(verifyCold(existing, [{ id: t.id, answer: 'adjective' }]).errors).toHaveLength(1); // active, not pending
  });
});
