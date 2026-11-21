// Finds same-fact duplicates in the compiled NCAL bank that the text-similarity gate misses: two questions in the same
// subject with the same answer that also share rare content words (e.g. a tossup and a bonus part that both ask for the
// painter of "The School of Athens"). Writes scripts/bank/patches-dups.json: it drops the standalone tossup of each pair
// (the bonus part stays), or the later tossup when both are tossups. Run after build.mjs; then rebuild.
// Run: node scripts/bank/dup-scan.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const STOP = new Set('the a an of in on at to is are was were what which who whom whose how for by and or as with from this that these those its it be been has have had name term called known after into than then also one two do does did s his her their he she they not can used use most'.split(' '));
const toks = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)));
const sq = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
const dir = new URL('../../batches/', import.meta.url);
const items = [];
for (const f of readdirSync(dir).filter((n) => /^bank-ncal-.*\.json$/.test(n))) {
  const key = f.replace(/^bank-|\.json$/g, '');
  JSON.parse(readFileSync(new URL(f, dir), 'utf8')).forEach((r, i) => {
    if (r.category === 'Math' || r.category === 'Current Events') return;
    if (r.type === 'tossup') items.push({ id: `${key}:${i}`, key, tossup: true, sub: r.subcategory, text: r.text, ans: sq(r.answer), t: toks(r.text) });
    else r.parts.forEach((p, j) => items.push({ id: `${key}:${i}.${j}`, key, tossup: false, sub: r.subcategory, text: p.text, ans: sq(p.answer), t: toks(p.text), bonus: i }));
  });
}
const df = new Map();
for (const it of items) for (const w of it.t) df.set(w, (df.get(w) ?? 0) + 1);
const bySub = {};
for (const it of items) (bySub[`${it.key}|${it.sub}`] ??= []).push(it);

const drops = new Map();
const skipped = [];
for (const list of Object.values(bySub)) {
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
    const x = list[a], y = list[b];
    if (x.ans !== y.ans || x.ans.length < 3 || /^\d+$/.test(x.ans)) continue;
    if (!x.tossup && !y.tossup) { if (x.bonus !== y.bonus) skipped.push(`${x.id} | ${y.id}`); continue; }
    const shared = [...x.t].filter((w) => y.t.has(w));
    const rare = shared.filter((w) => (df.get(w) ?? 0) <= 6 && w.length > 2);
    const jac = shared.length / new Set([...x.t, ...y.t]).size;
    if (!(rare.length >= 2 || (rare.length >= 1 && jac >= 0.3))) continue;
    const victim = x.tossup && !y.tossup ? x : y.tossup && !x.tossup ? y : y; // both tossups: drop the later
    drops.set(victim.id, { match: victim.text.slice(0, 90), type: 'tossup', keepFirst: true, drop: true, reason: `same fact as ${victim === x ? y.id : x.id}` });
  }
}
// A bonus part kept as the survivor must not itself be dropped by another pair; tossups only are dropped here.
// Keep drops from earlier runs: once a duplicate is dropped it no longer appears in the compiled batches.
let previous = [];
try { previous = JSON.parse(readFileSync(new URL('./patches-dups.json', import.meta.url), 'utf8')); } catch { /* first run */ }
const patches = [...new Map([...previous, ...drops.values()].map((p) => [p.match, p])).values()];
writeFileSync(new URL('./patches-dups.json', import.meta.url), JSON.stringify(patches, null, 1) + '\n');
console.log(`${patches.length} duplicate tossups dropped (${skipped.length} bonus-part pairs left for review)`);
