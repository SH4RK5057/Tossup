// Generates the NCAL math subjects (computed answers, so every key is correct by construction).
// Writes scripts/bank/data/gen-ncal-math.txt in the compact bank format. Run: npx vite-node scripts/bank/gen-math.mjs
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
const Q = (d, text, ans, alts = []) => ({ d, text, ans: String(ans), alts });
const FQ = (d, text, n, dd, dec = true) => { const f = fr(n, dd); return Q(d, text, f.ans, dec ? f.alts : []); };
const sgn = (n) => (n < 0 ? `minus ${-n}` : `plus ${n}`);
const num = (n) => (n < 0 ? `negative ${-n}` : String(n));
const sqfree = [2, 3, 5, 6, 7, 10];

/** Polynomial in x from coefficients (high degree first), e.g. [1,5,6] -> x^2+5x+6. */
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
const polyWords = (c) => poly(c).replace(/\^(\d+)/g, ' to the power $1').replace(/\+/g, ' plus ').replace(/-/g, ' minus ');
const PQ = (d, text, c) => Q(d, text, poly(c), poly(c) === poly(c, true) ? [] : [poly(c, true)]);
/** n*pi/d reduced, written like 2pi, pi/3, 5pi/6. */
function piMul(n, d) {
  const g = gcd(n, d) || 1;
  n /= g; d /= g;
  const top = n === 1 ? 'pi' : `${n}pi`;
  return d === 1 ? top : `${top}/${d}`;
}
const cplx = (re, im) => {
  const imag = im === 0 ? '' : `${im < 0 ? '-' : re === 0 && im > 0 ? '' : '+'}${Math.abs(im) === 1 ? '' : Math.abs(im)}i`;
  if (im === 0) return String(re);
  if (re === 0) return imag.replace(/^\+/, '');
  return `${re}${imag}`;
};
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 12, 15], [6, 8, 10], [12, 16, 20], [15, 20, 25], [9, 40, 41], [12, 35, 37], [10, 24, 26]];
const ord = (n) => `number ${n}`;

// ------------------------------------------------------------ novice templates
const ARITH = [
  { leadin: 'Answer these questions about whole-number arithmetic.', fns: [
    (r) => { const a = r.int(12, 899), b = r.int(12, 899); return Q('e', `What is ${a} plus ${b}?`, a + b); },
    (r) => { const a = r.int(100, 999), b = r.int(10, a - 1); return Q('e', `What is ${a} minus ${b}?`, a - b); },
    (r) => { const a = r.int(3, 12), b = r.int(3, 12); return Q('e', `What is ${a} times ${b}?`, a * b); },
    (r) => { const a = r.int(12, 99), b = r.int(3, 9); return Q('m', `What is ${a} times ${b}?`, a * b); },
    (r) => { const a = r.int(12, 49), b = r.int(12, 49); return Q('h', `What is ${a} times ${b}?`, a * b); },
    (r) => { const b = r.int(3, 12), q = r.int(3, 40); return Q('e', `What is ${b * q} divided by ${b}?`, q); },
    (r) => { const b = r.int(3, 9), a = b * r.int(3, 12) + r.int(1, b - 1); return Q('m', `What is the remainder when ${a} is divided by ${b}?`, a % b); },
    (r) => { const a = r.int(100, 500), b = r.int(100, 500), c = r.int(100, 500); return Q('m', `What is ${a} plus ${b} plus ${c}?`, a + b + c); },
  ] },
  { leadin: 'Answer these questions about percents and decimals.', fns: [
    (r) => { const p = r.pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 75]), n = 20 * r.int(2, 30); return Q('m', `What is ${p} percent of ${n}?`, (p * n) / 100); },
    (r) => { const p = r.int(1, 99); return Q('e', `What is ${p} percent written as a decimal?`, p / 100); },
    (r) => { const p = r.int(1, 99); return Q('e', `What percent is the decimal ${p / 100}?`, p, [`${p}%`]); },
    (r) => { const d = r.pick([2, 4, 5, 8, 10, 20, 25]); let n = r.int(1, d - 1); while (gcd(n, d) !== 1) n = r.int(1, d - 1); return Q('m', `What is the fraction ${n}/${d} written as a decimal?`, n / d); },
    (r) => { const [n, d] = r.pick([[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 8], [3, 8], [1, 20], [7, 20], [9, 20], [1, 10], [3, 10]]); return Q('m', `What is the decimal ${n / d} written as a fraction in lowest terms?`, frac(n, d)); },
    (r) => { const p = 20 * r.int(3, 20), pct = r.pick([10, 20, 25, 50]); return Q('m', `A jacket costs ${p} dollars and is ${pct} percent off. What is the sale price in dollars?`, (p * (100 - pct)) / 100); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9); return Q('h', `What is ${a * 10 + b} percent of 200?`, ((a * 10 + b) * 200) / 100); },
  ] },
  { leadin: 'Answer these questions about fractions.', fns: [
    (r) => { const g = r.int(2, 6), d = r.int(3, 12); let n = r.int(1, d - 1); while (gcd(n, d) !== 1) n = r.int(1, d - 1); return Q('e', `Simplify the fraction ${n * g}/${d * g} to lowest terms.`, frac(n, d)); },
    (r) => { const d = r.int(5, 12), a = r.int(1, d - 1), b = r.int(1, d - 1); return Q('e', `What is ${a}/${d} plus ${b}/${d}? Give the answer in lowest terms.`, frac(a + b, d)); },
    (r) => { const [d1, d2] = r.pick([[2, 3], [2, 5], [3, 4], [3, 5], [4, 5], [2, 7], [3, 7], [5, 6], [4, 9]]); const a = r.int(1, d1 - 1), b = r.int(1, d2 - 1); return Q('h', `What is ${a}/${d1} plus ${b}/${d2}? Give the answer in lowest terms.`, frac(a * d2 + b * d1, d1 * d2)); },
    (r) => { const a = r.int(1, 5), b = r.int(a + 1, 8), c = r.int(1, 5), d = r.int(c + 1, 8); return Q('m', `What is ${a}/${b} times ${c}/${d}? Give the answer in lowest terms.`, frac(a * c, b * d)); },
    (r) => { const a = r.int(1, 5), b = r.int(a + 1, 8), c = r.int(1, 5), d = r.int(c + 1, 8); return Q('h', `What is ${a}/${b} divided by ${c}/${d}? Give the answer in lowest terms.`, frac(a * d, b * c)); },
    (r) => { const b = r.int(3, 9), a = r.int(1, b - 1), k = r.int(2, 9); return Q('m', `What is ${a}/${b} of ${b * k}?`, a * k); },
    (r) => { const w = r.int(1, 6), d = r.int(3, 9); let n = r.int(1, d - 1); while (gcd(n, d) !== 1) n = r.int(1, d - 1); return Q('m', `Write the mixed number ${w} and ${n}/${d} as an improper fraction.`, `${w * d + n}/${d}`); },
  ] },
  { leadin: 'Answer these questions about factors and multiples.', fns: [
    (r) => { const g = r.int(2, 9); let a = g * r.int(2, 9), b = g * r.int(2, 9); while (a === b) b = g * r.int(2, 9); return Q('m', `What is the greatest common factor of ${a} and ${b}?`, gcd(a, b)); },
    (r) => { let a = r.int(2, 12), b = r.int(2, 12); while (a === b) b = r.int(2, 12); return Q('m', `What is the least common multiple of ${a} and ${b}?`, (a * b) / gcd(a, b)); },
    (r) => { const n = r.pick([12, 18, 20, 24, 28, 30, 36, 40, 42, 48, 60]); let c = 0; for (let i = 1; i <= n; i++) if (n % i === 0) c++; return Q('h', `How many positive factors does ${n} have?`, c); },
    (r) => { const p = r.pick([7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43]); let n = p + 1; const isP = (x) => { for (let i = 2; i * i <= x; i++) if (x % i === 0) return false; return x > 1; }; while (!isP(n)) n++; return Q('m', `What is the smallest prime number greater than ${p}?`, n); },
    (r) => { const n = r.pick([10, 20, 30, 40, 50]); const c = { 10: 4, 20: 8, 30: 10, 40: 12, 50: 15 }[n]; return Q('m', `How many prime numbers are less than ${n}?`, c); },
    (r) => { const a = r.int(2, 6), b = r.int(2, 6), c = r.int(2, 6); return Q('h', `What is the least common multiple of ${a * 2}, ${b * 3}, and ${c * 5}?`, (() => { const l2 = (x, y) => (x * y) / gcd(x, y); return l2(l2(a * 2, b * 3), c * 5); })()); },
  ] },
  { leadin: 'Answer these questions about powers and roots.', fns: [
    (r) => { const a = r.int(3, 25); return Q(a > 15 ? 'm' : 'e', `What is ${a} squared?`, a * a); },
    (r) => { const a = r.int(2, 10); return Q('m', `What is ${a} cubed?`, a ** 3); },
    (r) => { const a = r.int(3, 20); return Q('e', `What is the square root of ${a * a}?`, a); },
    (r) => { const k = r.int(4, 12); return Q('m', `What is 2 raised to the power ${k}?`, 2 ** k); },
    (r) => { const a = r.int(2, 10); return Q('m', `What is the cube root of ${a ** 3}?`, a); },
    (r) => { const k = r.int(3, 6); return Q('m', `What is 10 raised to the power ${k}?`, 10 ** k); },
    (r) => { const a = r.int(2, 5), b = r.int(2, 4); return Q('h', `What is ${a} raised to the power ${b + 1}?`, a ** (b + 1)); },
  ] },
  { leadin: 'Answer these questions about number sense.', fns: [
    (r) => { let n = r.int(100, 9999); while (n % 10 === 5) n = r.int(100, 9999); return Q('e', `What is ${n} rounded to the nearest ten?`, Math.round(n / 10) * 10); },
    (r) => { let n = r.int(1000, 99999); while (n % 100 === 50) n = r.int(1000, 99999); return Q('m', `What is ${n} rounded to the nearest hundred?`, Math.round(n / 100) * 100); },
    (r) => { let x = r.int(100, 999); while (x % 10 === 5) x = r.int(100, 999); return Q('m', `What is ${x / 100} rounded to the nearest tenth?`, (Math.round(x / 10) / 10).toFixed(1).replace(/\.0$/, '') === String(Math.round(x / 10) / 10) ? Math.round(x / 10) / 10 : (Math.round(x / 10) / 10)); },
    (r) => { const a = r.int(2, 30), b = r.int(2, 30); return Q('m', `What is negative ${a} plus ${b}?`, b - a); },
    (r) => { const a = r.int(2, 12), b = r.int(2, 12); return Q('m', `What is negative ${a} times negative ${b}?`, a * b); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9); return Q('m', `What is ${a} plus ${b} times ${c}, using the order of operations?`, a + b * c); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9); return Q('m', `What is ${a} times the quantity ${b} plus ${c}?`, a * (b + c)); },
    (r) => { const avg = r.int(5, 50), v = [r.int(3, 40), r.int(3, 40), r.int(3, 40)]; let last = 4 * avg - v.reduce((x, y) => x + y, 0); if (last < 1) { v[0] = 1; v[1] = 1; v[2] = 1; last = 4 * avg - 3; } return Q('m', `What is the average of the numbers ${v.join(', ')}, and ${last}?`, avg); },
    (r) => { const s = new Set(); while (s.size < 5) s.add(r.int(2, 60)); const a = [...s]; return Q('m', `What is the median of the numbers ${a.join(', ')}?`, [...a].sort((x, y) => x - y)[2]); },
    (r) => { const a = r.int(2, 12), b = r.int(2, 12); return Q('h', `What is the absolute value of negative ${a * b} minus ${a}?`, a * b + a); },
  ] },
  { leadin: 'Answer these questions about units of measurement.', fns: [
    (r) => { const [f, t, k, fn] = r.pick([['hours', 'minutes', 60, 'hour'], ['feet', 'inches', 12, 'foot'], ['yards', 'feet', 3, 'yard'], ['pounds', 'ounces', 16, 'pound'], ['weeks', 'days', 7, 'week'], ['kilometers', 'meters', 1000, 'kilometer'], ['meters', 'centimeters', 100, 'meter'], ['gallons', 'quarts', 4, 'gallon'], ['minutes', 'seconds', 60, 'minute'], ['days', 'hours', 24, 'day']]); const n = r.int(2, 9); return Q('e', `How many ${t} are in ${n} ${f}?`, n * k); },
    (r) => { const n = r.int(2, 9); return Q('m', `How many inches are in ${n} yards?`, n * 36); },
    (r) => { const n = r.int(2, 6); return Q('m', `How many seconds are in ${n} minutes and 30 seconds?`, n * 60 + 30); },
    (r) => { const n = r.int(2, 5); return Q('h', `How many minutes are in ${n} days?`, n * 1440); },
  ] },
  { leadin: 'Answer these word problems.', fns: [
    (r) => { const a = r.int(6, 24), b = r.int(3, 12); return Q('e', `A box holds ${a} pencils. How many pencils are in ${b} boxes?`, a * b); },
    (r) => { const a = r.int(30, 70), b = r.int(2, 9); return Q('e', `A train travels ${a} miles per hour for ${b} hours. How many miles does it travel?`, a * b); },
    (r) => { const a = r.int(40, 99), b = r.int(5, a - 5); return Q('e', `Tom has ${a} dollars and spends ${b} dollars. How many dollars does he have left?`, a - b); },
    (r) => { const b = r.int(3, 9), q = r.int(2, 12); return Q('e', `If ${b * q} apples are shared equally among ${b} children, how many apples does each child get?`, q); },
    (r) => { const p = r.int(8, 40), k = r.int(3, 9); return Q('m', `A shirt costs ${p} dollars. How much do ${k} shirts cost, in dollars?`, p * k); },
    (r) => { const a = r.int(12, 40), b = r.int(2, 6), c = r.int(5, 20); return Q('h', `A store sells ${a} notebooks each day for ${b} days. Then ${c} notebooks are returned. How many notebooks were sold in all?`, a * b - c); },
    (r) => { const a = r.int(3, 9), b = r.int(4, 12), c = r.int(2, 8); return Q('h', `Maria buys ${a} packs of stickers with ${b} stickers in each pack and gives away ${c} stickers. How many stickers does she have left?`, a * b - c); },
  ] },
];

