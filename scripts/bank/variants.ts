// Checks that common typed variations of every computed math answer are accepted. Run: npx vite-node scripts/bank/variants.ts
import { readFileSync, readdirSync } from 'node:fs';
import { check } from '../../src/core/checker';
import { RULESETS } from '../../src/core/rulesets';
import { answerSpecSchema } from '../../src/core/types';

const rs = RULESETS.ncal;
const fails: Record<string, string[]> = {};
const variants = (a: string): Record<string, string> => {
  const v: Record<string, string> = {};
  v.spaced = a.replace(/([+\-/=,])/g, ' $1 ').replace(/\s+/g, ' ').trim();
  if (/^-?\d+(\.\d+)?$/.test(a)) { v.commas = Number(a) >= 1000 ? Number(a).toLocaleString('en-US') : a; v.xeq = `x = ${a}`; v.deg = `${a} degrees`; v.leadzero = a.startsWith('0.') ? a.slice(1) : a; }
  if (/pi/.test(a)) { v.greekpi = a.replace(/pi/g, 'π'); v.spacepi = a.replace(/(\d)pi/, '$1 pi'); v.pitimes = a.replace(/(\d+)pi/, '$1*pi'); }
  if (/sqrt/.test(a)) { v.radical = a.replace(/sqrt\((\d+)\)/g, '√$1'); v.root = a.replace(/sqrt\((\d+)\)/g, 'sqrt $1'); v.nopar = a.replace(/sqrt\((\d+)\)/g, 'sqrt$1'); v.rootword = a.replace(/sqrt\((\d+)\)/g, 'root $1'); }
  if (/\//.test(a) && /^-?\d+\/\d+$/.test(a)) v.decimal = String(Math.round((eval(a) as number) * 1e6) / 1e6);
  if (/^\(.*\)$/.test(a)) v.nopar = a.slice(1, -1);
  if (/\^/.test(a)) { v.caret = a; v.supers = a.replace(/x\^2/g, 'x²').replace(/x\^3/g, 'x³'); v.stars = a.replace(/(\d)x/g, '$1*x'); }
  if (/e\^/.test(a)) v.eword = a.replace(/e\^\(?([^)]*)\)?/, 'e to the $1');
  return v;
};
let n = 0;
for (const f of readdirSync(new URL('../../batches/', import.meta.url)).filter((x) => /^bank-ncal-.*\.json$/.test(x))) {
  for (const r of JSON.parse(readFileSync(new URL(`../../batches/${f}`, import.meta.url), 'utf8'))) {
    if (r.category !== 'Math') continue;
    const specs = r.type === 'tossup' ? [r] : r.parts;
    for (const s of specs) {
      const spec = answerSpecSchema.parse(s);
      for (const [name, typed] of Object.entries(variants(spec.answer))) {
        n++;
        if (check(typed, spec, rs) !== 'correct') (fails[name] ??= []).push(`${spec.answer} <- "${typed}"`);
      }
    }
  }
}
console.log(`${n} variants tried`);
for (const [k, l] of Object.entries(fails)) console.log(`${k}: ${l.length} failed, e.g. ${[...new Set(l)].slice(0, 4).join(' | ')}`);
