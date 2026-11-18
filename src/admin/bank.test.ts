import { describe, expect, it } from 'vitest';
import batch1 from '../../batches/questions-batch-1.json';
import seed from '../../seed/questions.json';
import { runBankChecks } from './bankChecks';

// Every compiled bank file (scripts/bank/build.mjs writes batches/bank-<ruleset>-<level>.json).
const files = import.meta.glob('../../batches/bank-*.json', { eager: true, import: 'default' }) as Record<string, Record<string, unknown>[]>;
const rows = Object.values(files).flat();
const existing = [...(seed as Record<string, unknown>[]), ...(batch1 as Record<string, unknown>[])];

describe(`question bank quality gates (${rows.length} rows)`, () => {
  const results = runBankChecks(rows, existing);
  for (const r of results) {
    it(r.name, () => {
      expect(r.problems).toEqual([]);
    });
  }
});
