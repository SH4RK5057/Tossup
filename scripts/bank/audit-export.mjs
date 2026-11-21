// Exports the compiled bank, with answers, in small chunks for a fairness / difficulty / alternates audit.
// Run: node scripts/bank/audit-export.mjs [ruleset]   (default ncal). Computed NCAL math is skipped (it has its own generator).
// ids look like "ncal-jv:123" (file key : row index) and "ncal-jv:123.1" for a bonus part.
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

const ruleset = process.argv[2] ?? 'ncal';
const dir = new URL('../../batches/', import.meta.url);
const out = new URL('./audit/in/', import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const D = { easy: 'e', medium: 'm', hard: 'h' };
const ans = (s) => `${s.answer}${s.alternates.length ? ` ; ${s.alternates.join(' ; ')}` : ''}${s.prompt_on?.length ? ` [prompt: ${s.prompt_on.join(' ; ')}]` : ''}`;
const slug = (s) => s.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
const careful = (cat) => cat === 'English' || cat === 'Fine Arts' || cat === 'Literature';

const byCell = {};
for (const f of readdirSync(dir).filter((n) => new RegExp(`^bank-${ruleset}-.*\\.json$`).test(n)).sort()) {
  const key = f.replace(/^bank-|\.json$/g, '');
  JSON.parse(readFileSync(new URL(f, dir), 'utf8')).forEach((r, i) => {
    if (r.rulesets[0] === 'ncal' && r.category === 'Math') return;
    if (r.category === 'Current Events') return;
    const head = `${key}:${i}`;
    const line = r.type === 'tossup'
      ? `${head} | ${D[r.difficulty]} | ${r.subcategory} | ${r.text} => ${ans(r)}`
      : `${head} | BONUS ${D[r.difficulty]} | ${r.subcategory} | ${r.leadin}\n` + r.parts.map((p, j) => `    ${head}.${j} | ${D[p.part_difficulty]} | ${p.text} => ${ans(p)}`).join('\n');
    (byCell[`${key}|${r.category}`] ??= []).push(line);
  });
}
let n = 0;
let rows = 0;
for (const [cell, lines] of Object.entries(byCell).sort()) {
  const [key, cat] = cell.split('|');
  const size = careful(cat) ? 70 : 100;
  for (let i = 0; i < lines.length; i += size) {
    const name = `${key}-${slug(cat)}-${String(Math.floor(i / size) + 1).padStart(2, '0')}`;
    writeFileSync(new URL(`${name}.txt`, out), lines.slice(i, i + size).join('\n') + '\n');
    n++;
  }
  rows += lines.length;
}
console.log(`${rows} rows in ${n} chunks`);
