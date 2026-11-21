// Generates the NCAL math subjects (computed answers, so every key is correct by construction).
// Writes scripts/bank/data/gen-ncal-math.txt in the compact bank format. Run: npx vite-node scripts/bank/gen-math.mjs
//
// Rules for every template here:
//  - the question is written as the equation a student would see (3x² − 7x + 2, (x² − 49)/(x − 7), √3/2), not spoken words;
//  - it is answerable without a calculator in at most about three simple steps;
//  - trigonometric values are limited to the special angles 0, 30, 45, 60 and 90 degrees (or the radian equivalents).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { normalizeText } from '../../src/core/normalize';
import { parseBank } from './lib.mjs';

const targets = JSON.parse(readFileSync(new URL('./targets.json', import.meta.url), 'utf8'));

// ---------------------------------------------------------------- helpers
function makeRng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { f, int: (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)), pick: (arr) => arr[Math.floor(f() * arr.length)] };
}
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const frac = (n, d) => {
  const g = gcd(n, d) || 1;
  n /= g; d /= g;
  if (d < 0) { n = -n; d = -d; }
  return d === 1 ? String(n) : `${n}/${d}`;
};
/** Terminating-decimal alternate for a fraction answer, or none. */
const decAlt = (n, d) => {
  const v = n / d;
  if (Number.isInteger(v)) return [];
  const s = String(v);
  return s.length <= 8 && !s.includes('e') && Math.abs(v * 1e6 - Math.round(v * 1e6)) < 1e-9 ? [s] : [];
};
const fr = (n, d) => ({ ans: frac(n, d), alts: decAlt(n, d) });
const Q = (d, text, ans, alts = []) => ({ d, text: text.replace(/\s+/g, ' ').trim(), ans: String(ans), alts });
const FQ = (d, text, n, dd, dec = true) => { const f = fr(n, dd); return Q(d, text, f.ans, dec ? f.alts : []); };
const sqfree = [2, 3, 5, 6, 7, 10];

// ---- notation (what the student sees)
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');
const sub = (n) => String(n).split('').map((c) => SUB[c] ?? c).join('');
const MINUS = '−';
/** A signed number as displayed: −5. */
const neg = (n) => (n < 0 ? `${MINUS}${-n}` : String(n));
const coef = (k) => (k === 1 ? '' : String(k));
const xp = (e) => (e === 1 ? 'x' : `x${sup(e)}`);
/** " + 3x" / " − x" after a previous term; nothing when the coefficient is 0. */
const lin = (k) => (k === 0 ? '' : ` ${k < 0 ? MINUS : '+'} ${coef(Math.abs(k))}x`);
/** " + 5" / " − 5" after a previous term; nothing when 0. */
const con = (c) => (c === 0 ? '' : ` ${c < 0 ? MINUS : '+'} ${Math.abs(c)}`);
/** Polynomial for the answer key (ASCII), coefficients high degree first: [1,5,6] -> x^2+5x+6. */
function poly(c, asc = false) {
  const deg = c.length - 1;
  const terms = c.map((k, i) => [k, deg - i]).filter(([k]) => k !== 0);
  if (asc) terms.reverse();
  let out = '';
  terms.forEach(([k, e], i) => {
    const a = Math.abs(k);
    const body = e === 0 ? String(a) : `${a === 1 ? '' : a}${e === 1 ? 'x' : `x^${e}`}`;
    out += (i === 0 ? (k < 0 ? '-' : '') : k < 0 ? '-' : '+') + body;
  });
  return out || '0';
}
/** The same polynomial as displayed: 3x³ − x + 7. */
function pd(c) {
  const deg = c.length - 1;
  let out = '';
  c.forEach((k, i) => {
    if (!k) return;
    const e = deg - i;
    const body = e === 0 ? String(Math.abs(k)) : `${coef(Math.abs(k))}${xp(e)}`;
    out += out === '' ? (k < 0 ? `${MINUS}${body}` : body) : ` ${k < 0 ? MINUS : '+'} ${body}`;
  });
  return out || '0';
}
const PQ = (d, text, c) => Q(d, text, poly(c), poly(c) === poly(c, true) ? [] : [poly(c, true)]);
/** n*pi/d reduced for an answer key: 2pi, pi/3, 5pi/6. */
function piMul(n, d) {
  const g = gcd(n, d) || 1;
  n /= g; d /= g;
  const top = n === 1 ? 'pi' : `${n}pi`;
  return d === 1 ? top : `${top}/${d}`;
}
/** The same, as displayed: 2π, π/3, 5π/6. */
const piShow = (n, d) => piMul(n, d).replace(/pi/g, 'π');
const cplx = (re, im) => {
  const imag = im === 0 ? '' : `${im < 0 ? '-' : re === 0 && im > 0 ? '' : '+'}${Math.abs(im) === 1 ? '' : Math.abs(im)}i`;
  if (im === 0) return String(re);
  if (re === 0) return imag.replace(/^\+/, '');
  return `${re}${imag}`;
};
/** A complex number as displayed: 3 − 2i. */
const cshow = (re, im) => {
  const b = `${Math.abs(im) === 1 ? '' : Math.abs(im)}i`;
  if (im === 0) return neg(re);
  if (re === 0) return im < 0 ? `${MINUS}${b}` : b;
  return `${neg(re)} ${im < 0 ? MINUS : '+'} ${b}`;
};
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 12, 15], [6, 8, 10], [12, 16, 20], [15, 20, 25], [9, 40, 41], [12, 35, 37], [10, 24, 26]];

