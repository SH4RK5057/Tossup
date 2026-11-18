// Bulk generation plan: splits a target question count across every ruleset, level and subject,
// then into chunks small enough for one Claude reply. Pure; the site never calls an AI.

import { RULESETS } from '../core/rulesets';
import { LEVELS, type Level, type RulesetId } from '../core/types';

export interface PlanOptions {
  /** Total questions (a bonus counts as one). */
  total: number;
  rulesets: RulesetId[];
  levels: Level[];
  /** Fraction of questions that are bonuses (0-1). */
  bonusShare: number;
  tossupChunk: number;
  bonusChunk: number;
}

export interface PlanCell {
  rulesetId: RulesetId;
  level: Level;
  category: string;
  subcategory: string;
  tossups: number;
  bonuses: number;
}

export interface PlanItem {
  rulesetId: RulesetId;
  level: Level;
  category: string;
  subcategory: string;
  type: 'tossup' | 'bonus';
  count: number;
}

/** Largest-remainder split of `total` by weight. */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum || total <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [i, e - Math.floor(e)] as const).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][0]]++;
  return out;
}

/** Subjects (with weights) to generate for a ruleset at a level. Current Events is excluded: it goes stale. */
function subjectsFor(rulesetId: RulesetId, level: Level): { category: string; subcategory: string; weight: number }[] {
  const rs = RULESETS[rulesetId];
  const out: { category: string; subcategory: string; weight: number }[] = [];
  for (const cat of rs.subjects) {
    if (cat.name === 'Current Events') continue;
    const subs = rulesetId === 'ncal' ? cat.subjects.filter((s) => s.level === level) : cat.subjects;
    if (!subs.length) continue;
    // Even split: every subject gets the same share, so every category is covered.
    subs.forEach((s) => out.push({ category: cat.name, subcategory: s.name, weight: 1 }));
  }
  return out;
}

export function buildCells(o: PlanOptions): PlanCell[] {
  const cells: PlanCell[] = [];
  const perRuleset = allocate(o.total, o.rulesets.map(() => 1));
  o.rulesets.forEach((rulesetId, ri) => {
    const levels = LEVELS.filter((l) => o.levels.includes(l));
    const perLevel = allocate(perRuleset[ri], levels.map(() => 1));
    levels.forEach((level, li) => {
      const subjects = subjectsFor(rulesetId, level);
      const counts = allocate(perLevel[li], subjects.map((s) => s.weight));
      subjects.forEach((s, si) => {
        const n = counts[si];
        if (!n) return;
        const bonuses = Math.round(n * o.bonusShare);
        cells.push({ rulesetId, level, category: s.category, subcategory: s.subcategory, tossups: n - bonuses, bonuses });
      });
    });
  });
  return cells;
}

/** One item per Claude reply: a cell's tossups or bonuses, cut into chunks. */
export function buildPlan(o: PlanOptions): PlanItem[] {
  const items: PlanItem[] = [];
  for (const c of buildCells(o)) {
    for (const [type, n, chunk] of [['tossup', c.tossups, o.tossupChunk], ['bonus', c.bonuses, o.bonusChunk]] as const) {
      for (let left = n; left > 0; left -= chunk) {
        items.push({ rulesetId: c.rulesetId, level: c.level, category: c.category, subcategory: c.subcategory, type, count: Math.min(chunk, left) });
      }
    }
  }
  return items;
}

export const planLabel = (i: PlanItem) =>
  `${RULESETS[i.rulesetId].shortName} · ${i.level} · ${i.category} / ${i.subcategory} · ${i.count} ${i.type}${i.count === 1 ? '' : 's'}`;
