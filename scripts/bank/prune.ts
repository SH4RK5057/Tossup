// Drops rows that still fail a gate by appending text-matched drop patches to scripts/bank/patches.json.
// Run after build.mjs: npx vite-node scripts/bank/prune.ts   (then build.mjs again)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { runBankChecks } from '../../src/admin/bankChecks';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8')) as Row[];
const dir = new URL('../../batches/', import.meta.url);
const files = readdirSync(dir).filter((f) => /^bank-.*\.json$/.test(f)).sort();
const rows = files.flatMap((f) => read(`../../batches/${f}`));
const existing = [...read('../../seed/questions.json'), ...read('../../batches/questions-batch-1.json')];
const results = runBankChecks(rows, existing, Infinity);
const drop = new Set<number>();
for (const r of results) {
  for (const p of r.problems) {
    const leak = /^\[row (\d+)\]/.exec(p);
    if (leak) { drop.add(Number(leak[1])); continue; }
    if (r.name.startsWith('no identical') || r.name.startsWith('no near-identical')) {
      const ids = [...p.matchAll(/(new|old)#(\d+)/g)].map((m) => ({ kind: m[1], row: Number(m[2]) }));
      const fresh = ids.filter((i) => i.kind === 'new').map((i) => i.row);
      if (fresh.length) drop.add(Math.max(...fresh)); // drop the later new row (or the only new one)
    }
  }
}
const textOf = (r: Row) => (r.type === 'tossup' ? r.text : [r.leadin, ...r.parts.map((x: Row) => x.text)].join(' || '));
const patchUrl = new URL('./patches.json', import.meta.url);
const patches = JSON.parse(readFileSync(patchUrl, 'utf8'));
let added = 0;
for (const i of drop) {
  const snippet = textOf(rows[i]).slice(0, 120);
  const dupes = rows.filter((r) => textOf(r).includes(snippet)).length;
  if (dupes !== 1) { console.log(`skip (not unique): ${snippet.slice(0, 60)}`); continue; }
  patches.push({ match: snippet, drop: true });
  added++;
}
writeFileSync(patchUrl, JSON.stringify(patches, null, 1) + '\n');
console.log(`${results.reduce((n, r) => n + r.problems.length, 0)} problems; added ${added} drop patches`);
