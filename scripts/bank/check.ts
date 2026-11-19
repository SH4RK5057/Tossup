// Checks one or more bank data files (the compact .txt format) against every quality gate, and against the
// seed, batch 1 and every OTHER data file (for duplicates). Does not write anything.
//
// Usage: npx vite-node scripts/bank/check.ts scripts/bank/data/my-file-01.txt [more files...]
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { runBankChecks } from '../../src/admin/bankChecks';
import { parseBank } from './lib.mjs';

const root = new URL('../../', import.meta.url);
const readJson = (p: string) => JSON.parse(readFileSync(new URL(p, root), 'utf8')) as Record<string, unknown>[];
const dataDir = new URL('data/', import.meta.url);
const mine = new Set(process.argv.slice(2).map((f) => resolve(f)));
if (!mine.size) { console.error('usage: npx vite-node scripts/bank/check.ts <data file> [...]'); process.exit(2); }

const rows: Record<string, unknown>[] = [];
for (const f of mine) rows.push(...(parseBank(readFileSync(f, 'utf8'), f) as Record<string, unknown>[]));

const existing = [...readJson('seed/questions.json'), ...readJson('batches/questions-batch-1.json')];
const others: Record<string, unknown>[] = []; // other writers' rows, counted toward subject totals
for (const name of readdirSync(dataDir).filter((n) => n.endsWith('.txt'))) {
  const path = resolve(new URL(name, dataDir).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  if (mine.has(path) || [...mine].some((m) => m.toLowerCase() === path.toLowerCase())) continue;
  try { const r = parseBank(readFileSync(path, 'utf8'), name) as Record<string, unknown>[]; existing.push(...r); others.push(...r); } catch { /* another writer's file is mid-edit: skip it */ }
}

const targets = JSON.parse(readFileSync(new URL('scripts/bank/targets.json', root), 'utf8')) as {
  rulesetId: string; level: string; category: string; subcategory: string; tossups: number; bonuses: number;
}[];
const have = new Map<string, { t: number; b: number }>();
const mineKeys = new Set(rows.map((r) => `${(r.rulesets as string[])[0]}|${r.level}|${r.subcategory}`));
for (const r of [...rows, ...others]) {
  const k = `${(r.rulesets as string[])[0]}|${r.level}|${r.subcategory}`;
  if (!mineKeys.has(k)) continue;
  const c = have.get(k) ?? { t: 0, b: 0 };
  if (r.type === 'tossup') c.t++; else c.b++;
  have.set(k, c);
}
console.log(`\n${rows.length} rows in ${mine.size} file(s)\n`);
console.log('subject counts (have/target, including all writers files):');
for (const t of targets) {
  const c = have.get(`${t.rulesetId}|${t.level}|${t.subcategory}`);
  if (!c) continue;
  const ok = c.t >= t.tossups && c.b >= t.bonuses;
  console.log(`  ${ok ? 'OK ' : 'LOW'} ${t.rulesetId} ${t.level} | ${t.category} | ${t.subcategory}: tossups ${c.t}/${t.tossups}, bonuses ${c.b}/${t.bonuses}`);
}

const results = runBankChecks(rows, existing);
let bad = 0;
console.log('\nquality gates:');
for (const r of results) {
  console.log(`  ${r.problems.length ? 'FAIL' : 'pass'}  ${r.name}`);
  for (const p of r.problems) console.log(`        - ${p}`);
  bad += r.problems.length;
}
console.log(bad ? `\n${bad} problem(s). Fix them and run again.` : '\nAll gates pass.');
process.exit(bad ? 1 : 0);