// ------------------------------------------------------------ novice templates
const ARITH = [
  { leadin: 'Answer these questions about whole-number arithmetic.', fns: [
    (r) => { const a = r.int(12, 899), b = r.int(12, 899); return Q('e', `What is ${a} + ${b}?`, a + b); },
    (r) => { const a = r.int(100, 999), b = r.int(10, a - 1); return Q('e', `What is ${a} ${MINUS} ${b}?`, a - b); },
    (r) => { const a = r.int(3, 12), b = r.int(3, 12); return Q('e', `What is ${a} × ${b}?`, a * b); },
    (r) => { const a = r.int(12, 99), b = r.int(3, 9); return Q('m', `What is ${a} × ${b}?`, a * b); },
    (r) => { const a = r.int(12, 30), b = r.pick([11, 12, 15, 20, 25]); return Q('h', `What is ${a} × ${b}?`, a * b); },
    (r) => { const b = r.int(3, 9), q = r.int(3, 12); return Q('e', `What is ${b * q} ÷ ${b}?`, q); },
    (r) => { const b = r.int(6, 15), q = r.int(12, 30); return Q('m', `What is ${b * q} ÷ ${b}?`, q); },
    (r) => { const b = r.int(3, 9), a = b * r.int(3, 12) + r.int(1, b - 1); return Q('m', `What is the remainder when ${a} is divided by ${b}?`, a % b); },
    (r) => { const a = r.int(10, 60), b = r.int(10, 60), c = r.int(10, 60); return Q('m', `What is ${a} + ${b} + ${c}?`, a + b + c); },
  ] },
  { leadin: 'Answer these questions about percents and decimals.', fns: [
    (r) => { const p = r.pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]), n = 20 * r.int(2, 30); return Q('m', `What is ${p}% of ${n}?`, (p * n) / 100); },
    (r) => { const p = r.int(1, 99); return Q('e', `What is ${p}% written as a decimal?`, p / 100); },
    (r) => { const p = r.int(1, 99); return Q('e', `What percent is the decimal ${p / 100}?`, p, [`${p}%`]); },
    (r) => { const d = r.pick([2, 4, 5, 8, 10, 20, 25]); let n = r.int(1, d - 1); while (gcd(n, d) !== 1) n = r.int(1, d - 1); return Q('m', `What is the fraction ${n}/${d} written as a decimal?`, n / d); },
    (r) => { const [n, d] = r.pick([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 8], [3, 8], [1, 20], [7, 20], [9, 20], [1, 10], [3, 10]]); return Q('m', `What is the decimal ${n / d} written as a fraction in lowest terms?`, frac(n, d)); },
    (r) => { const p = 20 * r.int(3, 20), pct = r.pick([10, 20, 25, 50]); return Q('m', `A jacket costs $${p} and is ${pct}% off. What is the sale price in dollars?`, (p * (100 - pct)) / 100); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9); return Q('m', `What is ${a * 10 + b}% of 200?`, ((a * 10 + b) * 200) / 100); },
  ] },
  { leadin: 'Answer these questions about fractions.', fns: [
    (r) => { const g = r.int(2, 6), d = r.int(3, 12); let n = r.int(1, d - 1); while (gcd(n, d) !== 1) n = r.int(1, d - 1); return Q('e', `Simplify the fraction ${n * g}/${d * g} to lowest terms.`, frac(n, d)); },
    (r) => { const d = r.int(5, 12), a = r.int(1, d - 1), b = r.int(1, d - 1); return Q('e', `What is ${a}/${d} + ${b}/${d}? Give the answer in lowest terms.`, frac(a + b, d)); },
    (r) => { const [d1, d2] = r.pick([[2, 3], [2, 5], [3, 4], [3, 5], [4, 5], [2, 7], [3, 7], [5, 6], [4, 9]]); const a = r.int(1, d1 - 1), b = r.int(1, d2 - 1); return Q('h', `What is ${a}/${d1} + ${b}/${d2}? Give the answer in lowest terms.`, frac(a * d2 + b * d1, d1 * d2)); },
    (r) => { const a = r.int(1, 5), b = r.int(a + 1, 8), c = r.int(1, 5), d = r.int(c + 1, 8); return Q('m', `What is ${a}/${b} × ${c}/${d}? Give the answer in lowest terms.`, frac(a * c, b * d)); },
    (r) => { const a = r.int(1, 5), b = r.int(a + 1, 8), c = r.int(1, 5), d = r.int(c + 1, 8); return Q('h', `What is ${a}/${b} ÷ ${c}/${d}? Give the answer in lowest terms.`, frac(a * d, b * c)); },
    (r) => { const b = r.int(3, 9), a = r.int(1, b - 1), k = r.int(2, 9); return Q('m', `What is ${a}/${b} of ${b * k}?`, a * k); },
    (r) => { const w = r.int(1, 6), d = r.int(3, 9); let n = r.int(1, d - 1); while (gcd(n, d) !== 1) n = r.int(1, d - 1); return Q('m', `Write the mixed number ${w} ${n}/${d} as an improper fraction.`, `${w * d + n}/${d}`); },
  ] },
  { leadin: 'Answer these questions about factors and multiples.', fns: [
    (r) => { const g = r.int(2, 9); let a = g * r.int(2, 9), b = g * r.int(2, 9); while (a === b) b = g * r.int(2, 9); return Q('m', `What is the greatest common factor of ${a} and ${b}?`, gcd(a, b)); },
    (r) => { let a = r.int(2, 12), b = r.int(2, 12); while (a === b) b = r.int(2, 12); return Q('m', `What is the least common multiple of ${a} and ${b}?`, (a * b) / gcd(a, b)); },
    (r) => { const n = r.pick([12, 18, 20, 24, 28, 30, 36, 40, 42, 48, 60]); let c = 0; for (let i = 1; i <= n; i++) if (n % i === 0) c++; return Q('h', `How many positive factors does ${n} have?`, c); },
    (r) => { const p = r.pick([7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]); let n = p + 1; const isP = (x) => { for (let i = 2; i * i <= x; i++) if (x % i === 0) return false; return x > 1; }; while (!isP(n)) n++; return Q('m', `What is the smallest prime number greater than ${p}?`, n); },
    (r) => { const n = r.pick([10, 20, 30, 40, 50]); const c = { 10: 4, 20: 8, 30: 10, 40: 12, 50: 15 }[n]; return Q('m', `How many prime numbers are less than ${n}?`, c); },
    (r) => { const a = r.int(3, 15), b = r.int(3, 15); let c = r.int(3, 15); while (a === b || b === c || a === c) c = r.int(3, 15); return Q('h', `What is the greatest common factor of ${a * 6}, ${b * 6}, and ${c * 6}?`, gcd(gcd(a * 6, b * 6), c * 6)); },
  ] },
  { leadin: 'Answer these questions about powers and roots.', fns: [
    (r) => { const a = r.int(3, 25); return Q(a > 15 ? 'm' : 'e', `What is ${a}²?`, a * a); },
    (r) => { const a = r.int(2, 10); return Q('m', `What is ${a}³?`, a ** 3); },
    (r) => { const a = r.int(3, 20); return Q('e', `What is √${a * a}?`, a); },
    (r) => { const k = r.int(4, 12); return Q('m', `What is 2${sup(k)}?`, 2 ** k); },
    (r) => { const a = r.int(2, 10); return Q('m', `What is ∛${a ** 3}?`, a); },
    (r) => { const k = r.int(3, 6); return Q('m', `What is 10${sup(k)}?`, 10 ** k); },
    (r) => { const a = r.int(2, 5), b = r.int(3, 4); return Q('h', `What is ${a}${sup(b)}?`, a ** b); },
  ] },
  { leadin: 'Answer these questions about number sense.', fns: [
    (r) => { let n = r.int(100, 9999); while (n % 10 === 5) n = r.int(100, 9999); return Q('e', `What is ${n} rounded to the nearest ten?`, Math.round(n / 10) * 10); },
    (r) => { let n = r.int(1000, 99999); while (n % 100 === 50) n = r.int(1000, 99999); return Q('m', `What is ${n} rounded to the nearest hundred?`, Math.round(n / 100) * 100); },
    (r) => { let x = r.int(100, 999); while (x % 10 === 5) x = r.int(100, 999); return Q('m', `What is ${x / 100} rounded to the nearest tenth?`, Math.round(x / 10) / 10); },
    (r) => { const a = r.int(2, 30), b = r.int(2, 30); return Q('m', `What is ${MINUS}${a} + ${b}?`, b - a); },
    (r) => { const a = r.int(2, 12), b = r.int(2, 12); return Q('m', `What is (${MINUS}${a}) × (${MINUS}${b})?`, a * b); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9); return Q('m', `What is ${a} + ${b} × ${c}?`, a + b * c); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9); return Q('m', `What is ${a} × (${b} + ${c})?`, a * (b + c)); },
    (r) => { const avg = r.int(5, 40), v = [r.int(3, 40), r.int(3, 40), r.int(3, 40)]; let last = 4 * avg - v.reduce((x, y) => x + y, 0); if (last < 1) { v[0] = 1; v[1] = 1; v[2] = 1; last = 4 * avg - 3; } return Q('m', `What is the average of ${v.join(', ')}, and ${last}?`, avg); },
    (r) => { const s = new Set(); while (s.size < 5) s.add(r.int(2, 60)); const a = [...s]; return Q('m', `What is the median of ${a.join(', ')}?`, [...a].sort((x, y) => x - y)[2]); },
    (r) => { const a = r.int(2, 12), b = r.int(2, 12); return Q('h', `What is |${MINUS}${a * b} ${MINUS} ${a}|?`, a * b + a); },
  ] },
  { leadin: 'Answer these questions about units of measurement.', fns: [
    (r) => { const [f, t, k] = r.pick([['hours', 'minutes', 60], ['feet', 'inches', 12], ['yards', 'feet', 3], ['pounds', 'ounces', 16], ['weeks', 'days', 7], ['kilometers', 'meters', 1000], ['meters', 'centimeters', 100], ['gallons', 'quarts', 4], ['minutes', 'seconds', 60], ['days', 'hours', 24]]); const n = r.int(2, 9); return Q('e', `How many ${t} are in ${n} ${f}?`, n * k); },
    (r) => { const n = r.int(2, 9); return Q('m', `How many inches are in ${n} yards?`, n * 36); },
    (r) => { const n = r.int(2, 6); return Q('m', `How many seconds are in ${n} minutes and 30 seconds?`, n * 60 + 30); },
    (r) => { const n = r.int(2, 5); return Q('h', `How many minutes are in ${n} days?`, n * 1440); },
  ] },
  { leadin: 'Answer these word problems.', fns: [
    (r) => { const a = r.int(6, 24), b = r.int(3, 12); return Q('e', `A box holds ${a} pencils. How many pencils are in ${b} boxes?`, a * b); },
    (r) => { const a = r.int(30, 70), b = r.int(2, 9); return Q('e', `A train travels ${a} miles per hour for ${b} hours. How many miles does it travel?`, a * b); },
    (r) => { const a = r.int(40, 99), b = r.int(5, a - 5); return Q('e', `Tom has $${a} and spends $${b}. How many dollars does he have left?`, a - b); },
    (r) => { const b = r.int(3, 9), q = r.int(2, 12); return Q('e', `If ${b * q} apples are shared equally among ${b} children, how many apples does each child get?`, q); },
    (r) => { const p = r.int(8, 40), k = r.int(3, 9); return Q('m', `A shirt costs $${p}. How much do ${k} shirts cost, in dollars?`, p * k); },
    (r) => { const a = r.int(12, 40), b = r.int(2, 6), c = r.int(5, 20); return Q('h', `A store sells ${a} notebooks each day for ${b} days. Then ${c} notebooks are returned. How many notebooks were sold in all?`, a * b - c); },
    (r) => { const a = r.int(3, 9), b = r.int(4, 12), c = r.int(2, 8); return Q('h', `Maria buys ${a} packs of stickers with ${b} stickers in each pack and gives away ${c} stickers. How many stickers does she have left?`, a * b - c); },
  ] },
];

