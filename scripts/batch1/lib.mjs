// Helpers for writing importer-format rows (see docs/import-schema.md).
export const SOURCE = 'ai-claude-batch1';

const spec = (answer, o = {}) => ({
  answer,
  required: o.req ?? null,
  alternates: o.alt ?? [],
  prompt_on: o.prompt ?? [],
  answer_type: o.type ?? 'general',
  duplicate_name: o.dup ?? false,
  accepts_partial_name: o.partial ?? false,
});

export function makeBuilders(rows, rulesetId, level) {
  const base = (category, subcategory) => ({
    rulesets: [rulesetId], level, category, subcategory, source: SOURCE, expires_at: null,
  });
  const T = (category, subcategory, text, answer, o = {}) =>
    rows.push({ type: 'tossup', ...base(category, subcategory), text, ...spec(answer, o) });
  // parts: [difficulty, text, answer, opts]
  const B = (category, subcategory, leadin, parts) =>
    rows.push({
      type: 'bonus', ...base(category, subcategory), leadin,
      parts: parts.map(([part_difficulty, text, answer, o = {}]) => ({ text, part_difficulty, ...spec(answer, o) })),
    });
  return { T, B };
}
