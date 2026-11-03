import { create, evaluateDependencies, simplifyDependencies } from 'mathjs';
import { check } from '../core/checker';
import { RULESETS } from '../core/rulesets';
import type { Ruleset } from '../core/rulesets/types';
import { answerSpecSchema, type AnswerSpec, type Question } from '../core/types';
import { z } from 'zod';

export const coldAnswerSchema = z.object({
  id: z.string().min(1),
  /** A string for tossups; an array with one answer per part for bonuses. */
  answer: z.union([z.string(), z.array(z.string())]),
});
export type ColdAnswer = z.infer<typeof coldAnswerSchema>;

export interface PartCheck {
  key: string;
  cold: string;
  ok: boolean;
  note: string | null;
}

export interface VerifyItem {
  question: Question;
  parts: PartCheck[];
  outcome: 'match' | 'queue';
}

export interface VerifyResult {
  items: VerifyItem[];
  /** Upload rows that could not be used (unknown id, wrong shape, not pending). */
  errors: string[];
}

const math = create({ evaluateDependencies, simplifyDependencies });

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function clean(s: string): string {
  return s.replace(/π/g, 'pi').replace(/[×·]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/\s+/g, ' ').trim();
}

/** Is the answer key written in simplified form? */
export function isSimplified(key: string): boolean {
  const k = clean(key).replace(/\s+/g, '');
  if (/^-?\d+$/.test(k) || /^-?\d*\.\d+$/.test(k)) return true;
  const frac = /^(-?\d+)\/(\d+)$/.exec(k);
  if (frac) return Number(frac[2]) > 1 && gcd(Math.abs(Number(frac[1])), Number(frac[2])) === 1;
  if (/\/\(?(sqrt|√)/.test(k)) return false; // no radicals in denominators
  try {
    const simp = math.simplify(k).toString().replace(/\s+/g, '').replace(/\*/g, '');
    return simp === k.replace(/\*/g, '');
  } catch {
    return false;
  }
}

function unitless(cold: string): string {
  return clean(cold).replace(/\s*(degrees?|deg|°|%|percent|units?)$/i, '');
}

/** Evaluates both with mathjs and confirms the key is simplified. */
export function mathCheck(key: string, cold: string): { pass: boolean; note: string } {
  const k = clean(key);
  const c = unitless(cold);
  if (!c) return { pass: false, note: 'no cold answer' };
  if (!isSimplified(k)) return { pass: false, note: 'answer key is not in simplified form' };
  try {
    const a = math.evaluate(k) as unknown;
    const b = math.evaluate(c) as unknown;
    if (typeof a === 'number' && typeof b === 'number') {
      return Math.abs(a - b) < 1e-9 ? { pass: true, note: 'values match (mathjs)' } : { pass: false, note: `values differ: ${a} vs ${b}` };
    }
  } catch {
    /* symbolic: fall through */
  }
  try {
    const diff = math.simplify(`(${k})-(${c})`).toString().replace(/\s+/g, '');
    return diff === '0' ? { pass: true, note: 'expressions equal (mathjs)' } : { pass: false, note: 'expressions differ' };
  } catch {
    return { pass: false, note: 'could not evaluate' };
  }
}

function rulesetFor(q: Question): Ruleset {
  // When a question serves both rulesets, hold it to the stricter one.
  return q.rulesets.includes('ncal') ? RULESETS.ncal : RULESETS[q.rulesets[0]];
}

/**
 * Runs each cold answer through the checker against the stored key. Matches can be activated;
 * mismatches go to the review queue. Math parts always go to the queue unless the math check passes.
 */
export function verifyCold(pending: Question[], rawRows: unknown): VerifyResult {
  const errors: string[] = [];
  if (!Array.isArray(rawRows)) return { items: [], errors: ['The upload must be a JSON array of {id, answer}.'] };
  const byId = new Map(pending.filter((q) => q.status === 'pending').map((q) => [q.id, q]));
  const items: VerifyItem[] = [];
  const done = new Set<string>();
  rawRows.forEach((raw, i) => {
    const parsed = coldAnswerSchema.safeParse(raw);
    if (!parsed.success) { errors.push(`Row ${i + 1}: expected {id, answer}`); return; }
    const { id, answer } = parsed.data;
    const q = byId.get(id);
    if (!q) { errors.push(`Row ${i + 1}: "${id}" is not a pending question`); return; }
    if (done.has(id)) { errors.push(`Row ${i + 1}: "${id}" appears more than once`); return; }
    done.add(id);
    const specs: AnswerSpec[] = q.type === 'tossup' ? [q] : q.parts;
    const colds = Array.isArray(answer) ? answer : [answer];
    if (colds.length !== specs.length) {
      errors.push(`Row ${i + 1}: "${id}" needs ${specs.length} answer(s) but has ${colds.length}`);
      return;
    }
    const rs = rulesetFor(q);
    const parts: PartCheck[] = specs.map((spec, j) => {
      const s = answerSpecSchema.parse(spec);
      const cold = colds[j];
      const result = check(cold, s, rs);
      if (s.answer_type === 'math') {
        const m = mathCheck(s.answer, cold);
        return { key: s.answer, cold, ok: m.pass, note: m.pass ? null : `math question needs review (${m.note})` };
      }
      return { key: s.answer, cold, ok: result === 'correct', note: result === 'prompt' ? 'cold answer only earned a prompt' : null };
    });
    items.push({ question: q, parts, outcome: parts.every((p) => p.ok) ? 'match' : 'queue' });
  });
  return { items, errors };
}
