import { normalizeText } from '../core/normalize';
import { RULESETS } from '../core/rulesets';
import { importRowSchema, type ImportRow, type Question } from '../core/types';

export type RowStatus = 'valid' | 'duplicate' | 'invalid';

export interface RowResult {
  index: number;
  status: RowStatus;
  errors: string[];
  /** Ready-to-save pending question (only for valid rows). */
  question?: Question;
  /** First words of the question, for display. */
  preview: string;
}

export interface ImportOptions {
  nowIso: string;
  makeId: (index: number) => string;
  random: () => number;
}

/** Normalized text used to detect duplicates. */
export function fingerprint(q: { type: 'tossup'; text: string } | { type: 'bonus'; leadin: string; parts: { text: string }[] }): string {
  return q.type === 'tossup' ? normalizeText(q.text) : normalizeText([q.leadin, ...q.parts.map((p) => p.text)].join(' '));
}

const previewOf = (row: unknown): string => {
  const r = row as { text?: unknown; leadin?: unknown } | null;
  const t = typeof r?.text === 'string' ? r.text : typeof r?.leadin === 'string' ? r.leadin : '';
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
};

function subjectErrors(row: ImportRow): string[] {
  const errs: string[] = [];
  for (const rid of row.rulesets) {
    const rs = RULESETS[rid];
    const cat = rs.subjects.find((c) => c.name === row.category);
    if (!cat) errs.push(`category "${row.category}" is not in the ${rs.shortName} subject tree`);
    else if (!cat.subjects.some((s) => s.name === row.subcategory)) {
      errs.push(`subcategory "${row.subcategory}" is not under ${cat.name} in ${rs.shortName}`);
    }
  }
  return errs;
}

/**
 * Validates an uploaded JSON array: zod schema per row, subject-tree check, and duplicate detection
 * (normalized text) against existing questions and earlier rows. Valid rows become pending questions.
 */
export function validateImport(raw: unknown, existing: Question[], opts: ImportOptions): { fatal?: string; rows: RowResult[] } {
  if (!Array.isArray(raw)) return { fatal: 'The upload must be a JSON array of questions.', rows: [] };
  const seen = new Set(existing.map((q) => fingerprint(q)));
  const rows: RowResult[] = raw.map((item, index) => {
    const preview = previewOf(item);
    const parsed = importRowSchema.safeParse(item);
    if (!parsed.success) {
      return {
        index, status: 'invalid' as const, preview,
        errors: parsed.error.issues.map((i) => `${i.path.join('.') || 'row'}: ${i.message}`),
      };
    }
    const row = parsed.data;
    const errors = subjectErrors(row);
    if (errors.length) return { index, status: 'invalid' as const, errors, preview };
    const fp = fingerprint(row);
    if (seen.has(fp)) return { index, status: 'duplicate' as const, errors: ['Duplicate of an existing or earlier question'], preview };
    seen.add(fp);
    const question: Question = {
      ...row,
      id: opts.makeId(index),
      status: 'pending',
      random: opts.random(),
      report_count: 0,
      created_at: opts.nowIso,
      updated_at: opts.nowIso,
    };
    return { index, status: 'valid' as const, errors: [], question, preview };
  });
  return { rows };
}
