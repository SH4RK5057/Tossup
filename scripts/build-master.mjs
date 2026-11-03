// Builds batches/master-import.json: the seed questions plus every batch, as clean importer rows
// (no server fields). Import it once from Admin -> Import & verify.
// Run with: node scripts/build-master.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const SERVER_FIELDS = ['id', 'status', 'random', 'report_count', 'created_at', 'updated_at'];
const clean = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !SERVER_FIELDS.includes(k)));

const seed = read('../seed/questions.json').map(clean);
const batches = [read('../batches/questions-batch-1.json')];
const master = [...seed, ...batches.flat()];
writeFileSync(new URL('../batches/master-import.json', import.meta.url), JSON.stringify(master, null, 1) + '\n');
const t = master.filter((q) => q.type === 'tossup').length;
console.log(`wrote ${master.length} rows (${t} tossups, ${master.length - t} bonuses): ${seed.length} seed + ${master.length - seed.length} from batches`);