const ALG1 = [
  { leadin: 'Solve these one-step equations.', fns: [
    (r) => { const a = r.int(2, 30), x = r.int(2, 40); return Q('e', `Solve for x: x + ${a} = ${x + a}`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 30), x = r.int(2, 40); return Q('e', `Solve for x: x ${MINUS} ${a} = ${x - a}`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 12), x = r.int(2, 15); return Q('e', `Solve for x: ${a}x = ${a * x}`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 9), x = r.int(2, 12); return Q('m', `Solve for x: x/${a} = ${x}`, a * x, [`x=${a * x}`]); },
  ] },
  { leadin: 'Solve these two-step equations.', fns: [
    (r) => { const a = r.int(2, 9), x = r.int(2, 15), b = r.int(1, 20); return Q('m', `Solve for x: ${a}x + ${b} = ${a * x + b}`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 9), x = r.int(3, 15), b = r.int(1, 2 * x); return Q('m', `Solve for x: ${a}x ${MINUS} ${b} = ${a * x - b}`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 6), x = r.int(2, 12), b = r.int(1, 9); return Q('h', `Solve for x: ${a}(x + ${b}) = ${a * (x + b)}`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 8), k = r.int(2, 9), b = r.int(1, 15); return Q('m', `Solve for x: x/${a} + ${b} = ${k + b}`, a * k, [`x=${a * k}`]); },
  ] },
  { leadin: 'Answer these questions about lines and slope.', fns: [
    (r) => { const m = r.int(-6, 6) || 2, x1 = r.int(-5, 5), y1 = r.int(-9, 9), dx = r.int(1, 5); return Q('m', `What is the slope of the line through the points (${x1}, ${y1}) and (${x1 + dx}, ${y1 + m * dx})?`, m); },
    (r) => { const m = r.int(2, 9), b = r.int(-9, 9) || 3; return Q('e', `What is the y-intercept of the line y = ${m}x${con(b)}?`, b); },
    (r) => { const a = r.int(2, 9), b = r.int(-9, 9) || 1, k = r.int(1, 8); return Q('e', `If f(x) = ${a}x${con(b)}, what is f(${k})?`, a * k + b); },
    (r) => { const a = r.int(2, 6), x = r.int(1, 9); return Q('h', `What is the x-intercept of the line y = ${a}x ${MINUS} ${a * x}?`, x); },
    (r) => { const a = r.int(2, 9), c = r.int(5, 40); return Q('h', `What is the slope of the line ${a}x + y = ${c}?`, -a); },
    (r) => { const k = r.pick([2, 3, 4, 5, 6, 8, 10]); return FQ('h', `What is the slope of any line perpendicular to a line with slope ${k}?`, -1, k); },
  ] },
  { leadin: 'Answer these questions about evaluating expressions.', fns: [
    (r) => { const a = r.int(2, 5), b = r.int(1, 6), c = r.int(1, 9), k = r.int(1, 5); return Q('m', `Evaluate ${coef(a)}x²${lin(-b)}${con(c)} when x = ${k}.`, a * k * k - b * k + c); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9); return Q('m', `Evaluate x² + y² when x = ${a} and y = ${b}.`, a * a + b * b); },
    (r) => { const a = r.int(2, 6), b = r.int(1, 9), k = r.int(1, 9); return Q('m', `Evaluate ${a}(x + ${b}) when x = ${k}.`, a * (k + b)); },
    (r) => { const a = r.int(2, 9), k = r.int(2, 4); return Q('h', `Evaluate ${a}x³ when x = ${k}.`, a * k ** 3); },
  ] },
  { leadin: 'Answer these questions about exponents and polynomials.', fns: [
    (r) => { const a = r.int(2, 6), b = r.int(2, 6); return Q('m', `Simplify x${sup(a)} · x${sup(b)}.`, `x^${a + b}`); },
    (r) => { const n = r.int(2, 5), m = r.int(n + 2, 9); return Q('m', `Simplify x${sup(m)} ÷ x${sup(n)}.`, m - n === 1 ? 'x' : `x^${m - n}`); },
    (r) => { const a = r.int(2, 5), b = r.int(2, 5); return Q('m', `Simplify (x${sup(a)})${sup(b)}.`, `x^${a * b}`); },
    (r) => { const b = r.int(2, 60); return Q('e', `What is ${b}⁰?`, 1); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(1, 8); return Q('m', `Simplify: ${a}x + ${b}x ${MINUS} ${c}x`, `${a + b - c}x`); },
    (r) => { const a = r.int(1, 7), b = r.int(1, 7), c = r.int(1, 7), d = r.int(1, 7); return PQ('m', `Simplify: (${pd([a, b])}) + (${pd([c, d])})`, [a + c, b + d]); },
    (r) => { const d = r.int(3, 9); return Q('m', `What is the degree of the polynomial ${pd([r.int(1, 5), ...new Array(d - 1).fill(0), r.int(1, 9)])}?`, d); },
  ] },
  { leadin: 'Answer these questions about inequalities and systems.', fns: [
    (r) => { const a = r.int(2, 6), b = r.int(1, 9), k = r.int(1, 12); return Q('m', `What is the smallest integer that satisfies ${a}x + ${b} > ${a * k + b}?`, k + 1); },
    (r) => { const a = r.int(2, 15), b = r.int(5, 30); return Q('m', `What is the largest integer that satisfies x ${MINUS} ${a} < ${b}?`, a + b - 1); },
    (r) => { const x = r.int(2, 15), y = r.int(1, x - 1); return Q('h', `If x + y = ${x + y} and x ${MINUS} y = ${x - y}, what is x?`, x, [`x=${x}`]); },
    (r) => { const x = r.int(2, 15), y = r.int(1, x - 1); return Q('h', `If x + y = ${x + y} and x ${MINUS} y = ${x - y}, what is y?`, y, [`y=${y}`]); },
    (r) => { const x = r.int(5, 30), y = r.int(1, x - 1); return Q('h', `The sum of two numbers is ${x + y} and their difference is ${x - y}. What is the larger number?`, x); },
  ] },
  { leadin: 'Answer these questions about expanding and factoring.', fns: [
    (r) => { const a = r.int(1, 9), b = r.int(1, 9); return PQ('h', `Expand: (x + ${a})(x + ${b})`, [1, a + b, a * b]); },
    (r) => { const a = r.int(2, 12); return Q('h', `Factor: x² ${MINUS} ${a * a}`, `(x-${a})(x+${a})`, [`(x+${a})(x-${a})`]); },
    (r) => { const a = r.int(2, 9), b = r.int(1, 9); return PQ('h', `Expand: (x + ${a})(x ${MINUS} ${b})`, [1, a - b, -a * b]); },
    (r) => { const c = r.int(2, 6), k = r.int(2, 9), x = r.int(2, 9); return Q('m', `Solve the proportion: x/${c * k} = ${x}/${c}`, x * k, [`x=${x * k}`]); },
  ] },
  { leadin: 'Answer these questions about absolute value and proportions.', fns: [
    (r) => { const a = r.int(2, 60); return Q('e', `What is |${MINUS}${a}|?`, a); },
    (r) => { const a = r.int(3, 12), b = r.int(1, 12); return Q('m', `What is the larger solution of |x ${MINUS} ${a}| = ${b}?`, a + b, [`x=${a + b}`]); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9); return Q('m', `What is |${a} ${MINUS} ${a + b}|?`, b); },
    (r) => { const a = r.int(2, 8), k = r.int(2, 9); return Q('m', `If ${a} pencils cost $${a * k}, how many dollars do ${a * 3} pencils cost?`, 3 * a * k); },
  ] },
];

