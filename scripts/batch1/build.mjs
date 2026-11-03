// Builds batches/questions-batch-1.json (importer format) from the per-level files.
// Run with: node scripts/batch1/build.mjs
import { writeFileSync } from 'node:fs';
import { makeBuilders } from './lib.mjs';
import ncalNovice from './ncal-novice.mjs';
import ncalJv from './ncal-jv.mjs';
import ncalVarsity from './ncal-varsity.mjs';
import qbNovice from './qb-novice.mjs';
import qbJv from './qb-jv.mjs';
import qbVarsity from './qb-varsity.mjs';

const rows = [];
const sets = [
  ['ncal', 'novice', ncalNovice], ['ncal', 'jv', ncalJv], ['ncal', 'varsity', ncalVarsity],
  ['quizbowl', 'novice', qbNovice], ['quizbowl', 'jv', qbJv], ['quizbowl', 'varsity', qbVarsity],
];
for (const [rs, level, fill] of sets) {
  const before = rows.length;
  fill(makeBuilders(rows, rs, level));
  const added = rows.slice(before);
  console.log(`${rs} ${level}: ${added.filter((r) => r.type === 'tossup').length} tossups, ${added.filter((r) => r.type === 'bonus').length} bonuses`);
}
writeFileSync(new URL('../../batches/questions-batch-1.json', import.meta.url), JSON.stringify(rows, null, 1) + '\n');
console.log(`wrote ${rows.length} rows`);
