// Exports the compiled bank WITHOUT answer keys, in chunks, for independent cold answering.
// ids look like "ncal-jv:123" (file key : row index). Computed NCAL math is skipped (correct by construction).
import { readFileSync, readdirSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
const dir = new URL('../../batches/', import.meta.url);
const out = new URL('./verify/in/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const items = [];
for (const f of readdirSync(dir).filter((n) => /^bank-.*\.json$/.test(n)).sort()) {
  const key = f.replace(/^bank-|\.json$/g, '');
  JSON.parse(readFileSync(new URL(f, dir), 'utf8')).forEach((r, i) => {
    if (r.rulesets[0] === 'ncal' && r.category === 'Math') return;
    items.push(r.type === 'tossup' ? { id: `${key}:${i}`, q: r.text } : { id: `${key}:${i}`, q: r.leadin, parts: r.parts.map((p) => p.text) });
  });
}
const SIZE = 200;
let n = 0;
for (let i = 0; i < items.length; i += SIZE) writeFileSync(new URL(`chunk-${String(++n).padStart(3, '0')}.json`, out), JSON.stringify(items.slice(i, i + SIZE), null, 0) + '\n');
console.log(`${items.length} items in ${n} chunks`);