const GEOM = [
  { leadin: 'Answer these questions about perimeter and area.', fns: [
    (r) => { const a = r.int(3, 20), b = r.int(2, 15); return Q('e', `What is the area of a rectangle with length ${a} and width ${b}?`, a * b); },
    (r) => { const a = r.int(3, 20), b = r.int(2, 15); return Q('e', `What is the perimeter of a rectangle with length ${a} and width ${b}?`, 2 * (a + b)); },
    (r) => { const a = r.int(2, 15); return Q('e', `What is the area of a square whose sides each have length ${a}?`, a * a); },
    (r) => { let b = r.int(4, 20), h = r.int(3, 14); if (b % 2 && h % 2) h++; return Q('m', `What is the area of a triangle with base ${b} and height ${h}?`, (b * h) / 2); },
    (r) => { const b = r.int(4, 18), h = r.int(3, 12); return Q('m', `What is the area of a parallelogram with base ${b} and height ${h}?`, b * h); },
    (r) => { let b1 = r.int(3, 12), b2 = r.int(4, 14), h = r.int(2, 10); if ((b1 + b2) % 2 && h % 2) h++; return Q('h', `What is the area of a trapezoid with parallel sides ${b1} and ${b2} and height ${h}?`, ((b1 + b2) * h) / 2); },
    (r) => { const a = r.int(3, 20); return Q('e', `What is the perimeter of a square whose sides each have length ${a}?`, 4 * a); },
  ] },
  { leadin: 'Answer these questions about circles. Give answers in terms of π.', fns: [
    (r) => { const rad = r.int(2, 15); return Q('m', `What is the circumference of a circle with radius ${rad}?`, `${2 * rad}pi`); },
    (r) => { const rad = r.int(2, 15); return Q('m', `What is the area of a circle with radius ${rad}?`, `${rad * rad}pi`); },
    (r) => { const rad = r.int(2, 20); return Q('e', `What is the radius of a circle with diameter ${2 * rad}?`, rad); },
    (r) => { const d = r.int(3, 20); return Q('m', `What is the circumference of a circle with diameter ${d}?`, `${d}pi`); },
    (r) => { const rad = r.int(2, 15); return Q('m', `A circle has circumference ${2 * rad}π. What is its radius?`, rad); },
    (r) => { const deg = r.pick([30, 45, 60, 90, 120, 180, 270, 40, 72]); return FQ('m', `A central angle of a circle measures ${deg}°. What fraction of the whole circle does it cut off?`, deg, 360); },
  ] },
  { leadin: 'Answer these questions about angles.', fns: [
    (r) => { const a = r.int(5, 85); return Q('e', `What is the measure of the complement of a ${a}° angle?`, 90 - a); },
    (r) => { const a = r.int(5, 175); return Q('e', `What is the measure of the supplement of a ${a}° angle?`, 180 - a); },
    (r) => { const a = r.int(20, 90), b = r.int(20, 80); return Q('e', `Two angles of a triangle measure ${a}° and ${b}°. What is the third angle, in degrees?`, 180 - a - b); },
    (r) => { const n = r.int(5, 12); return Q('m', `What is the sum of the interior angles of a polygon with ${n} sides, in degrees?`, (n - 2) * 180); },
    (r) => { const n = r.pick([3, 4, 5, 6, 8, 9, 10, 12]); return Q('h', `What is the measure of each interior angle of a regular polygon with ${n} sides, in degrees?`, ((n - 2) * 180) / n); },
    (r) => { const apex = 2 * r.int(10, 70); return Q('m', `An isosceles triangle has an apex angle of ${apex}°. What is the measure of each base angle?`, (180 - apex) / 2); },
    (r) => { const a = r.int(20, 160); return Q('e', `Two straight lines cross, and one of the angles formed measures ${a}°. What is the measure of the angle next to it?`, 180 - a); },
  ] },
  { leadin: 'Answer these questions about right triangles.', fns: [
    (r) => { const [a, b, c] = r.pick(TRIPLES); return Q('m', `A right triangle has legs of length ${a} and ${b}. What is the length of its hypotenuse?`, c); },
    (r) => { const [a, b, c] = r.pick(TRIPLES); return Q('m', `A right triangle has a hypotenuse of length ${c} and one leg of length ${a}. What is the length of the other leg?`, b); },
    (r) => { const [a, b, c] = r.pick(TRIPLES); return Q('h', `The sides of a rectangle measure ${a} and ${b}. What is the length of its diagonal?`, c); },
    (r) => { const [a, b, c] = r.pick(TRIPLES); return Q('h', `A ladder ${c} feet long leans against a wall with its base ${a} feet from the wall. How high up the wall does it reach, in feet?`, b); },
    (r) => { const k = r.int(2, 6); const [dx, dy, c] = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10]]); return Q('h', `What is the distance between the points (0, 0) and (${dx * k}, ${dy * k})?`, c * k); },
  ] },
  { leadin: 'Answer these questions about solids.', fns: [
    (r) => { const a = r.int(2, 12); return Q('m', `What is the volume of a cube with edges of length ${a}?`, a ** 3); },
    (r) => { const a = r.int(2, 12), b = r.int(2, 10), c = r.int(2, 9); return Q('m', `What is the volume of a rectangular box with length ${a}, width ${b}, and height ${c}?`, a * b * c); },
    (r) => { const a = r.int(2, 12); return Q('h', `What is the total surface area of a cube with edges of length ${a}?`, 6 * a * a); },
    (r) => { const rad = r.int(2, 6), h = r.int(2, 10); return Q('h', `What is the volume of a cylinder with radius ${rad} and height ${h}? Give the answer in terms of π.`, `${rad * rad * h}pi`); },
  ] },
  { leadin: 'Answer these questions about polygons.', fns: [
    (r) => { const n = r.int(5, 14); return Q('h', `How many diagonals does a polygon with ${n} sides have?`, (n * (n - 3)) / 2); },
    (r) => { const n = r.int(3, 20); return Q('e', `What is the perimeter of a regular polygon with ${n} sides, each of length 4?`, 4 * n); },
    (r) => { const n = r.pick([6, 8, 10, 12]); return Q('m', `A regular polygon has ${n} sides, each of length 5. What is its perimeter?`, 5 * n); },
    (r) => { const n = r.int(3, 12); return Q('m', `A polygon with ${n} sides is cut into triangles by drawing diagonals from one vertex. How many triangles are formed?`, n - 2); },
  ] },
  { leadin: 'Answer these questions about the coordinate plane.', fns: [
    (r) => { const a = r.int(-8, 8), b = r.int(-8, 8); return Q('m', `What are the coordinates of the point (${neg(a)}, ${neg(b)}) after a reflection across the x-axis?`, `(${a},${-b})`); },
    (r) => { const a = r.int(-8, 8) || 3, b = r.int(-8, 8); return Q('m', `What are the coordinates of the point (${neg(a)}, ${neg(b)}) after a reflection across the y-axis?`, `(${-a},${b})`); },
    (r) => { const a = r.int(-6, 6), b = r.int(-6, 6), c = a + 2 * r.int(1, 5), d = b + 2 * r.int(1, 5); return Q('m', `What is the midpoint of the segment with endpoints (${neg(a)}, ${neg(b)}) and (${neg(c)}, ${neg(d)})?`, `(${(a + c) / 2},${(b + d) / 2})`); },
    (r) => { const a = r.int(1, 9), b = r.int(1, 9); return Q('e', `In which quadrant is the point (${a}, ${MINUS}${b})?`, 4, ['IV', 'fourth quadrant', 'quadrant 4']); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9); return Q('e', `What is the area of the rectangle with corners at (0, 0), (${a}, 0), (${a}, ${b}), and (0, ${b})?`, a * b); },
  ] },
  { leadin: 'Answer these questions about similar figures.', fns: [
    (r) => { const p = r.int(1, 4), q = p + r.int(1, 3), k = r.int(2, 6); return Q('m', `Two similar triangles have corresponding sides in the ratio ${p} to ${q}. If a side of the smaller triangle measures ${p * k}, how long is the matching side of the larger triangle?`, q * k); },
    (r) => { const p = r.int(1, 4), q = p + r.int(1, 3); return FQ('h', `Two similar triangles have corresponding sides in the ratio ${p} to ${q}. What is the ratio of their areas, written as a fraction of the smaller area to the larger?`, p * p, q * q); },
    (r) => { const k = r.int(2, 6), a = r.int(2, 9); return Q('m', `A square has sides of length ${a}. A larger square has sides ${k} times as long. What is the side length of the larger square?`, a * k); },
  ] },
];

