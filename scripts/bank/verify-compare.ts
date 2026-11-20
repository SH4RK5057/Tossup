// Compares cold answers (scripts/bank/verify/out/chunk-NNN.json: [{id, answer}]) with the bank's keys.
// Writes scripts/bank/verify/mismatch.json and prints a summary. Run: npx vite-node scripts/bank/verify-compare.ts
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { check } from '../../src/core/checker';
import { RULESETS } from '../../src/core/rulesets';
import { answerSpecSchema } from '../../src/core/types';
import { mathCheck } from '../../src/admin/verifyLogic';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rd = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const bank: Record<string, Row[]> = {};
for (const f of readdirSync(new URL('../../batches/', import.meta.url)).filter((n) => /^bank-.*\.json$/.test(n))) {
  bank[f.replace(/^bank-|\.json$/g, '')] = rd(`../../batches/${f}`);
}
const outDir = new URL('./verify/out/', import.meta.url);
const cold = new Map<string, string | string[]>();
for (const f of readdirSync(outDir).filter((n) => n.endsWith('.json'))) {
  try { for (const a of rd(`./verify/out/${f}`) as { id: string; answer: string | string[] }[]) cold.set(a.id, a.answer); } catch (e) { console.log(`unreadable ${f}: ${(e as Error).message}`); }
}
const inDir = new URL('./verify/in/', import.meta.url);
const expected: string[] = [];
for (const f of readdirSync(inDir).filter((n) => n.endsWith('.json'))) for (const it of rd(`./verify/in/${f}`)) expected.push(it.id);

const mismatches: unknown[] = [];
let ok = 0;
const missing: string[] = [];
for (const id of expected) {
  const [key, idxS] = id.split(':');
  const row = bank[key][Number(idxS)];
  const rs = RULESETS[row.rulesets[0] as 'ncal'];
  const ans = cold.get(id);
  if (ans === undefined) { missing.push(id); continue; }
  const specs = row.type === 'tossup' ? [row] : row.parts;
  const colds = Array.isArray(ans) ? ans : [ans];
  const parts = specs.map((s: Row, j: number) => {
    const spec = answerSpecSchema.parse(s);
    const c = colds[j] ?? '';
    let r = check(c, spec, rs);
    if (r !== 'correct' && spec.answer_type === 'math' && mathCheck(spec.answer, c).pass) r = 'correct';
    return { key: spec.answer, cold: c, ok: r === 'correct' };
  });
  if (parts.length !== colds.length && row.type === 'bonus') parts.forEach((p: { ok: boolean }) => (p.ok = false));
  if (parts.every((p: { ok: boolean }) => p.ok)) ok++;
  else mismatches.push({ id, text: row.type === 'tossup' ? row.text : [row.leadin, ...row.parts.map((p: Row) => p.text)].join(' || '), parts });
}
writeFileSync(new URL('./verify/mismatch.json', import.meta.url), JSON.stringify(mismatches, null, 1));
console.log(`expected ${expected.length}; answered ${expected.length - missing.length}; match ${ok}; mismatch ${mismatches.length}; missing ${missing.length}`);
if (missing.length) console.log(`first missing: ${missing.slice(0, 5).join(', ')}`);
