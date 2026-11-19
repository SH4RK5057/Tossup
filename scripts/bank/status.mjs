// Per-writer progress: parses each data file on its own (reporting parse errors) and compares to assignments.
import { readFileSync, readdirSync } from 'node:fs';
import { parseBank } from './lib.mjs';
const dir = new URL('./data/', import.meta.url);
const A = JSON.parse(readFileSync(new URL('./assignments.json', import.meta.url), 'utf8'));
const have = {};
const errors = [];
for (const f of readdirSync(dir).filter((n) => n.endsWith('.txt'))) {
  let rows = [];
  try { rows = parseBank(readFileSync(new URL(f, dir), 'utf8'), f); } catch (e) { errors.push(e.message.split('\n')[0]); continue; }
  for (const r of rows) {
    const k = `${r.rulesets[0]}|${r.level}|${r.subcategory}`;
    (have[k] ??= { t: 0, b: 0 })[r.type === 'tossup' ? 't' : 'b']++;
  }
}
let allHave = 0, allWant = 0;
for (const [tag, a] of Object.entries(A)) {
  let h = 0, w = 0; const low = [];
  for (const c of a.cells) {
    const x = have[`${c.ruleset}|${c.level}|${c.subcategory}`] ?? { t: 0, b: 0 };
    h += Math.min(x.t, c.tossups) + Math.min(x.b, c.bonuses); w += c.tossups + c.bonuses;
    if (x.t < c.tossups || x.b < c.bonuses) low.push(`${c.level} ${c.subcategory} ${x.t}/${c.tossups}t ${x.b}/${c.bonuses}b`);
  }
  allHave += h; allWant += w;
  console.log(`${tag.padEnd(9)} ${String(h).padStart(4)}/${String(w).padEnd(4)} ${low.length ? 'short: ' + low.join('; ') : 'complete'}`);
}
console.log(`\nwriters total ${allHave}/${allWant}`);
if (errors.length) console.log('\nPARSE ERRORS:\n' + errors.join('\n'));