// ------------------------------------------------------------ JV templates
const ALG2 = [
  { leadin: 'Answer these questions about quadratic equations.', fns: [
    (r) => { const p = r.int(-6, 8), q = r.int(-6, 8); return Q('m', `What is the sum of the solutions of x²${lin(-(p + q))}${con(p * q)} = 0?`, p + q); },
    (r) => { const p = r.int(-6, 8), q = r.int(-6, 8); return Q('m', `What is the product of the solutions of x²${lin(-(p + q))}${con(p * q)} = 0?`, p * q); },
    (r) => { const a = r.int(2, 15); return Q('e', `What is the positive solution of x² = ${a * a}?`, a, [`x=${a}`]); },
    (r) => { const h = r.int(-8, 9) || 3, c = r.int(-9, 9); return Q('m', `What is the x-coordinate of the vertex of the parabola y = x²${lin(-2 * h)}${con(c)}?`, h); },
    (r) => { const a = r.int(1, 3), b = r.int(-8, 8), c = r.int(-8, 8); return Q('m', `What is the discriminant of ${coef(a)}x²${lin(b)}${con(c)}?`, b * b - 4 * a * c); },
    (r) => { const h = r.int(2, 12); return Q('m', `What constant must be added to x² + ${2 * h}x to complete the square?`, h * h); },
    (r) => { const p = r.int(1, 9), q = r.int(1, 9); return Q('e', `What is the larger solution of (x ${MINUS} ${p})(x ${MINUS} ${q}) = 0?`, Math.max(p, q), [`x=${Math.max(p, q)}`]); },
    (r) => { const c = r.int(-12, 12) || 5, a = r.int(1, 5), b = r.int(-6, 6); return Q('e', `What is the y-intercept of the parabola y = ${coef(a)}x²${lin(b)}${con(c)}?`, c); },
    (r) => { const h = r.int(1, 9), k = r.int(-5, 9); return Q('h', `What is the minimum value of y = x²${lin(-2 * h)}${con(h * h + k)}?`, k); },
  ] },
  { leadin: 'Answer these questions about exponents and logarithms.', fns: [
    (r) => { const b = r.pick([2, 3, 5, 10]), k = r.int(2, 5); return Q('m', `What is log${sub(b)}(${b ** k})?`, k); },
    (r) => { const b = r.pick([2, 3, 4, 5]), k = r.int(2, 3); return FQ('h', `What is ${b}⁻${sup(k)}?`, 1, b ** k, true); },
    (r) => { const k = r.int(2, 8); return Q('m', `What is ln(e${sup(k)})?`, k); },
    (r) => { const b = r.pick([2, 3, 5]), k = r.int(2, 5); return Q('m', `Solve for x: ${b}^x = ${b ** k}`, k, [`x=${k}`]); },
    (r) => { const b = r.pick([2, 3, 4, 5, 10]), k = r.int(2, 4); return Q('m', `Solve for x: log${sub(b)}(x) = ${k}`, b ** k, [`x=${b ** k}`]); },
    (r) => { const b = r.pick([2, 3, 5]), a = r.int(2, 6), c = r.int(2, 6); return Q('m', `Write as a single power of ${b}: ${b}${sup(a)} · ${b}${sup(c)}`, `${b}^${a + c}`, [String(b ** (a + c))]); },
    (r) => { const P = r.pick([100, 250, 500, 1000, 40]), k = r.int(2, 5); return Q('m', `A population of ${P} doubles every year. How many are there after ${k} years?`, P * 2 ** k); },
    (r) => { const k = r.int(1, 4); return Q('m', `What is log${sub(10)}(${'0.' + '0'.repeat(k - 1) + '1'})?`, -k); },
    (r) => { const b = r.pick([2, 3]), m = r.int(2, 4), n = r.int(2, 4); return Q('h', `What is log${sub(b)}(${b ** m}) + log${sub(b)}(${b ** n})?`, m + n); },
  ] },
  { leadin: 'Answer these questions about radicals and complex numbers.', fns: [
    (r) => { const a = r.int(2, 6), b = r.pick(sqfree); return Q('m', `Write √${a * a * b} in simplest radical form.`, `${a}sqrt(${b})`); },
    (r) => { const n = r.int(2, 40); const v = ['1', 'i', '-1', '-i'][n % 4]; return Q('m', `What is i${sup(n)}, where i = √(${MINUS}1)?`, v); },
    (r) => { const a = r.int(-9, 9), b = r.int(-9, 9) || 2, c = r.int(-9, 9), d = r.int(-9, 9) || 3; return Q('m', `What is (${cshow(a, b)}) + (${cshow(c, d)})? Write the answer in the form a + bi.`, cplx(a + c, b + d)); },
    (r) => { const a = r.int(1, 9), b = r.int(1, 9); return Q('h', `What is (${a} + ${b}i)(${a} ${MINUS} ${b}i)?`, a * a + b * b); },
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 6)); return Q('h', `What is the absolute value (modulus) of the complex number ${a} + ${b}i?`, c); },
    (r) => { const a = r.int(1, 5), b = r.int(1, 5), c = r.int(1, 5), d = r.int(1, 5); return Q('h', `What is (${a} + ${b}i)(${c} + ${d}i)? Write the answer in the form a + bi.`, cplx(a * c - b * d, a * d + b * c)); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is ${a ** 3}^(1/3)?`, a); },
    (r) => { const a = r.int(2, 6); return Q('h', `What is ${a * a}^(3/2)?`, a ** 3); },
  ] },
  { leadin: 'Answer these questions about sequences and series.', fns: [
    (r) => { const a = r.int(-5, 20), d = r.int(2, 7), n = r.int(8, 15); return Q('m', `The first term of an arithmetic sequence is ${neg(a)} and the common difference is ${d}. What is the ${n}th term?`, a + (n - 1) * d); },
    (r) => { const a = r.int(1, 6), rr = r.int(2, 3), n = r.int(4, 6); return Q('m', `The first term of a geometric sequence is ${a} and the common ratio is ${rr}. What is the ${n}th term?`, a * rr ** (n - 1)); },
    (r) => { const a = r.int(1, 5), d = r.int(1, 4), n = r.int(5, 10); return Q('h', `What is the sum of the first ${n} terms of the arithmetic sequence that starts at ${a} with common difference ${d}?`, (n * (2 * a + (n - 1) * d)) / 2); },
    (r) => { const a = r.int(1, 12), k = r.int(2, 5); return FQ('h', `What is the sum of the infinite geometric series with first term ${a} and common ratio 1/${k}?`, a * k, k - 1); },
    (r) => { const n = r.int(5, 30); return Q('m', `What is 1 + 2 + 3 + … + ${n}?`, (n * (n + 1)) / 2); },
  ] },
  { leadin: 'Answer these questions about functions.', fns: [
    (r) => { const a = r.int(2, 5), b = r.int(-5, 5), c = r.int(2, 5), d = r.int(-5, 5), k = r.int(1, 4); return Q('m', `If f(x) = ${a}x${con(b)} and g(x) = ${c}x${con(d)}, what is f(g(${k}))?`, a * (c * k + d) + b); },
    (r) => { const a = r.int(2, 12); return Q('m', `What is the inverse function of f(x) = x + ${a}?`, `x-${a}`); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is the inverse function of f(x) = ${a}x?`, `x/${a}`); },
    (r) => { const a = r.int(-9, 9) || 4; return Q('m', `What value of x is excluded from the domain of 1/(x ${a < 0 ? '+' : MINUS} ${Math.abs(a)})?`, a); },
    (r) => { const a = r.int(-8, 8) || 5; return Q('m', `What is the smallest value of x in the domain of √(x ${a < 0 ? '+' : MINUS} ${Math.abs(a)})?`, a); },
    (r) => { const a = r.int(1, 9), b = r.int(1, 9); return Q('m', `The graph of y = x² is shifted ${a} unit${a === 1 ? '' : 's'} right and ${b} unit${b === 1 ? '' : 's'} up. What is the vertex of the new graph?`, `(${a},${b})`); },
    (r) => { const a = r.int(2, 9), b = r.int(1, 9); return Q('h', `What is the sum of the solutions of |x ${MINUS} ${a}| = ${b}?`, 2 * a); },
    (r) => { const a = r.int(2, 7), k = r.int(2, 9), n = r.int(4, 15); return Q('m', `If y varies directly with x and y = ${a * k} when x = ${k}, what is y when x = ${n}?`, a * n); },
  ] },
  { leadin: 'Answer these questions about polynomials.', fns: [
    (r) => { const a = r.int(1, 4), b = r.int(-6, 6), k = r.int(1, 3); return Q('h', `What is the remainder when x³${lin(a)}${con(b)} is divided by x ${MINUS} ${k}?`, k ** 3 + a * k + b); },
    (r) => { const n = r.int(3, 9); return Q('e', `How many solutions, counting multiplicity, does a polynomial equation of degree ${n} have?`, n); },
    (r) => { const p = r.int(1, 6), q = r.int(1, 6), s = r.int(1, 6); return Q('m', `What is the largest solution of (x ${MINUS} ${p})(x ${MINUS} ${q})(x ${MINUS} ${s}) = 0?`, Math.max(p, q, s)); },
    (r) => { const a = r.int(1, 5), b = r.int(1, 9), c = r.int(1, 9); return Q('m', `What is the sum of the coefficients of ${coef(a)}x² + ${coef(b)}x + ${c}?`, a + b + c); },
    (r) => { const s = r.int(2, 12), a = r.int(2, 9), b = r.int(2, 9); return Q('h', `What is the sum of the solutions of x³ ${MINUS} ${s}x² + ${a}x ${MINUS} ${b} = 0?`, s); },
  ] },
  { leadin: 'Answer these questions about rational expressions and inequalities.', fns: [
    (r) => { const a = r.int(2, 9), x = r.int(2, 12), c = r.int(2, 9); return Q('m', `Solve for x: ${a}/x = ${a * c}/${x * c}`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 6), b = r.int(2, 6), k = r.int(2, 6); return Q('h', `What is the smallest integer solution of ${a}x ${MINUS} ${b} > ${a * k - b}?`, k + 1); },
    (r) => { const a = r.int(3, 9); return Q('m', `What is the largest integer that satisfies |x| < ${a}?`, a - 1); },
  ] },
];