const ALG1 = [
  { leadin: 'Solve these one-step equations.', fns: [
    (r) => { const a = r.int(2, 30), x = r.int(2, 40); return Q('e', `Solve for x: x plus ${a} equals ${x + a}.`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 30), x = r.int(2, 40); return Q('e', `Solve for x: x minus ${a} equals ${x - a}.`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 12), x = r.int(2, 15); return Q('e', `Solve for x: ${a}x equals ${a * x}.`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 9), x = r.int(2, 12); return Q('m', `Solve for x: x divided by ${a} equals ${x}.`, a * x, [`x=${a * x}`]); },
  ] },
  { leadin: 'Solve these two-step equations.', fns: [
    (r) => { const a = r.int(2, 9), x = r.int(2, 15), b = r.int(1, 20); return Q('m', `Solve for x: ${a}x plus ${b} equals ${a * x + b}.`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 9), x = r.int(3, 15), b = r.int(1, 2 * x); return Q('m', `Solve for x: ${a}x minus ${b} equals ${a * x - b}.`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 6), x = r.int(2, 12), b = r.int(1, 9); return Q('h', `Solve for x: ${a} times the quantity x plus ${b} equals ${a * (x + b)}.`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 8), k = r.int(2, 9), b = r.int(1, 15); return Q('m', `Solve for x: x divided by ${a}, plus ${b}, equals ${k + b}.`, a * k, [`x=${a * k}`]); },
  ] },
  { leadin: 'Answer these questions about lines and slope.', fns: [
    (r) => { const m = r.int(-6, 6) || 2, x1 = r.int(-5, 5), y1 = r.int(-9, 9), dx = r.int(1, 5); return Q('m', `What is the slope of the line through the points (${x1}, ${y1}) and (${x1 + dx}, ${y1 + m * dx})?`, m); },
    (r) => { const m = r.int(2, 9), b = r.int(-9, 9) || 3; return Q('e', `What is the y-intercept of the line y equals ${m}x ${sgn(b)}?`, b); },
    (r) => { const a = r.int(2, 9), b = r.int(-9, 9) || 1, k = r.int(1, 8); return Q('e', `If f of x equals ${a}x ${sgn(b)}, what is f of ${k}?`, a * k + b); },
    (r) => { const a = r.int(2, 6), x = r.int(1, 9); return Q('h', `What is the x-intercept of the line y equals ${a}x minus ${a * x}?`, x); },
    (r) => { const a = r.int(2, 9), c = r.int(5, 40); return Q('h', `What is the slope of the line ${a}x plus y equals ${c}?`, -a); },
    (r) => { const k = r.pick([2, 3, 4, 5, 6, 8, 10]); return FQ('h', `What is the slope of any line perpendicular to a line with slope ${k}?`, -1, k); },
  ] },
  { leadin: 'Answer these questions about evaluating expressions.', fns: [
    (r) => { const a = r.int(2, 5), b = r.int(1, 6), c = r.int(1, 9), k = r.int(1, 6); return Q('m', `What is the value of ${a}x squared minus ${b}x plus ${c} when x equals ${k}?`, a * k * k - b * k + c); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9); return Q('m', `What is the value of x squared plus y squared when x is ${a} and y is ${b}?`, a * a + b * b); },
    (r) => { const a = r.int(2, 6), b = r.int(1, 9), k = r.int(1, 9); return Q('m', `What is the value of ${a} times the quantity x plus ${b} when x equals ${k}?`, a * (k + b)); },
    (r) => { const a = r.int(2, 9), k = r.int(2, 5); return Q('h', `What is the value of ${a}x cubed when x equals ${k}?`, a * k ** 3); },
  ] },
  { leadin: 'Answer these questions about exponents and polynomials.', fns: [
    (r) => { const a = r.int(2, 6), b = r.int(2, 6); return Q('m', `What is x to the power ${a} times x to the power ${b}, written as a single power of x?`, `x^${a + b}`); },
    (r) => { const n = r.int(2, 5), m = r.int(n + 2, 9); return Q('m', `What is x to the power ${m} divided by x to the power ${n}, written as a single power of x?`, m - n === 1 ? 'x' : `x^${m - n}`); },
    (r) => { const a = r.int(2, 5), b = r.int(2, 5); return Q('m', `What is x to the power ${a}, all raised to the power ${b}, written as a single power of x?`, `x^${a * b}`); },
    (r) => { const b = r.int(2, 60); return Q('e', `What is ${b} raised to the power zero?`, 1); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(1, 8); return Q('m', `Simplify: ${a}x plus ${b}x minus ${c}x.`, `${a + b - c}x`); },
    (r) => { const a = r.int(1, 7), b = r.int(1, 7), c = r.int(1, 7), d = r.int(1, 7); return PQ('h', `What is the sum of ${polyWords([a, b])} and ${polyWords([c, d])}?`, [a + c, b + d]); },
    (r) => { const d = r.int(3, 9); const c = [r.int(1, 5), r.int(1, 9), r.int(1, 9), r.int(1, 9)]; const cc = c.slice(0, 1); return Q('m', `What is the degree of the polynomial ${poly([...cc, ...new Array(d - 1).fill(0), r.int(1, 9)]).replace(/\^/g, ' to the power ')}?`, d); },
  ] },
  { leadin: 'Answer these questions about inequalities and systems.', fns: [
    (r) => { const a = r.int(2, 6), b = r.int(1, 9), k = r.int(1, 12); return Q('m', `What is the smallest integer that satisfies ${a}x plus ${b} is greater than ${a * k + b}?`, k + 1); },
    (r) => { const a = r.int(2, 15), b = r.int(5, 30); return Q('m', `What is the largest integer that satisfies x minus ${a} is less than ${b}?`, a + b - 1); },
    (r) => { const x = r.int(2, 15), y = r.int(1, x - 1); return Q('h', `If x plus y equals ${x + y} and x minus y equals ${x - y}, what is x?`, x, [`x=${x}`]); },
    (r) => { const x = r.int(2, 15), y = r.int(1, x - 1); return Q('h', `If x plus y equals ${x + y} and x minus y equals ${x - y}, what is y?`, y, [`y=${y}`]); },
    (r) => { const x = r.int(5, 30), y = r.int(1, x - 1); return Q('h', `The sum of two numbers is ${x + y} and their difference is ${x - y}. What is the larger number?`, x); },
  ] },
  { leadin: 'Answer these questions about expanding and factoring.', fns: [
    (r) => { const a = r.int(1, 9), b = r.int(1, 9); return PQ('h', `What is the product of x plus ${a} and x plus ${b}, written as a trinomial?`, [1, a + b, a * b]); },
    (r) => { const a = r.int(2, 12); return Q('h', `What is x squared minus ${a * a} written in factored form?`, `(x-${a})(x+${a})`, [`(x+${a})(x-${a})`]); },
    (r) => { const a = r.int(2, 9), b = r.int(1, 9); return PQ('h', `What is the product of x plus ${a} and x minus ${b}, written as a trinomial?`, [1, a - b, -a * b]); },
    (r) => { const c = r.int(2, 6), k = r.int(2, 9), x = r.int(2, 9); return Q('m', `Solve the proportion x over ${c * k} equals ${x} over ${c}.`, x * k, [`x=${x * k}`]); },
  ] },
  { leadin: 'Answer these questions about absolute value and proportions.', fns: [
    (r) => { const a = r.int(2, 60); return Q('e', `What is the absolute value of negative ${a}?`, a); },
    (r) => { const a = r.int(3, 12), b = r.int(1, 12); return Q('m', `What is the larger solution of the equation the absolute value of x minus ${a} equals ${b}?`, a + b, [`x=${a + b}`]); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9); return Q('h', `What is the value of the absolute value of ${a} minus ${a + b}?`, b); },
    (r) => { const a = r.int(2, 8), k = r.int(2, 9); return Q('m', `If ${a} pencils cost ${a * k} dollars, how many dollars do ${a * 3} pencils cost?`, 3 * a * k); },
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
  { leadin: 'Answer these questions about circles.', fns: [
    (r) => { const rad = r.int(2, 15); return Q('m', `What is the circumference of a circle with radius ${rad}? Give the answer in terms of pi.`, `${2 * rad}pi`); },
    (r) => { const rad = r.int(2, 15); return Q('m', `What is the area of a circle with radius ${rad}? Give the answer in terms of pi.`, `${rad * rad}pi`); },
    (r) => { const rad = r.int(2, 20); return Q('e', `What is the radius of a circle with diameter ${2 * rad}?`, rad); },
    (r) => { const d = r.int(3, 20); return Q('m', `What is the circumference of a circle with diameter ${d}? Give the answer in terms of pi.`, `${d}pi`); },
    (r) => { const rad = r.int(2, 15); return Q('m', `A circle has circumference ${2 * rad}pi. What is its radius?`, rad); },
    (r) => { const deg = r.pick([30, 45, 60, 90, 120, 180, 270, 40, 72]); return FQ('m', `A central angle of a circle measures ${deg} degrees. What fraction of the whole circle does it cut off?`, deg, 360); },
  ] },
  { leadin: 'Answer these questions about angles.', fns: [
    (r) => { const a = r.int(5, 85); return Q('e', `What is the measure of the complement of a ${a} degree angle?`, 90 - a); },
    (r) => { const a = r.int(5, 175); return Q('e', `What is the measure of the supplement of a ${a} degree angle?`, 180 - a); },
    (r) => { const a = r.int(20, 90), b = r.int(20, 80); return Q('e', `Two angles of a triangle measure ${a} degrees and ${b} degrees. What is the third angle, in degrees?`, 180 - a - b); },
    (r) => { const n = r.int(5, 12); return Q('m', `What is the sum of the interior angles of a polygon with ${n} sides, in degrees?`, (n - 2) * 180); },
    (r) => { const n = r.pick([3, 4, 5, 6, 8, 9, 10, 12]); return Q('h', `What is the measure of each interior angle of a regular polygon with ${n} sides, in degrees?`, ((n - 2) * 180) / n); },
    (r) => { const apex = 2 * r.int(10, 70); return Q('m', `An isosceles triangle has an apex angle of ${apex} degrees. What is the measure of each base angle?`, (180 - apex) / 2); },
    (r) => { const a = r.int(20, 160); return Q('e', `Two straight lines cross, and one of the angles formed measures ${a} degrees. What is the measure of the angle next to it?`, 180 - a); },
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
    (r) => { const rad = r.int(2, 8), h = r.int(2, 12); return Q('h', `What is the volume of a cylinder with radius ${rad} and height ${h}? Give the answer in terms of pi.`, `${rad * rad * h}pi`); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9); return Q('h', `What is the total surface area of a rectangular box with length ${a}, width ${b}, and height ${c}?`, 2 * (a * b + a * c + b * c)); },
  ] },
  { leadin: 'Answer these questions about polygons.', fns: [
    (r) => { const n = r.int(5, 14); return Q('h', `How many diagonals does a polygon with ${n} sides have?`, (n * (n - 3)) / 2); },
    (r) => { const n = r.int(3, 20); return Q('e', `What is the perimeter of a regular polygon with ${n} sides, each of length 4?`, 4 * n); },
    (r) => { const n = r.pick([6, 8, 10, 12]); return Q('m', `A regular polygon has ${n} sides, each of length 5. What is its perimeter?`, 5 * n); },
    (r) => { const n = r.int(3, 12); return Q('m', `A polygon with ${n} sides is cut into triangles by drawing diagonals from one vertex. How many triangles are formed?`, n - 2); },
  ] },
  { leadin: 'Answer these questions about the coordinate plane.', fns: [
    (r) => { const a = r.int(-8, 8), b = r.int(-8, 8); return Q('m', `What are the coordinates of the point (${a}, ${b}) after a reflection across the x-axis?`, `(${a},${-b})`); },
    (r) => { const a = r.int(-8, 8) || 3, b = r.int(-8, 8); return Q('m', `What are the coordinates of the point (${a}, ${b}) after a reflection across the y-axis?`, `(${-a},${b})`); },
    (r) => { const a = r.int(-6, 6), b = r.int(-6, 6), c = a + 2 * r.int(1, 5), d = b + 2 * r.int(1, 5); return Q('m', `What is the midpoint of the segment with endpoints (${a}, ${b}) and (${c}, ${d})?`, `(${(a + c) / 2},${(b + d) / 2})`); },
    (r) => { const a = r.int(1, 9), b = r.int(1, 9); return Q('e', `In which quadrant is the point (${a}, ${-b})?`, 4, ['IV', 'fourth quadrant', 'quadrant 4']); },
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
    (r) => { const p = r.int(-6, 8), q = r.int(-6, 8); return Q('m', `What is the sum of the solutions of x squared ${sgn(-(p + q))}x ${sgn(p * q)} equals zero?`, p + q); },
    (r) => { const p = r.int(-6, 8), q = r.int(-6, 8); return Q('m', `What is the product of the solutions of x squared ${sgn(-(p + q))}x ${sgn(p * q)} equals zero?`, p * q); },
    (r) => { const a = r.int(2, 15); return Q('e', `What is the positive solution of x squared equals ${a * a}?`, a, [`x=${a}`]); },
    (r) => { const h = r.int(-8, 9) || 3, c = r.int(-9, 9); return Q('m', `What is the x-coordinate of the vertex of the parabola y equals x squared ${sgn(-2 * h)}x ${sgn(c)}?`, h); },
    (r) => { const a = r.int(1, 4), b = r.int(-9, 9), c = r.int(-9, 9); return Q('m', `What is the discriminant of ${a}x squared ${sgn(b)}x ${sgn(c)}?`, b * b - 4 * a * c); },
    (r) => { const h = r.int(2, 12); return Q('m', `What constant must be added to x squared plus ${2 * h}x to complete the square?`, h * h); },
    (r) => { const p = r.int(1, 9), q = r.int(1, 9); return Q('m', `What is the larger solution of the equation (x minus ${p})(x minus ${q}) equals zero?`, Math.max(p, q), [`x=${Math.max(p, q)}`]); },
    (r) => { const c = r.int(-12, 12) || 5, a = r.int(1, 5), b = r.int(-6, 6); return Q('e', `What is the y-intercept of the parabola y equals ${a}x squared ${sgn(b)}x ${sgn(c)}?`, c); },
    (r) => { const h = r.int(1, 9), k = r.int(-5, 9); return Q('h', `What is the minimum value of y equals x squared ${sgn(-2 * h)}x ${sgn(h * h + k)}?`, k); },
  ] },
  { leadin: 'Answer these questions about exponents and logarithms.', fns: [
    (r) => { const b = r.pick([2, 3, 5, 10]), k = r.int(2, 5); return Q('m', `What is the base-${b} logarithm of ${b ** k}?`, k); },
    (r) => { const b = r.pick([2, 3, 4, 5]), k = r.int(2, 4); return FQ('h', `What is ${b} raised to the negative ${k} power?`, 1, b ** k, false); },
    (r) => { const k = r.int(2, 8); return Q('m', `What is the natural logarithm of e to the power ${k}?`, k); },
    (r) => { const b = r.pick([2, 3, 5]), k = r.int(2, 5); return Q('m', `Solve for x: ${b} to the power x equals ${b ** k}.`, k, [`x=${k}`]); },
    (r) => { const b = r.pick([2, 3, 4, 5, 10]), k = r.int(2, 4); return Q('m', `Solve for x: the base-${b} logarithm of x equals ${k}.`, b ** k, [`x=${b ** k}`]); },
    (r) => { const b = r.pick([2, 3, 5]), a = r.int(2, 6), c = r.int(2, 6); return Q('m', `What is ${b} to the power ${a} times ${b} to the power ${c}, written as a single power of ${b}?`, `${b}^${a + c}`); },
    (r) => { const P = r.pick([100, 250, 500, 1000, 40]), k = r.int(2, 6); return Q('m', `A population of ${P} doubles every year. How many are there after ${k} years?`, P * 2 ** k); },
    (r) => { const k = r.int(1, 4); return Q('m', `What is the base-10 logarithm of ${'0.' + '0'.repeat(k - 1) + '1'}?`, -k); },
    (r) => { const b = r.pick([2, 3]), m = r.int(2, 4), n = r.int(2, 4); return Q('h', `What is the base-${b} logarithm of ${b ** m} plus the base-${b} logarithm of ${b ** n}?`, m + n); },
  ] },
  { leadin: 'Answer these questions about radicals and complex numbers.', fns: [
    (r) => { const a = r.int(2, 9), b = r.pick(sqfree); return Q('h', `What is the square root of ${a * a * b} in simplest radical form?`, `${a}sqrt(${b})`); },
    (r) => { const n = r.int(2, 40); const v = ['1', 'i', '-1', '-i'][n % 4]; return Q('m', `What is i to the power ${n}, where i is the imaginary unit?`, v); },
    (r) => { const a = r.int(-9, 9), b = r.int(-9, 9) || 2, c = r.int(-9, 9), d = r.int(-9, 9) || 3; return Q('m', `What is the sum of ${cplx(a, b).replace(/\+/g, ' plus ').replace(/-/g, ' minus ')} and ${cplx(c, d).replace(/\+/g, ' plus ').replace(/-/g, ' minus ')}? Write the answer in the form a plus b i.`.replace('in the form a plus b i', 'in the form a plus bi'), cplx(a + c, b + d)); },
    (r) => { const a = r.int(1, 9), b = r.int(1, 9); return Q('h', `What is the product of ${a} plus ${b}i and ${a} minus ${b}i?`, a * a + b * b); },
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 6)); return Q('h', `What is the absolute value, or modulus, of the complex number ${a} plus ${b}i?`, c); },
    (r) => { const a = r.int(1, 6), b = r.int(1, 6), c = r.int(1, 6), d = r.int(1, 6); return Q('h', `What is the product of ${a} plus ${b}i and ${c} plus ${d}i?`, cplx(a * c - b * d, a * d + b * c)); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is ${a ** 3} raised to the one-third power?`, a); },
    (r) => { const a = r.int(2, 6); return Q('h', `What is ${a * a} raised to the three-halves power?`, a ** 3); },
  ] },
  { leadin: 'Answer these questions about sequences and series.', fns: [
    (r) => { const a = r.int(-5, 20), d = r.int(2, 9), n = r.int(8, 30); return Q('m', `The first term of an arithmetic sequence is ${a} and the common difference is ${d}. What is term number ${n}?`, a + (n - 1) * d); },
    (r) => { const a = r.int(1, 6), rr = r.int(2, 4), n = r.int(4, 7); return Q('m', `The first term of a geometric sequence is ${a} and the common ratio is ${rr}. What is term number ${n}?`, a * rr ** (n - 1)); },
    (r) => { const a = r.int(1, 10), d = r.int(1, 6), n = r.int(5, 20); return Q('h', `What is the sum of the first ${n} terms of the arithmetic sequence that starts at ${a} with a common difference of ${d}?`, (n * (2 * a + (n - 1) * d)) / 2); },
    (r) => { const a = r.int(1, 12), k = r.int(2, 5); return FQ('h', `What is the sum of the infinite geometric series with first term ${a} and common ratio 1/${k}?`, a * k, k - 1); },
    (r) => { const n = r.int(3, 12); return Q('h', `What is the sum of the squares of the first ${n} positive integers?`, (n * (n + 1) * (2 * n + 1)) / 6); },
    (r) => { const n = r.int(5, 40); return Q('m', `What is the sum of the first ${n} positive integers?`, (n * (n + 1)) / 2); },
  ] },
  { leadin: 'Answer these questions about functions.', fns: [
    (r) => { const a = r.int(2, 5), b = r.int(-5, 5), c = r.int(2, 5), d = r.int(-5, 5), k = r.int(1, 6); return Q('m', `If f of x equals ${a}x ${sgn(b)} and g of x equals ${c}x ${sgn(d)}, what is f of g of ${k}?`, a * (c * k + d) + b); },
    (r) => { const a = r.int(2, 12); return Q('m', `What is the inverse function of f of x equals x plus ${a}?`, `x-${a}`); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is the inverse function of f of x equals ${a}x?`, `x/${a}`); },
    (r) => { const a = r.int(-9, 9) || 4; return Q('m', `What value of x is excluded from the domain of 1 over the quantity x ${sgn(-a)}?`, a); },
    (r) => { const a = r.int(-8, 8) || 5; return Q('m', `What is the smallest value of x in the domain of the square root of the quantity x ${sgn(-a)}?`, a); },
    (r) => { const a = r.int(1, 9), b = r.int(1, 9); return Q('m', `The graph of y equals x squared is shifted ${a} units right and ${b} units up. What is the vertex of the new graph?`, `(${a},${b})`); },
    (r) => { const a = r.int(2, 9), b = r.int(1, 9); return Q('h', `What is the sum of the solutions of the equation the absolute value of x minus ${a} equals ${b}?`, 2 * a); },
    (r) => { const a = r.int(2, 7), k = r.int(2, 9), n = r.int(4, 15); return Q('m', `If y varies directly with x and y equals ${a * k} when x equals ${k}, what is y when x equals ${n}?`, a * n); },
  ] },
  { leadin: 'Answer these questions about polynomials.', fns: [
    (r) => { const a = r.int(1, 6), b = r.int(-9, 9), k = r.int(1, 5); return Q('h', `What is the remainder when x cubed ${sgn(a)}x ${sgn(b)} is divided by x minus ${k}?`, k ** 3 + a * k + b); },
    (r) => { const n = r.int(3, 9); return Q('e', `How many solutions, counting multiplicity, does a polynomial equation of degree ${n} have?`, n); },
    (r) => { const p = r.int(1, 6), q = r.int(1, 6), s = r.int(1, 6); return Q('m', `What is the largest solution of (x minus ${p})(x minus ${q})(x minus ${s}) equals zero?`, Math.max(p, q, s)); },
    (r) => { const a = r.int(1, 5), b = r.int(1, 9), c = r.int(1, 9); return Q('m', `What is the sum of the coefficients of ${a}x squared plus ${b}x plus ${c}?`, a + b + c); },
    (r) => { const s = r.int(2, 12), a = r.int(2, 9), b = r.int(2, 9); return Q('h', `What is the sum of the solutions of x cubed minus ${s}x squared plus ${a}x minus ${b} equals zero?`, s); },
  ] },
  { leadin: 'Answer these questions about rational expressions and inequalities.', fns: [
    (r) => { const a = r.int(2, 9), x = r.int(2, 12), c = r.int(2, 9); return Q('m', `Solve for x: ${a} over x equals ${a * c} over ${x * c}.`, x, [`x=${x}`]); },
    (r) => { const a = r.int(2, 6), b = r.int(2, 6), k = r.int(2, 6); return Q('h', `What is the smallest integer solution of ${a}x minus ${b} is greater than ${a * k - b}?`, k + 1); },
    (r) => { const a = r.int(3, 9), b = r.int(1, 9); return Q('m', `What is the largest integer that satisfies the absolute value of x is less than ${a}?`, a - 1); },
    (r) => { const x = r.int(2, 9), y = r.int(2, 9); return Q('h', `If ${x}a plus b equals ${x * 3 + y} and a equals 3, what is b?`, y); },
  ] },
];

