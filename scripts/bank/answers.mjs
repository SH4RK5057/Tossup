// Lists the answers already used in a subject of the compiled NCAL bank, so writers can avoid asking the same fact again.
// Run: node scripts/bank/answers.mjs "Art History"      (prints one answer per line, tossups and bonus parts)
import { readFileSync, readdirSync } from 'node:fs';

const sub = (process.argv[2] ?? '').toLowerCase();
const dir = new URL('../../batches/', import.meta.url);
const seen = new Set();
for (const f of readdirSync(dir).filter((n) => /^bank-ncal-.*\.json$/.test(n))) {
  for (const r of JSON.parse(readFileSync(new URL(f, dir), 'utf8'))) {
    if (r.subcategory.toLowerCase() !== sub) continue;
    for (const s of r.type === 'tossup' ? [r] : r.parts) seen.add(s.answer);
  }
}
console.log([...seen].sort().join('\n'));
