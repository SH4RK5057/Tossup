import { z } from 'zod';

export const RULESET_IDS = ['ncal', 'quizbowl'] as const;
export const rulesetIdSchema = z.enum(RULESET_IDS);
export type RulesetId = z.infer<typeof rulesetIdSchema>;

export const LEVELS = ['novice', 'jv', 'varsity'] as const;
export const levelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof levelSchema>;
/** NCAL calls novice "Freshman" in some documents; we always display "Novice". */
export const LEVEL_LABEL: Record<Level, string> = { novice: 'Novice', jv: 'JV', varsity: 'Varsity' };

/** "Novice + JV" style label for a set of levels, in difficulty order. */
export function levelsLabel(levels: Level[]): string {
  return LEVELS.filter((l) => levels.includes(l)).map((l) => LEVEL_LABEL[l]).join(' + ');
}

export const ANSWER_TYPES = ['general', 'name', 'math', 'foreign_language'] as const;
export const answerTypeSchema = z.enum(ANSWER_TYPES);
export type AnswerType = z.infer<typeof answerTypeSchema>;

export const answerSpecSchema = z.object({
  answer: z.string().min(1),
  required: z.string().nullable().default(null),
  alternates: z.array(z.string()).default([]),
  prompt_on: z.array(z.string()).default([]),
  answer_type: answerTypeSchema.default('general'),
  duplicate_name: z.boolean().default(false),
  accepts_partial_name: z.boolean().default(false),
});
export type AnswerSpec = z.infer<typeof answerSpecSchema>;

export const statusSchema = z.enum(['active', 'pending', 'retired']);
export type Status = z.infer<typeof statusSchema>;

const sharedShape = {
  id: z.string().min(1),
  rulesets: z.array(rulesetIdSchema).min(1),
  level: levelSchema,
  category: z.string().min(1),
  subcategory: z.string().min(1),
  status: statusSchema,
  source: z.string().min(1),
  random: z.number().min(0).max(1),
  expires_at: z.string().nullable().default(null),
  report_count: z.number().int().min(0).default(0),
  created_at: z.string(),
  updated_at: z.string(),
};

export const tossupSchema = z.object({
  ...sharedShape,
  type: z.literal('tossup'),
  text: z.string().min(1),
  ...answerSpecSchema.shape,
});
export type Tossup = z.infer<typeof tossupSchema>;

export const partDifficultySchema = z.enum(['easy', 'medium', 'hard']);
export type PartDifficulty = z.infer<typeof partDifficultySchema>;

export const bonusPartSchema = z.object({
  text: z.string().min(1),
  part_difficulty: partDifficultySchema,
  ...answerSpecSchema.shape,
});
export type BonusPart = z.infer<typeof bonusPartSchema>;

export const bonusSchema = z.object({
  ...sharedShape,
  type: z.literal('bonus'),
  leadin: z.string().min(1),
  parts: z.array(bonusPartSchema).min(3).max(5),
});
export type Bonus = z.infer<typeof bonusSchema>;

export const questionSchema = z.discriminatedUnion('type', [tossupSchema, bonusSchema]);
export type Question = z.infer<typeof questionSchema>;

/**
 * Importer row schema: what a bulk upload may contain. Server-managed fields
 * (id, status, random, report_count, timestamps) are optional and overwritten.
 * This shape is the documented, stable interface for roadmap item 12.
 */
const importShared = {
  rulesets: z.array(rulesetIdSchema).min(1),
  level: levelSchema,
  category: z.string().min(1),
  subcategory: z.string().min(1),
  source: z.string().min(1).default('import'),
  expires_at: z.string().nullable().default(null),
};
export const importRowSchema = z.discriminatedUnion('type', [
  z.object({ ...importShared, type: z.literal('tossup'), text: z.string().min(1), ...answerSpecSchema.shape }),
  z.object({ ...importShared, type: z.literal('bonus'), leadin: z.string().min(1), parts: z.array(bonusPartSchema).min(3).max(5) }),
]);
export type ImportRow = z.infer<typeof importRowSchema>;

export const reportReasons = ['wrong_answer', 'my_answer_should_count', 'typo', 'outdated', 'other'] as const;
export const reportReasonSchema = z.enum(reportReasons);
export type ReportReason = z.infer<typeof reportReasonSchema>;
export const REPORT_REASON_LABEL: Record<ReportReason, string> = {
  wrong_answer: 'Wrong answer',
  my_answer_should_count: 'My answer should count',
  typo: 'Typo',
  outdated: 'Outdated',
  other: 'Other',
};

export const reportSchema = z.object({
  question_id: z.string().min(1),
  reason: reportReasonSchema,
  typed_answer: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
  created_at: z.string(),
  resolved: z.boolean().default(false),
});
export type Report = z.infer<typeof reportSchema>;
export type StoredReport = Report & { id: string };

export type Doc = Question;
export function isTossup(q: Question): q is Tossup { return q.type === 'tossup'; }
export function isBonus(q: Question): q is Bonus { return q.type === 'bonus'; }