const SPECIAL = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360];
const SIN = { 0: '0', 30: '1/2', 45: 'sqrt(2)/2', 60: 'sqrt(3)/2', 90: '1', 120: 'sqrt(3)/2', 135: 'sqrt(2)/2', 150: '1/2', 180: '0', 210: '-1/2', 225: '-sqrt(2)/2', 240: '-sqrt(3)/2', 270: '-1', 300: '-sqrt(3)/2', 315: '-sqrt(2)/2', 330: '-1/2', 360: '0' };
const COS = { 0: '1', 30: 'sqrt(3)/2', 45: 'sqrt(2)/2', 60: '1/2', 90: '0', 120: '-1/2', 135: '-sqrt(2)/2', 150: '-sqrt(3)/2', 180: '-1', 210: '-sqrt(3)/2', 225: '-sqrt(2)/2', 240: '-1/2', 270: '0', 300: '1/2', 315: 'sqrt(2)/2', 330: 'sqrt(3)/2', 360: '1' };
const TAN = { 0: '0', 30: 'sqrt(3)/3', 45: '1', 60: 'sqrt(3)', 120: '-sqrt(3)', 135: '-1', 150: '-sqrt(3)/3', 180: '0', 210: 'sqrt(3)/3', 225: '1', 240: 'sqrt(3)', 300: '-sqrt(3)', 315: '-1', 330: '-sqrt(3)/3', 360: '0' };
const halfAlt = (s) => (s === '1/2' ? ['0.5'] : s === '-1/2' ? ['-0.5'] : []);