// Trigonometric values: only the special angles a student is expected to know (0, 30, 45, 60, 90 degrees).
const SIN = { 0: '0', 30: '1/2', 45: 'sqrt(2)/2', 60: 'sqrt(3)/2', 90: '1' };
const COS = { 0: '1', 30: 'sqrt(3)/2', 45: 'sqrt(2)/2', 60: '1/2', 90: '0' };
const TAN = { 0: '0', 30: 'sqrt(3)/3', 45: '1', 60: 'sqrt(3)' };
const halfAlt = (s) => (s === '1/2' ? ['0.5'] : s === '-1/2' ? ['-0.5'] : []);
const RAD = { 0: '0', 30: 'π/6', 45: 'π/4', 60: 'π/3', 90: 'π/2' };
// Other quadrants (sine and cosine only): the reference-angle values, with the sign.
const SIN_Q = { 120: 'sqrt(3)/2', 135: 'sqrt(2)/2', 150: '1/2', 180: '0', 210: '-1/2', 225: '-sqrt(2)/2', 240: '-sqrt(3)/2', 270: '-1', 300: '-sqrt(3)/2', 315: '-sqrt(2)/2', 330: '-1/2' };
const COS_Q = { 120: '-1/2', 135: '-sqrt(2)/2', 150: '-sqrt(3)/2', 180: '-1', 210: '-sqrt(3)/2', 225: '-sqrt(2)/2', 240: '-1/2', 270: '0', 300: '1/2', 315: 'sqrt(2)/2', 330: 'sqrt(3)/2' };
const TRIG = [
  { leadin: 'Answer these questions about exact trigonometric values. Give exact values, not decimals.', fns: [
    (r) => { const d = r.pick([0, 30, 45, 60, 90]); return Q('e', `What is the exact value of sin ${d}°?`, SIN[d], halfAlt(SIN[d])); },
    (r) => { const d = r.pick([0, 30, 45, 60, 90]); return Q('e', `What is the exact value of cos ${d}°?`, COS[d], halfAlt(COS[d])); },
    (r) => { const d = r.pick([0, 30, 45, 60]); return Q('m', `What is the exact value of tan ${d}°?`, TAN[d]); },
    (r) => { const d = r.pick([0, 30, 45, 60, 90]); return Q('m', `What is the exact value of sin(${RAD[d]})?`, SIN[d], halfAlt(SIN[d])); },
    (r) => { const d = r.pick([0, 30, 45, 60, 90]); return Q('m', `What is the exact value of cos(${RAD[d]})?`, COS[d], halfAlt(COS[d])); },
    (r) => { const d = r.pick([0, 30, 45, 60]); return Q('h', `What is the exact value of tan(${RAD[d]})?`, TAN[d]); },
    (r) => { const d = r.pick(Object.keys(SIN_Q).map(Number)); return Q('h', `What is the exact value of sin ${d}°?`, SIN_Q[d], halfAlt(SIN_Q[d])); },
    (r) => { const d = r.pick(Object.keys(COS_Q).map(Number)); return Q('h', `What is the exact value of cos ${d}°?`, COS_Q[d], halfAlt(COS_Q[d])); },
  ] },
  { leadin: 'Answer these questions about radians and arcs.', fns: [
    (r) => { const d = r.pick([30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360]); return Q('m', `Convert ${d}° to radians. Give the answer in terms of π.`, piMul(d, 180)); },
    (r) => { const d = r.pick([2, 3, 4, 5, 6, 9, 10, 12, 18, 20]); return Q('m', `Convert π/${d} radians to degrees.`, 180 / d); },
    (r) => { const rad = r.pick([3, 4, 6, 9, 12]), deg = r.pick([30, 60, 90, 120, 45, 150]); return Q('h', `What is the length of the arc cut off by a central angle of ${deg}° in a circle of radius ${rad}? Give the answer in terms of π.`, piMul(rad * deg, 180)); },
    (r) => { const [n, dd] = r.pick([[2, 3], [3, 4], [5, 6], [7, 6], [5, 4], [4, 3], [3, 2], [5, 3], [7, 4], [11, 6]]); return Q('m', `Convert ${n}π/${dd} radians to degrees.`, (180 * n) / dd); },
  ] },
  { leadin: 'Answer these questions about right triangles and identities.', fns: [
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 4)); return FQ('m', `A right triangle has sides ${a}, ${b}, and hypotenuse ${c}. What is the sine of the angle opposite the side of length ${a}?`, a, c); },
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 4)); return FQ('m', `A right triangle has sides ${a}, ${b}, and hypotenuse ${c}. What is the cosine of the angle opposite the side of length ${a}?`, b, c); },
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 4)); return FQ('m', `A right triangle has sides ${a}, ${b}, and hypotenuse ${c}. What is the tangent of the angle opposite the side of length ${a}?`, a, b); },
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 4)); return FQ('h', `An acute angle has sin θ = ${a}/${c}. What is cos θ?`, b, c); },
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 4)); return FQ('h', `An acute angle has cos θ = ${b}/${c}. What is tan θ?`, a, b); },
    (r) => { const a = r.int(2, 30); return Q('m', `What is sin²(${a}°) + cos²(${a}°)?`, 1); },
  ] },
  { leadin: 'Answer these questions about inverse functions and angles.', fns: [
    (r) => { const [t, v, a] = r.pick([['arcsin', '1/2', 30], ['arcsin', '√3/2', 60], ['arcsin', '√2/2', 45], ['arccos', '1/2', 60], ['arccos', '0', 90], ['arccos', '√3/2', 30], ['arctan', '1', 45], ['arctan', '0', 0], ['arcsin', '1', 90], ['arccos', '1', 0]]); return Q('m', `What is ${t}(${v}), in degrees?`, a); },
    (r) => { const [t, v, a] = r.pick([['arcsin', '1/2', 'pi/6'], ['arcsin', '√3/2', 'pi/3'], ['arcsin', '√2/2', 'pi/4'], ['arccos', '1/2', 'pi/3'], ['arccos', '0', 'pi/2'], ['arccos', '√3/2', 'pi/6'], ['arctan', '1', 'pi/4'], ['arctan', '√3', 'pi/3']]); return Q('h', `What is ${t}(${v}), in radians?`, a); },
    (r) => { const d = r.pick([120, 135, 150, 210, 225, 240, 300, 315, 330]); const ref = d < 180 ? 180 - d : d < 270 ? d - 180 : 360 - d; return Q('m', `What is the reference angle of ${d}°?`, ref); },
    (r) => { const d = r.pick([380, 400, 420, 450, 500, 720, 765, -30, -45, -90, -120, -180]); return Q('m', `What angle between 0° and 360° is coterminal with ${neg(d)}°?`, ((d % 360) + 360) % 360); },
    (r) => { const [q, s] = r.pick([['II', 'sine is positive and cosine is negative'], ['III', 'sine and cosine are both negative'], ['IV', 'sine is negative and cosine is positive'], ['I', 'sine and cosine are both positive']]); return Q('m', `In which quadrant of the coordinate plane ${s}?`, { II: 2, III: 3, IV: 4, I: 1 }[q], [`quadrant ${q}`, q, `quadrant ${{ II: 2, III: 3, IV: 4, I: 1 }[q]}`]); },
  ] },
  { leadin: 'Answer these questions about graphs of trigonometric functions.', fns: [
    (r) => { const k = r.pick([2, 3, 4, 5, 6, 8]); return Q('m', `What is the period of y = sin(${k}x), in radians?`, piMul(2, k)); },
    (r) => { const a = r.int(2, 9); return Q('e', `What is the amplitude of y = ${a} sin x?`, a); },
    () => Q('e', 'What is the period of y = cos x, in radians?', '2pi'),
    () => Q('e', 'What is the period of y = tan x, in radians?', 'pi'),
    (r) => { const a = r.int(2, 8), b = r.int(1, 6); return Q('m', `What is the maximum value of y = ${a} sin x + ${b}?`, a + b); },
    (r) => { const a = r.int(2, 8), b = r.int(1, 6); return Q('m', `What is the minimum value of y = ${a} cos x ${MINUS} ${b}?`, -a - b); },
  ] },
  { leadin: 'Answer these questions about special triangles and the laws of sines and cosines.', fns: [
    (r) => { const k = r.int(2, 9); return Q('m', `In a 30-60-90 triangle, the shorter leg has length ${k}. What is the length of the hypotenuse?`, 2 * k); },
    (r) => { const k = r.int(2, 9); return Q('m', `In a 30-60-90 triangle, the shorter leg has length ${k}. What is the length of the longer leg?`, `${k}sqrt(3)`); },
    (r) => { const k = r.int(2, 12); return Q('m', `In a 45-45-90 triangle, each leg has length ${k}. What is the length of the hypotenuse?`, `${k}sqrt(2)`); },
    (r) => { const a = r.int(2, 14); return Q('m', `In a 45-45-90 triangle, the hypotenuse has length ${a}√2. What is the length of each leg?`, a); },
    (r) => { const a = r.int(2, 9); return Q('h', `In a triangle, side a = ${a} is opposite angle A = 30°, and side b is opposite angle B = 45°. What is the length of side b?`, `${a}sqrt(2)`); },
    (r) => { const a = r.int(2, 9); return Q('h', `In a triangle, side a = ${a} is opposite angle A = 30°, and side b is opposite angle B = 60°. What is the length of side b?`, `${a}sqrt(3)`); },
    (r) => { const a = r.int(2, 8), b = r.int(2, 8); return Q('h', `In a triangle, two sides have lengths ${a} and ${b}, and the angle between them measures 60°. What is the square of the length of the third side?`, a * a + b * b - a * b); },
  ] },
  { leadin: 'Answer these questions about the unit circle.', fns: [
    (r) => { const d = r.pick([0, 30, 45, 60, 90, 180, 270]); const c = { 180: '-1', 270: '0' }[d] ?? COS[d]; const s = { 180: '0', 270: '-1' }[d] ?? SIN[d]; return Q('m', `What are the coordinates of the point on the unit circle at an angle of ${d}°?`, `(${c},${s})`); },
    (r) => { const d = r.pick([30, 45, 60]); return Q('m', `sin ${d}° equals cos of what angle between 0° and 90°?`, 90 - d); },
  ] },
];

