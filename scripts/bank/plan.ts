// Writes scripts/bank/targets.json from the bulk plan (even split across ruleset, level and subject).
// Run with: npx vite-node scripts/bank/plan.ts
import { writeFileSync } from 'node:fs';
import { buildCells } from '../../src/admin/planLogic';

const cells = buildCells({
  total: 10000, rulesets: ['ncal', 'quizbowl'], levels: ['novice', 'jv', 'varsity'],
  bonusShare: 0.2, tossupChunk: 30, bonusChunk: 10,
});
writeFileSync(new URL('./targets.json', import.meta.url), JSON.stringify(cells, null, 1) + '\n');
console.log(`${cells.length} cells, ${cells.reduce((s, c) => s + c.tossups + c.bonuses, 0)} questions`);
