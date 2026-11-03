// Prompt templates for the manual bulk-generation workflow (roadmap 12).
// The site never calls an AI: these build text you paste into Claude yourself, then feed the
// JSON it returns to the importer (Import & verify). Pure functions; no network.

import { RULESETS } from '../core/rulesets';
import { LEVEL_LABEL, type Level, type Question, type RulesetId } from '../core/types';

export interface GenerateOptions {
  rulesetId: RulesetId;
  level: Level;
  type: 'tossup' | 'bonus';
  category: string;
  subcategory: string;
  count: number;
}

const SPEC_DOC = `Answer spec fields (on every tossup, and on every bonus part):
- "answer": canonical answer as displayed (string, required)
- "required": minimum accepted portion, e.g. "Lincoln" for "Abraham Lincoln" (string or null)
- "alternates": other accepted answers (array of strings)
- "prompt_on": answers that should trigger "more specific?" (array of strings)
- "answer_type": one of "general", "name", "math", "foreign_language"
- "duplicate_name": true if several people share the last name and the first name is required
- "accepts_partial_name": true if either part of a name is accepted (e.g. Leonardo OR da Vinci)
Answer types: use "name" for people (put the last name in "required"); "math" for numeric/algebraic answers written in simplified form (fractions in lowest terms, no mixed numbers); "foreign_language" for answers in another language (include the article if the key has one); otherwise "general".`;

export function generatePrompt(o: GenerateOptions): string {
  const rs = RULESETS[o.rulesetId];
  const style = o.rulesetId === 'ncal'
    ? `NCAL style: short "speedcheck" questions of one or two sentences, with one clear answer. ${o.type === 'bonus' ? `Bonuses have a short lead-in and ${rs.bonus.minParts}-${rs.bonus.maxParts} parts, ordered easy to hard.` : ''}`
    : `Quizbowl style: ${o.type === 'tossup' ? 'pyramidal tossups of 4-6 sentences, hardest clues first, giving way to easy clues, ending with "For 10 points, name this ..."' : 'bonuses with a lead-in and exactly 3 parts, ordered easy to hard'}.`;
  const shape = o.type === 'tossup'
    ? `{ "type": "tossup", "rulesets": ["${o.rulesetId}"], "level": "${o.level}", "category": "${o.category}", "subcategory": "${o.subcategory}", "source": "ai", "expires_at": null, "text": "...", <answer spec fields> }`
    : `{ "type": "bonus", "rulesets": ["${o.rulesetId}"], "level": "${o.level}", "category": "${o.category}", "subcategory": "${o.subcategory}", "source": "ai", "expires_at": null, "leadin": "...", "parts": [ { "text": "...", "part_difficulty": "easy" | "medium" | "hard", <answer spec fields> } ] }`;
  return `Write ${o.count} ${o.type === 'tossup' ? 'tossup' : 'bonus'} question${o.count === 1 ? '' : 's'} for the ${rs.name} (${rs.shortName}) at ${LEVEL_LABEL[o.level]} level.
Subject: ${o.category} / ${o.subcategory}.

${style}

Rules:
- Use only well-established facts. If you are not certain of a fact, do not use it.
- One unambiguous answer per question. No two questions in the batch may share an answer.
- Do not put the answer in the question text.
- Write for typed answers: list every reasonable alternate and prompt-on.

Output ONLY a JSON array (no commentary, no code fence), one object per question, in exactly this shape:
${shape}

${SPEC_DOC}`;
}

/** Cold-answer prompt: questions only, never the keys. Paste into a fresh Claude session. */
export function coldAnswerPrompt(pending: Question[]): string {
  const items = pending.map((q) =>
    q.type === 'tossup'
      ? { id: q.id, type: 'tossup', question: q.text }
      : { id: q.id, type: 'bonus', leadin: q.leadin, parts: q.parts.map((p) => p.text) },
  );
  return `Answer each of these academic-league questions from your own knowledge. Give the shortest correct answer. Do not explain.

Output ONLY a JSON array with one object per question: { "id": "<the id>", "answer": "<your answer>" }.
For a bonus, "answer" must be an array of strings with one answer per part, in order.

${JSON.stringify(items, null, 2)}`;
}