// ------------------------------------------------------------ varsity templates
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
const nCr = (n, k) => fact(n) / (fact(k) * fact(n - k));
const PRECALC = [
  { leadin: 'Answer these questions about counting.', fns: [
    (r) => { const k = r.int(2, 4), n = r.int(k + 3, k === 4 ? 9 : 12); return Q('m', `What is C(${n}, ${k}), also written "${n} choose ${k}"?`, nCr(n, k)); },
    (r) => { const n = r.int(4, 9), k = r.int(2, 3); return Q('m', `In how many ways can ${k} different books be chosen and arranged in order from a shelf of ${n} different books?`, fact(n) / fact(n - k)); },
    (r) => { const n = r.int(3, 8); return Q('e', `What is ${n}!?`, fact(n)); },
    (r) => { const n = r.int(4, 9); return Q('h', `What is the coefficient of x² in the expansion of (x + 1)${sup(n)}?`, nCr(n, 2)); },
    (r) => { const n = r.int(4, 8), k = r.int(2, 3); return Q('m', `How many different committees of ${k} people can be formed from a group of ${n} people?`, nCr(n, k)); },
  ] },
  { leadin: 'Answer these questions about matrices and vectors.', fns: [
    (r) => { const a = r.int(1, 9), b = r.int(1, 9), c = r.int(1, 9), d = r.int(1, 9); return Q('m', `What is the determinant of the matrix with first row (${a}, ${b}) and second row (${c}, ${d})?`, a * d - b * c); },
    (r) => { const a = r.int(-5, 6), b = r.int(-5, 6), c = r.int(-5, 6), d = r.int(-5, 6); return Q('m', `What is the dot product (${neg(a)}, ${neg(b)}) · (${neg(c)}, ${neg(d)})?`, a * c + b * d); },
    (r) => { const [a, b, c] = r.pick(TRIPLES); return Q('m', `What is the magnitude of the vector (${a}, ${b})?`, c); },
    (r) => { const a = r.int(2, 6), b = r.int(2, 6), c = r.int(2, 6), d = r.int(2, 6); return Q('m', `What is 2[(${a}, ${b}) + (${c}, ${d})]?`, `(${2 * (a + c)},${2 * (b + d)})`); },
  ] },
  { leadin: 'Answer these questions about conic sections.', fns: [
    (r) => { const a = r.int(2, 15); return Q('e', `What is the radius of the circle x² + y² = ${a * a}?`, a); },
    (r) => { const h = r.int(-6, 6) || 2, k = r.int(-6, 6) || 3; return Q('m', `What is the center of the circle (x${con(-h)})² + (y${con(-k)})² = 25?`, `(${h},${k})`); },
    (r) => { const a = r.int(2, 9), b = r.int(1, a - 1) || 1; return Q('m', `What is the length of the major axis of the ellipse x²/${a * a} + y²/${b * b} = 1?`, 2 * a); },
    (r) => { const p = r.int(1, 9); return Q('h', `What is the distance from the vertex to the focus of the parabola y² = ${4 * p}x?`, p); },
    (r) => { const a = r.int(2, 6), b = r.int(2, 9); return FQ('h', `What is the slope of the positive asymptote of the hyperbola x²/${a * a} ${MINUS} y²/${b * b} = 1?`, b, a); },
  ] },
  { leadin: 'Answer these questions about logarithms and exponential equations.', fns: [
    (r) => { const m = r.int(2, 6), n = r.int(2, 6); return Q('m', `What is log${sub(2)}(${2 ** m}) + log${sub(2)}(${2 ** n})?`, m + n); },
    (r) => { const k = r.int(2, 9); return FQ('m', `Solve for x: 2^(2x) = ${2 ** k}`, k, 2); },
    (r) => { const k = r.int(3, 9); return Q('m', `Solve for x: 2^(x + 1) = ${2 ** k}`, k - 1, [`x=${k - 1}`]); },
    (r) => { const b = r.pick([2, 3, 5]), m = r.int(3, 6), n = r.int(1, 2); return Q('h', `What is log${sub(b)}(${b ** m}) ${MINUS} log${sub(b)}(${b ** n})?`, m - n); },
    (r) => { const b = r.pick([2, 3, 4]), k = r.int(1, 3); return Q('h', `What is log${sub(b)}(1/${b ** k})?`, -k); },
  ] },
  { leadin: 'Answer these questions about sequences and limits.', fns: [
    (r) => { const a = r.int(1, 5), c = r.int(1, 5), b = r.int(1, 9), d = r.int(1, 9); return FQ('m', `What is the limit of (${coef(a)}x + ${b})/(${coef(c)}x + ${d}) as x → ∞?`, a, c); },
    (r) => { const a = r.int(2, 9), r2 = r.int(2, 3); return Q('m', `Each term of a sequence is ${r2} times the previous term, and the first term is ${a}. What is the fifth term?`, a * r2 ** 4); },
    (r) => { const a = r.int(1, 4); return Q('h', `The first term of a sequence is ${a}, and each later term is twice the previous term plus 1. What is the fourth term?`, ((a * 2 + 1) * 2 + 1) * 2 + 1); },
  ] },
  { leadin: 'Answer these questions about trigonometric identities.', fns: [
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 3)); return FQ('h', `An acute angle θ has sin θ = ${a}/${c}. What is sin 2θ?`, 2 * a * b, c * c); },
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 3)); return FQ('h', `An acute angle θ has sin θ = ${a}/${c}. What is cos 2θ?`, b * b - a * a, c * c); },
    (r) => { const d = r.pick([15, 30, 45, 60]); return Q('m', `What is sin²(${d}°) + cos²(${d}°)?`, 1); },
    (r) => { const [x, v] = r.pick([[15, '1/2'], [30, 'sqrt(3)/2'], [45, '1']]); return Q('m', `What is sin(2x) when x = ${x}°?`, v, halfAlt(v)); },
  ] },
  { leadin: 'Answer these questions about polar coordinates and complex numbers.', fns: [
    (r) => { const k = r.int(1, 9); return Q('m', `What are the rectangular coordinates of the polar point (r, θ) = (${k}, 90°)?`, `(0,${k})`); },
    (r) => { const k = r.int(1, 9); return Q('m', `What are the rectangular coordinates of the polar point (r, θ) = (${k}, 180°)?`, `(${-k},0)`); },
    (r) => { const k = r.int(1, 9); return Q('m', `What are the rectangular coordinates of the polar point (r, θ) = (${k}, 270°)?`, `(0,${-k})`); },
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 6)); return Q('m', `What is the distance from the origin to the complex number ${a} + ${b}i in the complex plane?`, c); },
  ] },
  { leadin: 'Answer these questions about functions and equations.', fns: [
    (r) => { const a = r.int(2, 5), b = r.int(1, 9), k = r.int(1, 9); return Q('m', `If f(x) = ${a}x + ${b}, what is f⁻¹(${a * k + b})?`, k); },
    (r) => { const s = r.int(2, 12), a = r.int(2, 9), b = r.int(2, 9); return Q('h', `What is the sum of the solutions of x³ ${MINUS} ${s}x² + ${a}x ${MINUS} ${b} = 0?`, s); },
    (r) => { const a = r.int(1, 4), b = r.int(-6, 6), k = r.int(1, 3); return Q('h', `What is the remainder when x³ + ${coef(a)}x²${lin(b)} + 2 is divided by x ${MINUS} ${k}?`, k ** 3 + a * k * k + b * k + 2); },
    (r) => { const p = r.int(1, 5), q = r.int(1, 5); return Q('m', `What is the largest zero of (x ${MINUS} ${p})(x + ${q})(x ${MINUS} ${p + q})?`, Math.max(p, -q, p + q)); },
  ] },
];