const RAD = { 0: '0', 30: 'pi/6', 45: 'pi/4', 60: 'pi/3', 90: 'pi/2', 120: '2pi/3', 135: '3pi/4', 150: '5pi/6', 180: 'pi', 210: '7pi/6', 225: '5pi/4', 240: '4pi/3', 270: '3pi/2', 300: '5pi/3', 315: '7pi/4', 330: '11pi/6', 360: '2pi' };
const radWords = (d) => (RAD[d] === '0' ? 'zero' : RAD[d].replace('pi/', 'pi over ').replace(/^(d+)pi/, '$1 pi'));
const TRIG_EXTRA = [
  { leadin: 'Answer these questions about trigonometric values in radians.', fns: [
    (r) => { const d = r.pick(SPECIAL); return Q(d % 90 === 0 || [30, 45, 60].includes(d) ? 'm' : 'h', `What is the exact value of the sine of ${radWords(d)} radians?`, SIN[d], halfAlt(SIN[d])); },
    (r) => { const d = r.pick(SPECIAL); return Q(d % 90 === 0 || [30, 45, 60].includes(d) ? 'm' : 'h', `What is the exact value of the cosine of ${radWords(d)} radians?`, COS[d], halfAlt(COS[d])); },
    (r) => { const d = r.pick(Object.keys(TAN).map(Number)); return Q('h', `What is the exact value of the tangent of ${radWords(d)} radians?`, TAN[d]); },
    (r) => { const [t, v, a] = r.pick([['arcsine', '1/2', 'pi/6'], ['arcsine', 'sqrt(3)/2', 'pi/3'], ['arcsine', 'sqrt(2)/2', 'pi/4'], ['arccosine', '1/2', 'pi/3'], ['arccosine', '0', 'pi/2'], ['arccosine', 'sqrt(3)/2', 'pi/6'], ['arctangent', '1', 'pi/4'], ['arctangent', 'sqrt(3)', 'pi/3'], ['arcsine', '1', 'pi/2'], ['arccosine', '-1', 'pi'], ['arccosine', 'sqrt(2)/2', 'pi/4']]); return Q('h', `What is the ${t} of ${v}, in radians?`, a); },
    (r) => { const d = r.pick([30, 45, 60, 90, 120, 135, 150, 180]); return Q('m', `Convert ${radWords(d)} radians to degrees.`, d); },
  ] },
  { leadin: 'Answer these questions about the unit circle.', fns: [
    (r) => { const d = r.pick([0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]); return Q('m', `What are the coordinates of the point on the unit circle at an angle of ${d} degrees?`, `(${COS[d]},${SIN[d]})`); },
    (r) => { const d = r.pick([30, 45, 60]); return Q('m', `The sine of ${d} degrees equals the cosine of what angle between 0 and 90 degrees?`, 90 - d); },
    (r) => { const d = r.pick([30, 45, 60, 90]); const sd = SIN[d]; return Q('h', `What is the exact value of the sine of negative ${d} degrees?`, sd === '0' ? '0' : sd.startsWith('-') ? sd.slice(1) : `-${sd}`, sd === '1/2' ? ['-0.5'] : []); },
    (r) => { const d = r.pick([30, 45, 60]); return Q('h', `What is the exact value of the cosine of negative ${d} degrees?`, COS[d], halfAlt(COS[d])); },
    (r) => { const k = r.int(2, 4); const [a, b] = r.pick([[3, 4], [5, 12], [8, 15], [7, 24]]); return FQ('m', `If the sine of an acute angle is ${a * k}/${(Math.hypot(a, b) | 0) * k} and the cosine is ${b * k}/${(Math.hypot(a, b) | 0) * k}, what is the tangent?`, a, b); },
  ] },
];
const TRIG = [
  { leadin: 'Answer these questions about exact trigonometric values.', fns: [
    (r) => { const d = r.pick(SPECIAL); return Q(d % 90 === 0 || [30, 45, 60].includes(d) ? 'e' : 'h', `What is the exact value of the sine of ${d} degrees?`, SIN[d], halfAlt(SIN[d])); },
    (r) => { const d = r.pick(SPECIAL); return Q(d % 90 === 0 || [30, 45, 60].includes(d) ? 'e' : 'h', `What is the exact value of the cosine of ${d} degrees?`, COS[d], halfAlt(COS[d])); },
    (r) => { const d = r.pick(Object.keys(TAN).map(Number)); return Q([0, 30, 45, 60].includes(d) ? 'm' : 'h', `What is the exact value of the tangent of ${d} degrees?`, TAN[d]); },
    (r) => { const [fn, d, a] = r.pick([['cosecant', 30, '2'], ['secant', 60, '2'], ['cotangent', 45, '1'], ['cosecant', 90, '1'], ['secant', 0, '1'], ['cotangent', 90, '0'], ['secant', 180, '-1'], ['cosecant', 270, '-1'], ['cotangent', 135, '-1'], ['secant', 45, 'sqrt(2)'], ['cosecant', 45, 'sqrt(2)'], ['cotangent', 60, 'sqrt(3)/3'], ['cosecant', 150, '2'], ['secant', 120, '-2']]); return Q('h', `What is the exact value of the ${fn} of ${d} degrees?`, a); },
  ] },
  { leadin: 'Answer these questions about radians and arcs.', fns: [
    (r) => { const d = r.pick([30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360, 15, 75]); return Q('m', `Convert ${d} degrees to radians. Give the answer in terms of pi.`, piMul(d, 180)); },
    (r) => { const d = r.pick([2, 3, 4, 5, 6, 9, 10, 12, 18, 20]); return Q('m', `Convert pi over ${d} radians to degrees.`, 180 / d); },
    (r) => { const rad = r.pick([3, 4, 6, 9, 12]), deg = r.pick([30, 60, 90, 120, 45, 150]); return Q('h', `What is the length of the arc cut off by a central angle of ${deg} degrees in a circle of radius ${rad}? Give the answer in terms of pi.`, piMul(rad * deg, 180)); },
    (r) => { const n = r.pick([2, 3, 4, 5, 6, 7, 8]), dd = r.pick([2, 3, 4, 6]); if (gcd(n, dd) !== 1) return Q('m', `Convert 3pi over 2 radians to degrees.`, 270); return Q('h', `Convert ${n}pi over ${dd} radians to degrees.`, (180 * n) / dd); },
  ] },
  { leadin: 'Answer these questions about right triangles and identities.', fns: [
    (r) => { const [a, b, c] = r.pick(TRIPLES); return FQ('m', `In a right triangle with legs ${a} and ${b}, what is the sine of the angle opposite the leg of length ${a}?`, a, c); },
    (r) => { const [a, b, c] = r.pick(TRIPLES); return FQ('m', `In a right triangle with legs ${a} and ${b}, what is the cosine of the angle opposite the leg of length ${a}?`, b, c); },
    (r) => { const [a, b] = r.pick(TRIPLES); return FQ('m', `In a right triangle with legs ${a} and ${b}, what is the tangent of the angle opposite the leg of length ${a}?`, a, b); },
    (r) => { const [a, b, c] = r.pick(TRIPLES); return FQ('h', `An acute angle has a sine of ${a}/${c}. What is its cosine?`, b, c); },
    (r) => { const [a, b, c] = r.pick(TRIPLES); return FQ('h', `An acute angle has a cosine of ${b}/${c}. What is its tangent?`, a, b); },
    (r) => { const a = r.int(2, 30); return Q('m', `What is the sine squared of ${a} degrees plus the cosine squared of ${a} degrees?`, 1); },
  ] },
  { leadin: 'Answer these questions about inverse functions and angles.', fns: [
    (r) => { const [t, v, a] = r.pick([['arcsine', '1/2', 30], ['arcsine', 'sqrt(3)/2', 60], ['arcsine', 'sqrt(2)/2', 45], ['arccosine', '1/2', 60], ['arccosine', '0', 90], ['arccosine', 'sqrt(3)/2', 30], ['arctangent', '1', 45], ['arctangent', '0', 0], ['arcsine', '1', 90], ['arccosine', '1', 0]]); return Q('m', `What is the ${t} of ${v}, in degrees?`, a); },
    (r) => { const d = r.pick([120, 135, 150, 210, 225, 240, 300, 315, 330]); const ref = d < 180 ? 180 - d : d < 270 ? d - 180 : 360 - d; return Q('m', `What is the reference angle of ${d} degrees?`, ref); },
    (r) => { const d = r.pick([380, 400, 420, 450, 500, 720, 765, -30, -45, -90, -120, -180]); return Q('m', `What angle between 0 and 360 degrees is coterminal with ${num(d)} degrees?`, ((d % 360) + 360) % 360); },
  ] },
  { leadin: 'Answer these questions about graphs of trigonometric functions.', fns: [
    (r) => { const k = r.pick([2, 3, 4, 5, 6, 8]); return Q('m', `What is the period of the function y equals the sine of ${k}x, in radians?`, piMul(2, k)); },
    (r) => { const a = r.int(2, 9); return Q('e', `What is the amplitude of the function y equals ${a} times the sine of x?`, a); },
    (r) => Q('e', 'What is the period of the function y equals the cosine of x, in radians?', '2pi'),
    (r) => Q('e', 'What is the period of the function y equals the tangent of x, in radians?', 'pi'),
    (r) => { const a = r.int(2, 8), b = r.int(1, 6); return Q('m', `What is the maximum value of y equals ${a} times the sine of x plus ${b}?`, a + b); },
  ] },
  { leadin: 'Answer these questions about triangles that are not right triangles.', fns: [
    (r) => { const a = r.int(2, 9), b = r.int(2, 9); return Q('h', `In a triangle, two sides have lengths ${a} and ${b}, and the angle between them measures 60 degrees. What is the square of the third side?`, a * a + b * b - a * b); },
    (r) => { const a = r.int(2, 9), b = r.int(2, 9); return Q('h', `In a triangle, two sides have lengths ${a} and ${b}, and the angle between them measures 120 degrees. What is the square of the third side?`, a * a + b * b + a * b); },
    (r) => { const a = r.int(2, 12) * 2, b = r.int(2, 12); return FQ('h', `What is the area of a triangle with two sides of length ${a} and ${b} and an included angle of 30 degrees?`, a * b, 4); },
    (r) => { const k = r.int(2, 9); return Q('m', `In a triangle, a side of length ${k} lies opposite an angle of 30 degrees. What is the length of the side opposite the 90 degree angle?`, 2 * k); },
    (r) => { const a = r.int(2, 14); return Q('h', `In a triangle with angles of 45, 45, and 90 degrees, each leg has length ${a}sqrt(2). What is the length of the hypotenuse?`, 2 * a); },
    (r) => { const k = r.int(2, 9); return Q('m', `In a 30-60-90 triangle, the shorter leg has length ${k}. What is the length of the hypotenuse?`, 2 * k); },
  ] },
];

