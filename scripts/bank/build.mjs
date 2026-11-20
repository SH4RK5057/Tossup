// Builds batches/bank-<ruleset>-<level>.json from scripts/bank/data/*.txt, then prints progress
// against scripts/bank/targets.json. Run with: node scripts/bank/build.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { parseBank } from './lib.mjs';

const dataDir = new URL('./data/', import.meta.url);
const outDir = new URL('../../batches/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const rows = [];
for (const f of readdirSync(dataDir).filter((n) => n.endsWith('.txt')).sort()) {
  rows.push(...parseBank(readFileSync(new URL(f, dataDir), 'utf8'), f));
}

// Review patches (scripts/bank/patches.json): fix questions found wrong or too strict by the cold-answer check.
//   { "match": "<snippet of the question text or bonus lead-in>", "part": 0, "addAlt": ["..."], "setAnswer": "...", "drop": true }
import { existsSync as _exists } from 'node:fs';
const patchUrl = new URL('./patches.json', import.meta.url);
if (_exists(patchUrl)) {
  const patches = JSON.parse(readFileSync(patchUrl, 'utf8'));
  const textOf = (r) => (r.type === 'tossup' ? r.text : [r.leadin, ...r.parts.map((x) => x.text)].join(' || '));
  const dropped = new Set();
  for (const pt of patches) {
    const hits = rows.filter((r) => textOf(r).includes(pt.match));
    if (hits.length !== 1) { console.log(`patch matched ${hits.length} rows (expected 1): ${pt.match.slice(0, 60)}`); continue; }
    const r = hits[0];
    if (pt.drop) { dropped.add(r); continue; }
    const spec = r.type === 'tossup' ? r : r.parts[pt.part ?? 0];
    if (pt.setAnswer) { spec.alternates = [...new Set([spec.answer, ...spec.alternates])].filter((x) => x !== pt.setAnswer); spec.answer = pt.setAnswer; }
    if (pt.addAlt) spec.alternates = [...new Set([...spec.alternates, ...pt.addAlt])].filter((x) => x !== spec.answer);
  }
  for (let i = rows.length - 1; i >= 0; i--) if (dropped.has(rows[i])) rows.splice(i, 1);
  console.log(`applied ${patches.length} patches (${dropped.size} dropped)`);
}

const groups = {};
for (const r of rows) (groups[`${r.rulesets[0]}-${r.level}`] ??= []).push(r);
for (const [k, list] of Object.entries(groups)) {
  writeFileSync(new URL(`bank-${k}.json`, outDir), JSON.stringify(list, null, 1) + '\n');
}

const targetsUrl = new URL('./targets.json', import.meta.url);
const targets = existsSync(targetsUrl) ? JSON.parse(readFileSync(targetsUrl, 'utf8')) : [];
const have = {};
for (const r of rows) {
  const k = `${r.rulesets[0]}|${r.level}|${r.category}|${r.subcategory}|${r.type}`;
  have[k] = (have[k] ?? 0) + 1;
}
let want = 0;
let done = 0;
const todo = [];
for (const t of targets) {
  for (const type of ['tossup', 'bonus']) {
    const need = type === 'tossup' ? t.tossups : t.bonuses;
    const got = have[`${t.rulesetId}|${t.level}|${t.category}|${t.subcategory}|${type}`] ?? 0;
    want += need;
    done += Math.min(got, need);
    if (got < need) todo.push(`${t.rulesetId} ${t.level} | ${t.category} | ${t.subcategory}: ${type} ${got}/${need}`);
  }
}
console.log(`bank rows: ${rows.length} (${rows.filter((r) => r.type === 'tossup').length} tossups, ${rows.filter((r) => r.type === 'bonus').length} bonuses)`);
console.log(`progress toward target: ${done}/${want} (${want ? Math.round((done / want) * 100) : 0}%)`);
if (process.argv.includes('--todo')) console.log(todo.join('\n'));
else console.log(`${todo.length} cell-types still short. Run with --todo to list them.`);
