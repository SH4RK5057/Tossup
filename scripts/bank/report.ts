// Runs every quality gate over the compiled bank (batches/bank-*.json) and prints ALL problems.
// Run with: npx vite-node scripts/bank/report.ts
import { readFileSync, readdirSync } from 'node:fs';
import { runBankChecks } from '../../src/admin/bankChecks';

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8')) as Record<string, unknown>[];
const dir = new URL('../../batches/', import.meta.url);
const rows = readdirSync(dir).filter((f) => /^bank-.*\.json$/.test(f)).flatMap((f) => read(`../../batches/${f}`));
const existing = [...read('../../seed/questions.json'), ...read('../../batches/questions-batch-1.json')];
const results = runBankChecks(rows, existing, Infinity);
console.log(`${rows.length} rows`);
let bad = 0;
for (const r of results) {
  console.log(`\n${r.problems.length ? 'FAIL' : 'pass'} (${r.problems.length}) ${r.name}`);
  for (const p of r.problems) console.log(`   - ${p}`);
  bad += r.problems.length;
}
console.log(bad ? `\n${bad} problems` : '\nAll gates pass');