// ------------------------------------------------------------ varsity templates
const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
const nCr = (n, k) => fact(n) / (fact(k) * fact(n - k));
const PRECALC = [
  { leadin: 'Answer these questions about counting.', fns: [
    (r) => { const n = r.int(5, 14), k = r.int(2, 4); return Q('m', `What is ${n} choose ${k}?`, nCr(n, k)); },
    (r) => { const n = r.int(4, 9), k = r.int(2, 3); return Q('m', `In how many ways can ${k} different books be chosen and arranged in order from a shelf of ${n} different books?`, fact(n) / fact(n - k)); },
    (r) => { const n = r.int(3, 8); return Q('e', `What is ${n} factorial?`, fact(n)); },
    (r) => { const n = r.int(4, 9); return Q('h', `What is the coefficient of x squared in the expansion of x plus 1, all raised to the power ${n}?`, nCr(n, 2)); },
    (r) => { const n = r.int(4, 8), k = r.int(2, 3); return Q('h', `How many different committees of ${k} people can be formed from a group of ${n} people?`, nCr(n, k)); },
  ] },
  { leadin: 'Answer these questions about matrices and vectors.', fns: [
    (r) => { const a = r.int(1, 9), b = r.int(1, 9), c = r.int(1, 9), d = r.int(1, 9); return Q('m', `What is the determinant of the 2 by 2 matrix with first row ${a}, ${b} and second row ${c}, ${d}?`, a * d - b * c); },
    (r) => { const a = r.int(-5, 6), b = r.int(-5, 6), c = r.int(-5, 6), d = r.int(-5, 6); return Q('m', `What is the dot product of the vectors (${a}, ${b}) and (${c}, ${d})?`, a * c + b * d); },
    (r) => { const [a, b, c] = r.pick(TRIPLES); return Q('m', `What is the magnitude of the vector (${a}, ${b})?`, c); },
    (r) => { const a = r.int(2, 6), b = r.int(2, 6), c = r.int(2, 6), d = r.int(2, 6); return Q('h', `What is the sum of the vectors (${a}, ${b}) and (${c}, ${d}), multiplied by the scalar 2?`, `(${2 * (a + c)},${2 * (b + d)})`); },
  ] },
  { leadin: 'Answer these questions about conic sections.', fns: [
    (r) => { const a = r.int(2, 15); return Q('e', `What is the radius of the circle x squared plus y squared equals ${a * a}?`, a); },
    (r) => { const h = r.int(-6, 6) || 2, k = r.int(-6, 6) || 3; return Q('m', `What is the center of the circle (x ${sgn(-h)}) squared plus (y ${sgn(-k)}) squared equals 25?`, `(${h},${k})`); },
    (r) => { const a = r.int(2, 9), b = r.int(1, a - 1) || 1; return Q('m', `What is the length of the major axis of the ellipse x squared over ${a * a} plus y squared over ${b * b} equals 1?`, 2 * a); },
    (r) => { const p = r.int(1, 9); return Q('h', `What is the distance from the vertex to the focus of the parabola y squared equals ${4 * p}x?`, p); },
    (r) => { const a = r.int(2, 6), b = r.int(2, 9); return FQ('h', `What is the slope of the positive asymptote of the hyperbola x squared over ${a * a} minus y squared over ${b * b} equals 1?`, b, a); },
  ] },
  { leadin: 'Answer these questions about logarithms and exponential equations.', fns: [
    (r) => { const m = r.int(2, 6), n = r.int(2, 6); return Q('m', `What is the base-2 logarithm of ${2 ** m} plus the base-2 logarithm of ${2 ** n}?`, m + n); },
    (r) => { const k = r.int(2, 9); return FQ('m', `Solve for x: 2 to the power 2x equals ${2 ** k}.`, k, 2); },
    (r) => { const k = r.int(3, 9); return Q('m', `Solve for x: 2 to the power of the quantity x plus 1 equals ${2 ** k}.`, k - 1, [`x=${k - 1}`]); },
    (r) => { const b = r.pick([2, 3, 5]), m = r.int(3, 6), n = r.int(1, 2); return Q('h', `What is the base-${b} logarithm of ${b ** m} minus the base-${b} logarithm of ${b ** n}?`, m - n); },
    (r) => { const b = r.pick([2, 3, 4]), k = r.int(1, 3); return FQ('h', `What is the base-${b} logarithm of 1 over ${b ** k}, as a number?`, -k, 1, false); },
  ] },
  { leadin: 'Answer these questions about sequences and limits.', fns: [
    (r) => { const a = r.int(1, 5), c = r.int(1, 5), b = r.int(1, 9), d = r.int(1, 9); return FQ('m', `What is the limit of the quantity ${a}x plus ${b} over ${c}x plus ${d} as x approaches infinity?`, a, c); },
    (r) => { const a = r.int(2, 9), r2 = r.int(2, 4); return Q('m', `Each term of a sequence is ${r2} times the previous term, and the first term is ${a}. What is the fifth term?`, a * r2 ** 4); },
    (r) => { const a = r.int(1, 4); return Q('h', `The first term of a sequence is ${a}, and each later term is twice the previous term plus one. What is the fourth term?`, ((a * 2 + 1) * 2 + 1) * 2 + 1); },
    (r) => { const a = r.int(5, 40), d = r.int(1, 6), n = r.int(8, 25); return Q('h', `What is the sum of the first ${n} terms of the arithmetic sequence with first term ${a} and common difference ${d}?`, (n * (2 * a + (n - 1) * d)) / 2); },
  ] },
  { leadin: 'Answer these questions about trigonometric identities.', fns: [
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 5)); return FQ('h', `An acute angle has a sine of ${a}/${c}. What is the sine of twice that angle?`, 2 * a * b, c * c); },
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 5)); return FQ('h', `An acute angle has a sine of ${a}/${c}. What is the cosine of twice that angle?`, b * b - a * a, c * c); },
    (r) => { const d = r.pick([15, 30, 45, 60]); return Q('m', `What is the sine of ${d} degrees squared plus the cosine of ${d} degrees squared?`, 1); },
    (r) => { const x = r.pick([30, 45, 60, 90]); return Q('m', `What is the sine of ${2 * x} degrees, if the angle ${x} degrees is doubled?`.replace(`the sine of ${2 * x} degrees, if the angle ${x} degrees is doubled`, `the sine of the double angle of ${x} degrees`), x === 30 ? 'sqrt(3)/2' : x === 45 ? '1' : x === 60 ? 'sqrt(3)/2' : '0'); },
  ] },
  { leadin: 'Answer these questions about polar coordinates and complex numbers.', fns: [
    (r) => { const k = r.int(1, 9); return Q('h', `What are the rectangular coordinates of the polar point with r equal to ${k} and theta equal to 90 degrees?`, `(0,${k})`); },
    (r) => { const k = r.int(1, 9); return Q('h', `What are the rectangular coordinates of the polar point with r equal to ${k} and theta equal to 180 degrees?`, `(${-k},0)`); },
    (r) => { const k = r.int(1, 9); return Q('h', `What are the rectangular coordinates of the polar point with r equal to ${k} and theta equal to 270 degrees?`, `(0,${-k})`); },
    (r) => { const [a, b, c] = r.pick(TRIPLES.slice(0, 6)); return Q('m', `What is the distance from the origin to the complex number ${a} plus ${b}i in the complex plane?`, c); },
  ] },
  { leadin: 'Answer these questions about functions and equations.', fns: [
    (r) => { const a = r.int(2, 5), b = r.int(1, 9), k = r.int(1, 9); return Q('m', `If f of x equals ${a}x plus ${b}, what is the value of the inverse function of f at ${a * k + b}?`, k); },
    (r) => { const s = r.int(2, 12), a = r.int(2, 9), b = r.int(2, 9); return Q('h', `What is the sum of the solutions of x cubed minus ${s}x squared plus ${a}x minus ${b} equals zero?`, s); },
    (r) => { const a = r.int(1, 6), b = r.int(-9, 9), k = r.int(1, 4); return Q('h', `What is the remainder when x cubed plus ${a}x squared ${sgn(b)}x plus 2 is divided by x minus ${k}?`, k ** 3 + a * k * k + b * k + 2); },
    (r) => { const p = r.int(1, 5), q = r.int(1, 5); return Q('m', `What is the largest zero of the polynomial (x minus ${p})(x plus ${q})(x minus ${p + q})?`, Math.max(p, -q, p + q)); },
  ] },
];

