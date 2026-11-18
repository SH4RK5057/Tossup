// Prints every duplicate / near-duplicate in the compiled bank (vs seed, batch 1 and itself).
// Run with: npx vite-node scripts/bank/dupes.ts
import { readdirSync, readFileSync } from 'node:fs';
import { findDuplicates, toDupItems } from '../../src/admin/dupes';

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8')) as Record<string, unknown>[];
const dir = new URL('../../batches/', import.meta.url);
const bank = readdirSync(dir).filter((f) => /^bank-.*\.json$/.test(f)).flatMap((f) => read(`../../batches/${f}`));
const existing = [...toDupItems(read('../../seed/questions.json'), 'seed'), ...toDupItems(read('../../batches/questions-batch-1.json'), 'batch1')];
const { exact, near } = findDuplicates(toDupItems(bank, 'bank'), existing);
console.log(`${exact.length} exact, ${near.length} near duplicates`);
for (const l of [...exact, ...near]) console.log(l);