const CALC = [
  { leadin: 'Answer these questions about derivatives of polynomials.', fns: [
    (r) => { const a = r.int(1, 7), b = r.int(2, 6), c = r.int(1, 9); const cc = [a, ...new Array(b - 1).fill(0), c]; const d = cc.slice(0, -1).map((k, i) => k * (b - i)); return PQ('m', `What is the derivative of ${pd(cc)} with respect to x?`, d); },
    (r) => { const a = r.int(1, 6), b = r.int(1, 9), c = r.int(1, 9); return PQ('m', `What is the derivative of ${pd([a, b, c])} with respect to x?`, [2 * a, b]); },
    (r) => { const a = r.int(1, 5), b = r.int(1, 6), c = r.int(1, 8), d = r.int(1, 9); return PQ('h', `What is the derivative of ${pd([a, b, c, d])} with respect to x?`, [3 * a, 2 * b, c]); },
    (r) => { const n = r.int(3, 8), a = r.int(1, 6); return PQ('m', `What is the derivative of ${coef(a)}${xp(n)} with respect to x?`, [a * n, ...new Array(n - 1).fill(0)]); },
    (r) => { const a = r.int(1, 4), b = r.int(1, 6), k = r.int(1, 4); return Q('m', `If f(x) = ${coef(a)}x³ ${MINUS} ${coef(b)}x, what is f′(${k})?`, 3 * a * k * k - b); },
    (r) => { const n = r.int(3, 7), a = r.int(1, 5); return PQ('h', `What is the second derivative of ${coef(a)}${xp(n)} with respect to x?`, [a * n * (n - 1), ...new Array(n - 2).fill(0)]); },
    (r) => { const n = r.int(2, 5), k = r.int(1, 3); return Q('m', `What is the slope of the tangent line to y = ${xp(n)} at x = ${k}?`, n * k ** (n - 1)); },
  ] },
  { leadin: 'Answer these questions about derivatives of other functions.', fns: [
    (r) => { const a = r.int(2, 9); return Q('m', `What is the derivative of ${a}eˣ?`, `${a}e^x`); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is the derivative of ${a} ln x?`, `${a}/x`); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is the derivative of ${a} sin x?`, `${a}cos(x)`, [`${a}cos x`, `${a}cosx`]); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is the derivative of ${a} cos x?`, `-${a}sin(x)`, [`-${a}sin x`, `-${a}sinx`]); },
    (r) => { const a = r.int(2, 6); return Q('h', `What is the derivative of e^(${a}x)?`, `${a}e^(${a}x)`, [`${a}e^${a}x`]); },
    (r) => { const a = r.int(1, 5), k = r.int(1, 3); return Q('h', `If f(x) = x(x + ${a}), what is f′(${k})?`, 2 * k + a); },
    (r) => { const a = r.int(1, 3), k = r.int(1, 2); return Q('h', `If f(x) = (x² + ${a})², what is f′(${k})?`, 2 * (k * k + a) * 2 * k); },
  ] },
  { leadin: 'Answer these questions about limits.', fns: [
    (r) => { const a = r.int(2, 12); return Q('m', `What is lim(x→${a}) (x² ${MINUS} ${a * a})/(x ${MINUS} ${a})?`, 2 * a); },
    (r) => { const a = r.int(1, 5), b = r.int(1, 9), c = r.int(1, 9), k = r.int(1, 4); return Q('e', `What is lim(x→${k}) (${coef(a)}x² + ${coef(b)}x + ${c})?`, a * k * k + b * k + c); },
    (r) => { const a = r.int(2, 9); return Q('h', `What is lim(x→0) sin(${a}x)/x?`, a); },
    (r) => { const a = r.int(2, 8), b = r.int(1, 6); return Q('m', `What is lim(x→${a}) (x² + ${coef(b)}x ${MINUS} ${a * a + a * b})/(x ${MINUS} ${a})?`, 2 * a + b); },
    (r) => { const a = r.int(2, 9), c = r.int(2, 9); return FQ('m', `What is the limit of (${a}x² + 1)/(${c}x² + 5) as x → ∞?`, a, c); },
  ] },
  { leadin: 'Answer these questions about integrals.', fns: [
    (r) => { const n = r.int(1, 6), a = (n + 1) * r.int(1, 4); const c = a / (n + 1); return Q('m', `Find ∫ ${coef(a)}${xp(n)} dx. Include the constant of integration.`, `${c === 1 ? '' : c}x^${n + 1}+C`, [`${c === 1 ? '' : c}x^${n + 1} + C`]); },
    (r) => { const n = r.int(1, 4), b = r.int(1, 4), a = (n + 1) * r.int(1, 3); return Q('h', `What is ∫${sub(0)}${sup(b)} ${coef(a)}${xp(n)} dx?`, (a * b ** (n + 1)) / (n + 1)); },
    (r) => { const b = r.int(2, 9); return Q('m', `What is ∫${sub(0)}${sup(b)} 2x dx?`, b * b); },
    (r) => { const a = r.int(1, 9), b = r.int(2, 6); return Q('m', `What is ∫${sub(0)}${sup(b)} ${a} dx?`, a * b); },
    (r) => { const a = r.int(2, 9); return Q('m', `Find ∫ ${a}eˣ dx. Include the constant of integration.`, `${a}e^x+C`, [`${a}e^x + C`]); },
  ] },
  { leadin: 'Answer these questions about maxima, minima, and motion.', fns: [
    (r) => { const h = r.int(1, 12); return Q('m', `At what value of x does f(x) = x² ${MINUS} ${2 * h}x have its minimum?`, h, [`x=${h}`]); },
    (r) => { const h = r.int(1, 9); return Q('h', `What is the maximum value of f(x) = ${MINUS}x² + ${2 * h}x?`, h * h); },
    (r) => { const a = r.int(1, 9), k = r.int(1, 5); return Q('m', `A particle's position is s(t) = t³ + ${coef(a)}t. What is its velocity at t = ${k}?`, 3 * k * k + a); },
    (r) => { const k = r.int(1, 8); return Q('m', `A particle's position is s(t) = t³. What is its acceleration at t = ${k}?`, 6 * k); },
    (r) => { const a = r.int(2, 9); return Q('h', `At what positive value of x does f(x) = x³ ${MINUS} ${3 * a * a}x have a local minimum?`, a, [`x=${a}`]); },
    (r) => { const a = r.int(1, 6), k = r.int(1, 4); return Q('m', `What is the area under the curve y = ${2 * a}x from x = 0 to x = ${k}?`, a * k * k); },
  ] },
];

// ---------------------------------------------------------------- engine
const CELLS = [
  ['ncal', 'novice', 'Math', 'Arithmetic', ARITH, 1], ['ncal', 'novice', 'Math', 'Algebra 1', ALG1, 2], ['ncal', 'novice', 'Math', 'Geometry', GEOM, 3],
  ['ncal', 'jv', 'Math', 'Algebra 2', ALG2, 4], ['ncal', 'jv', 'Math', 'Trigonometry', TRIG, 5],
  ['ncal', 'varsity', 'Math', 'Pre-Calculus', PRECALC, 6], ['ncal', 'varsity', 'Math', 'Calculus', CALC, 7],
];

const seen = new Set();
const key = (t) => normalizeText(t); // same normalization as the duplicate gate ("thirty" == "30")
// Never regenerate a question that already exists in the seed or batch 1.
for (const f of ['../../seed/questions.json', '../../batches/questions-batch-1.json']) {
  for (const q of JSON.parse(readFileSync(new URL(f, import.meta.url), 'utf8'))) {
    if (q.type === 'tossup') seen.add(key(q.text));
    else for (const part of q.parts) seen.add(key(part.text));
  }
}
// ...nor anything another writer's file already has (re-run this generator after the writers finish).
for (const f of readdirSync(new URL('./data/', import.meta.url)).filter((n) => n.endsWith('.txt') && !n.startsWith('gen-'))) {
  try {
    for (const q of parseBank(readFileSync(new URL(`./data/${f}`, import.meta.url), 'utf8'), f)) {
      if (q.type === 'tossup') seen.add(key(q.text));
      else for (const part of q.parts) seen.add(key(part.text));
    }
  } catch { /* a file that is mid-edit: skip it */ }
}
// "|" separates fields in the bank format, so absolute-value bars are written as the look-alike "∣" (U+2223).
const clean = (s) => String(s).replace(/\|/g, '∣');
const dl = (d) => ({ e: 0, m: 1, h: 2 }[d]);
const line = (d, text, ans, alts) => `${d}|${clean(text)}|${clean(ans)}|${alts.map(clean).join(';')}|m`;

let out = '// Generated by scripts/bank/gen-math.mjs. Do not edit by hand: change the generator and re-run it.\n';
let total = 0;
for (const [rs, level, cat, sub, topics, seed] of CELLS) {
  const t = targets.find((x) => x.rulesetId === rs && x.level === level && x.subcategory === sub);
  const r = makeRng(0x9e3779b1 * seed);
  const fresh = (fn) => { for (let i = 0; i < 400; i++) { const q = fn(r); if (!seen.has(key(q.text))) { seen.add(key(q.text)); return q; } } return null; };
  out += `\n# ${rs} ${level} | ${cat} | ${sub}\n`;
  const allFns = topics.flatMap((tp) => tp.fns);

  const tossups = [];
  const want = t.tossups + 3;
  for (let i = 0; tossups.length < want && i < want * 40; i++) {
    const q = fresh(allFns[i % allFns.length]);
    if (q) tossups.push(q);
  }
  if (tossups.length < want) throw new Error(`${sub}: only ${tossups.length}/${want} tossups`);

  const bonuses = [];
  const wantB = t.bonuses + 1;
  for (let i = 0; bonuses.length < wantB && i < wantB * 40; i++) {
    const topic = topics[i % topics.length];
    const parts = [];
    for (let j = 0; j < 4; j++) { const q = fresh(topic.fns[(i + j * 3 + j) % topic.fns.length]); if (q) parts.push(q); }
    if (parts.length >= 3) bonuses.push({ leadin: topic.leadin, parts });
  }
  if (bonuses.length < wantB) throw new Error(`${sub}: only ${bonuses.length}/${wantB} bonuses`);

  // Difficulty is relative to the level: relabel by quantile (35% easy, 45% medium, 20% hard),
  // ranking by the template's own easy/medium/hard hint, ties broken at random.
  // Ties within a template's hint are broken by how heavy the question is (digits to handle), not at random,
  // so a trivial question can never outrank a heavy one of the same kind.
  const weight = (q) => (q.text.match(/\d/g) ?? []).length + q.ans.length * 0.5;
  const label = (items, score) => {
    const order = items.map((it, i) => [score(it), it.text ? weight(it) : 0, i]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const n = order.length;
    order.forEach(([, , i], k) => { items[i].nd = k < n * 0.35 ? 'e' : k < n * 0.8 ? 'm' : 'h'; });
  };
  label(tossups, (q) => dl(q.d));
  label(bonuses.flatMap((bq) => bq.parts), (q) => dl(q.d));
  for (const bq of bonuses) bq.parts.sort((x, y) => dl(x.nd) - dl(y.nd));
  label(bonuses, (bq) => bq.parts.reduce((sum, q) => sum + dl(q.nd), 0) / bq.parts.length);

  for (const q of tossups) out += line(q.nd, q.text, q.ans, q.alts) + '\n';
  for (const bq of bonuses) {
    out += `B|${bq.nd}|${clean(bq.leadin)}\n`;
    for (const q of bq.parts) out += `-|${q.nd}|${clean(q.text)}|${clean(q.ans)}|${q.alts.map(clean).join(';')}|m\n`;
  }
  total += tossups.length + bonuses.length;
}
writeFileSync(new URL('./data/gen-ncal-math.txt', import.meta.url), out);
console.log(`wrote scripts/bank/data/gen-ncal-math.txt (${total} questions: tossups plus bonuses)`);