const CALC = [
  { leadin: 'Answer these questions about derivatives of polynomials.', fns: [
    (r) => { const a = r.int(1, 7), b = r.int(2, 6), c = r.int(1, 9); const p = [a, 0, c]; p.length = 0; const cc = [a, ...new Array(b - 1).fill(0), c]; const d = cc.slice(0, -1).map((k, i) => k * (b - i)); return PQ('m', `What is the derivative of ${polyWords(cc)} with respect to x?`, d); },
    (r) => { const a = r.int(1, 6), b = r.int(1, 9), c = r.int(1, 9); return PQ('m', `What is the derivative of ${polyWords([a, b, c])} with respect to x?`, [2 * a, b]); },
    (r) => { const a = r.int(1, 5), b = r.int(1, 6), c = r.int(1, 8), d = r.int(1, 9); return PQ('h', `What is the derivative of ${polyWords([a, b, c, d])} with respect to x?`, [3 * a, 2 * b, c]); },
    (r) => { const n = r.int(3, 8), a = r.int(1, 6); return PQ('m', `What is the derivative of ${a}x to the power ${n} with respect to x?`, [a * n, ...new Array(n - 1).fill(0)]); },
    (r) => { const a = r.int(1, 4), b = r.int(1, 6), k = r.int(1, 5); return Q('m', `If f of x equals ${a}x cubed minus ${b}x, what is f prime of ${k}?`, 3 * a * k * k - b); },
    (r) => { const n = r.int(3, 7), a = r.int(1, 5); return PQ('h', `What is the second derivative of ${a}x to the power ${n} with respect to x?`, [a * n * (n - 1), ...new Array(n - 2).fill(0)]); },
    (r) => { const n = r.int(2, 6), k = r.int(1, 4); return Q('m', `What is the slope of the tangent line to y equals x to the power ${n} at x equals ${k}?`, n * k ** (n - 1)); },
  ] },
  { leadin: 'Answer these questions about derivatives of other functions.', fns: [
    (r) => { const a = r.int(2, 9); return Q('m', `What is the derivative of ${a} times e to the x?`, `${a}e^x`); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is the derivative of ${a} times the natural logarithm of x?`, `${a}/x`); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is the derivative of ${a} times the sine of x?`, `${a}cos(x)`, [`${a}cos x`, `${a}cosx`]); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is the derivative of ${a} times the cosine of x?`, `-${a}sin(x)`, [`-${a}sin x`, `-${a}sinx`]); },
    (r) => { const a = r.int(2, 6); return Q('h', `What is the derivative of e to the power ${a}x?`, `${a}e^(${a}x)`, [`${a}e^${a}x`]); },
    (r) => { const a = r.int(1, 5), k = r.int(1, 3); return Q('h', `What is the derivative of x times the quantity x plus ${a}, evaluated at x equals ${k}?`, 2 * k + a); },
    (r) => { const a = r.int(1, 5), n = r.int(2, 4), k = r.int(1, 3); return Q('h', `What is the derivative of the quantity x squared plus ${a}, all raised to the power ${n}, evaluated at x equals ${k}?`, n * (k * k + a) ** (n - 1) * 2 * k); },
  ] },
  { leadin: 'Answer these questions about limits.', fns: [
    (r) => { const a = r.int(2, 12); return Q('m', `What is the limit of x squared minus ${a * a} all over x minus ${a} as x approaches ${a}?`, 2 * a); },
    (r) => { const a = r.int(1, 5), b = r.int(1, 9), c = r.int(1, 9), k = r.int(1, 4); return Q('e', `What is the limit of ${a}x squared plus ${b}x plus ${c} as x approaches ${k}?`, a * k * k + b * k + c); },
    (r) => { const a = r.int(2, 9); return Q('h', `What is the limit of the sine of ${a}x over x as x approaches zero?`, a); },
    (r) => { const a = r.int(2, 8), b = r.int(1, 6); return Q('m', `What is the limit of x squared plus ${b}x minus ${a * a + a * b} all over x minus ${a} as x approaches ${a}?`, 2 * a + b); },
    (r) => { const a = r.int(2, 9), c = r.int(2, 9); return FQ('m', `What is the limit of ${a}x squared plus 1 all over ${c}x squared plus 5 as x approaches infinity?`, a, c); },
  ] },
  { leadin: 'Answer these questions about integrals.', fns: [
    (r) => { const n = r.int(1, 6), a = (n + 1) * r.int(1, 4); return Q('m', `What is the antiderivative of ${a}x to the power ${n}, including the constant of integration?`, `${a / (n + 1) === 1 ? '' : a / (n + 1)}x^${n + 1}+C`, [`${a / (n + 1) === 1 ? '' : a / (n + 1)}x^${n + 1} + C`]); },
    (r) => { const n = r.int(1, 4), b = r.int(1, 4), a = (n + 1) * r.int(1, 3); return Q('h', `What is the definite integral of ${a}x to the power ${n} from 0 to ${b}?`, (a * b ** (n + 1)) / (n + 1)); },
    (r) => { const b = r.int(2, 9); return Q('m', `What is the definite integral of 2x from 0 to ${b}?`, b * b); },
    (r) => { const a = r.int(1, 9), b = r.int(2, 6); return Q('m', `What is the definite integral of ${a} from 0 to ${b}?`, a * b); },
    (r) => { const a = r.int(2, 9); return Q('m', `What is the antiderivative of ${a} times e to the x, including the constant of integration?`, `${a}e^x+C`, [`${a}e^x + C`]); },
  ] },
  { leadin: 'Answer these questions about maxima, minima, and motion.', fns: [
    (r) => { const h = r.int(1, 12); return Q('m', `At what value of x does f of x equal x squared minus ${2 * h}x have its minimum?`, h, [`x=${h}`]); },
    (r) => { const h = r.int(1, 9); return Q('h', `What is the maximum value of f of x equals negative x squared plus ${2 * h}x?`, h * h); },
    (r) => { const a = r.int(1, 9), k = r.int(1, 5); return Q('m', `A particle's position is s of t equals t cubed plus ${a}t. What is its velocity at t equals ${k}?`, 3 * k * k + a); },
    (r) => { const k = r.int(1, 8); return Q('m', `A particle's position is s of t equals t cubed. What is its acceleration at t equals ${k}?`, 6 * k); },
    (r) => { const a = r.int(2, 9); return Q('h', `At what positive value of x does f of x equal x cubed minus ${3 * a * a}x have a local minimum?`, a, [`x=${a}`]); },
    (r) => { const a = r.int(1, 6), k = r.int(1, 4); return Q('h', `What is the area under the curve y equals ${2 * a}x from x equals 0 to x equals ${k}?`, a * k * k); },
  ] },
];

// ---------------------------------------------------------------- engine
const CELLS = [
  ['ncal', 'novice', 'Math', 'Arithmetic', ARITH, 1], ['ncal', 'novice', 'Math', 'Algebra 1', ALG1, 2], ['ncal', 'novice', 'Math', 'Geometry', GEOM, 3],
  ['ncal', 'jv', 'Math', 'Algebra 2', ALG2, 4], ['ncal', 'jv', 'Math', 'Trigonometry', [...TRIG, ...TRIG_EXTRA], 5],
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
const clean = (s) => String(s).replace(/\|/g, '/');
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
  const label = (items, score) => {
    const order = items.map((it, i) => [score(it), r.f(), i]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);
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
