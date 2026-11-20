// Bakes the question bank into the site: writes public/bank/<ruleset>-<level>.json (full question objects).
// Source: batches/master-import.json (seed + batch 1 + bank, after review patches). Runs before dev and build.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const src = new URL('../batches/master-import.json', import.meta.url);
if (!existsSync(src)) { console.error('batches/master-import.json is missing; run node scripts/build-master.mjs'); process.exit(1); }
const out = new URL('../public/bank/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// Stable id from the content, so reports keep pointing at the same question across rebuilds.
function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const STAMP = '2026-11-19T00:00:00.000Z';
const groups = {};
let n = 0;
for (const row of JSON.parse(readFileSync(src, 'utf8'))) {
  const text = row.type === 'tossup' ? row.text : [row.leadin, ...row.parts.map((p) => p.text)].join('||');
  const q = {
    ...row,
    id: `q${hash(`${row.rulesets[0]}|${row.level}|${text}`)}`,
    status: 'active',
    random: 0.5,
    report_count: 0,
    created_at: STAMP,
    updated_at: STAMP,
  };
  (groups[`${row.rulesets[0]}-${row.level}`] ??= []).push(q);
  n++;
}
const ids = new Set();
for (const [k, list] of Object.entries(groups)) {
  for (const q of list) { if (ids.has(q.id)) throw new Error(`id collision: ${q.id}`); ids.add(q.id); }
  writeFileSync(new URL(`${k}.json`, out), JSON.stringify(list));
}
console.log(`baked ${n} questions into public/bank/ (${Object.keys(groups).length} files)`);
