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
  const auditUrl = new URL('./patches-audit.json', import.meta.url); // from audit-apply.mjs
  if (_exists(auditUrl)) patches.push(...JSON.parse(readFileSync(auditUrl, 'utf8')));
  const dupsUrl = new URL('./patches-dups.json', import.meta.url); // from dup-scan.mjs
  if (_exists(dupsUrl)) patches.push(...JSON.parse(readFileSync(dupsUrl, 'utf8')));
  const textOf = (r) => (r.type === 'tossup' ? r.text : [r.leadin, ...r.parts.map((x) => x.text)].join(' || '));
  const dropped = new Set();
  // Resolve every patch against the original text first, so a rewrite never breaks a later patch's match.
  const resolved = patches.flatMap((pt) => {
    const hits = rows.filter((r) => (!pt.type || r.type === pt.type) && textOf(r).includes(pt.match));
    // "keepFirst": the same question was written twice; drop every copy except the first.
    if (pt.keepFirst && pt.drop && hits.length > 1) return hits.slice(1).map((h) => [pt, h]);
    if (hits.length !== 1) { console.log(`patch matched ${hits.length} rows (expected 1): ${pt.match.slice(0, 60)}`); return []; }
    return [[pt, hits[0]]];
  });
  // Further ops: "difficulty" (a part's difficulty when "part" is given), "setText" (a tossup's text, or the text
  // of a bonus part when "part" is given), "setLeadin" (a bonus lead-in).
  for (const [pt, r] of resolved) {
    if (pt.drop) { dropped.add(r); continue; }
    const spec = r.type === 'tossup' ? r : r.parts[pt.part ?? 0];
    if (pt.setAnswer) { spec.alternates = [...new Set([spec.answer, ...spec.alternates])].filter((x) => x !== pt.setAnswer); spec.answer = pt.setAnswer; }
    if (pt.addAlt) spec.alternates = [...new Set([...spec.alternates, ...pt.addAlt])].filter((x) => x !== spec.answer);
    if (pt.difficulty) { if (r.type === 'bonus' && pt.part !== undefined) spec.part_difficulty = pt.difficulty; else r.difficulty = pt.difficulty; }
    if (pt.setText) spec.text = pt.setText;
    if (pt.setLeadin && r.type === 'bonus') r.leadin = pt.setLeadin;
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
