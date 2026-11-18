import { describe, expect, it } from 'vitest';
import { LEVELS } from '../core/types';
import { masterPrompt } from './promptTemplates';
import { allocate, buildCells, buildPlan, type PlanOptions } from './planLogic';
import { parseLooseJson } from './importLogic';

const opts: PlanOptions = {
  total: 10000, rulesets: ['ncal', 'quizbowl'], levels: [...LEVELS], bonusShare: 0.2, tossupChunk: 30, bonusChunk: 10,
};

describe('bulk plan', () => {
  it('allocates exactly the requested total', () => {
    expect(allocate(10, [1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(10);
    expect(allocate(7, [3, 1]).reduce((a, b) => a + b, 0)).toBe(7);
    expect(allocate(0, [1, 2])).toEqual([0, 0]);
  });
  it('spreads 10,000 questions across every ruleset, level and subject', () => {
    const plan = buildPlan(opts);
    expect(plan.reduce((s, p) => s + p.count, 0)).toBe(10000);
    for (const r of ['ncal', 'quizbowl'] as const) {
      for (const l of LEVELS) {
        const n = plan.filter((p) => p.rulesetId === r && p.level === l).reduce((s, p) => s + p.count, 0);
        expect(n).toBeGreaterThan(1500); // roughly one sixth each
      }
    }
    expect(plan.every((p) => p.category !== 'Current Events')).toBe(true);
    expect(plan.filter((p) => p.type === 'tossup').every((p) => p.count <= 30)).toBe(true);
    expect(plan.filter((p) => p.type === 'bonus').every((p) => p.count <= 10)).toBe(true);
  });
  it('only plans NCAL subjects at the level they belong to', () => {
    const cells = buildCells(opts).filter((c) => c.rulesetId === 'ncal');
    const algebra1 = cells.filter((c) => c.subcategory === 'Algebra 1');
    expect(algebra1.map((c) => c.level)).toEqual(['novice']);
    expect(cells.some((c) => c.subcategory === 'Calculus' && c.level === 'varsity')).toBe(true);
  });
  it('honors the bonus share and the ruleset choice', () => {
    const plan = buildPlan({ ...opts, total: 1000, rulesets: ['quizbowl'], bonusShare: 0.5 });
    expect(plan.every((p) => p.rulesetId === 'quizbowl')).toBe(true);
    const bonuses = plan.filter((p) => p.type === 'bonus').reduce((s, p) => s + p.count, 0);
    expect(bonuses).toBeGreaterThan(400);
    expect(bonuses).toBeLessThan(600);
  });
  it('builds a master prompt that lists the tasks and the format', () => {
    const plan = buildPlan({ ...opts, total: 500 });
    const text = masterPrompt(plan, 3, 5);
    expect(text).toContain(`4. `);
    expect(text).toContain(`8. `);
    expect(text).not.toContain(`9. `);
    expect(text).toContain('type "next"');
    expect(text).toContain('straight double quotes');
  });
});

describe('merging pasted replies', () => {
  it('merges back-to-back arrays into one', () => {
    expect(parseLooseJson('[{"a":1}]\n[{"a":2}]').value).toEqual([{ a: 1 }, { a: 2 }]);
    expect(parseLooseJson('```json\n[{"a":1}]\n```\n\n```json\n[{"a":2}]\n```').value).toEqual([{ a: 1 }, { a: 2 }]);
  });
});
