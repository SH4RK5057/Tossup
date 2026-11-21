// Turns the audit agents' findings (scripts/bank/audit/out/*.json) into build patches (scripts/bank/patches-audit.json).
// Ids refer to rows of the compiled batches/bank-*.json as they were when audit-export.mjs ran, so run this BEFORE
// rebuilding. Run: npx vite-node scripts/bank/audit-apply.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { check } from '../../src/core/checker';
import { RULESETS } from '../../src/core/rulesets';
import { answerSpecSchema } from '../../src/core/types';

const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
/** Would this wording give away one of the bonus's (or the tossup's) answers? */
function leaks(row, text, j) {
  const answers = row.type === 'tossup' ? [row.answer] : row.parts.map((p) => p.answer);
  const rest = row.type === 'tossup' ? text : [row.leadin, ...row.parts.map((p, i) => (i === j ? text : p.text))].join(' ');
  const hay = squash(rest);
  return answers.some((a) => squash(a).length >= 4 && hay.includes(squash(a)));
}
/** Keeps only the alternates the checker accepts and that are not the key itself. */
function goodAlts(row, j, alts) {
  const spec = row.type === 'tossup' ? row : row.parts[j ?? 0];
  const rs = RULESETS[row.rulesets[0]];
  return alts.filter((a) => {
    if (squash(a) === squash(spec.answer)) return false;
    const trial = answerSpecSchema.parse({ ...spec, alternates: [...spec.alternates, a] });
    return check(a, trial, rs) === 'correct';
  });
}

const batches = {};
for (const f of readdirSync(new URL('../../batches/', import.meta.url)).filter((n) => /^bank-.*\.json$/.test(n))) {
  batches[f.replace(/^bank-|\.json$/g, '')] = JSON.parse(readFileSync(new URL(`../../batches/${f}`, import.meta.url), 'utf8'));
}
const outDir = new URL('./audit/out/', import.meta.url);
const DIFFS = new Set(['easy', 'medium', 'hard']);
const patches = [];
const problems = [];
const seen = new Map(); // patch key -> merged patch, so one row/part gets one patch
let drops = 0;
for (const f of readdirSync(outDir).filter((n) => n.endsWith('.json')).sort()) {
  let items;
  try { items = JSON.parse(readFileSync(new URL(f, outDir), 'utf8')); } catch (e) { problems.push(`${f}: bad JSON`); continue; }
  for (const it of items) {
    const [id, part] = String(it.id).split('.');
    const [key, idx] = id.split(':');
    const row = batches[key]?.[Number(idx)];
    if (!row) { problems.push(`${f}: unknown id ${it.id}`); continue; }
    const j = part === undefined ? undefined : Number(part);
    if (row.type === 'bonus' && j !== undefined && !row.parts[j]) { problems.push(`${f}: no part ${it.id}`); continue; }
    const snippet = (row.type === 'tossup' || j === undefined ? (row.type === 'tossup' ? row.text : row.leadin) : row.parts[j].text).slice(0, 90);
    const k = `${snippet}#${j ?? ''}`;
    const pt = seen.get(k) ?? { match: snippet, ...(j !== undefined ? { part: j } : {}) };
    if (it.drop) { pt.drop = true; pt.reason = String(it.drop).slice(0, 80); }
    if (it.difficulty && DIFFS.has(it.difficulty)) pt.difficulty = it.difficulty;
    if (Array.isArray(it.addAlt) && it.addAlt.length) {
      const ok = goodAlts(row, j, it.addAlt.map(String));
      if (ok.length < it.addAlt.length) problems.push(`${it.id}: dropped alternates the checker rejects: ${it.addAlt.filter((a) => !ok.includes(String(a))).join(' | ')}`);
      if (ok.length) pt.addAlt = [...new Set([...(pt.addAlt ?? []), ...ok])];
    }
    if (typeof it.setAnswer === 'string' && it.setAnswer) pt.setAnswer = it.setAnswer;
    if (typeof it.setText === 'string' && it.setText) {
      if (leaks(row, it.setText, row.type === 'tossup' ? undefined : j)) problems.push(`${it.id}: rewrite would give away an answer, skipped`);
      else pt.setText = it.setText;
    }
    if (typeof it.setLeadin === 'string' && it.setLeadin && row.type === 'bonus') {
      const probe = { ...row, leadin: it.setLeadin };
      if (leaks(probe, '', undefined) && row.parts.some((p) => squash(p.answer).length >= 4 && squash(it.setLeadin).includes(squash(p.answer)))) problems.push(`${it.id}: new lead-in would give away an answer, skipped`);
      else pt.setLeadin = it.setLeadin;
    }
    if (!seen.has(k)) { seen.set(k, pt); patches.push(pt); }
  }
}
for (const p of patches) if (p.drop) drops++;
writeFileSync(new URL('./patches-audit.json', import.meta.url), JSON.stringify(patches, null, 1) + '\n');
console.log(`${patches.length} patches (${drops} drops, ${patches.filter((p) => p.difficulty).length} difficulty, ${patches.filter((p) => p.addAlt).length} alternates, ${patches.filter((p) => p.setText || p.setLeadin || p.setAnswer).length} rewrites)`);
if (problems.length) console.log('problems:\n' + problems.join('\n'));
